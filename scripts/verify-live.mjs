const required = ["THAW_WEB_URL", "THAW_INDEXER_URL"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const webUrl = process.env.THAW_WEB_URL.replace(/\/$/, "");
const indexerUrl = process.env.THAW_INDEXER_URL.replace(/\/$/, "");
const rpcUrl = process.env.THAW_RPC_URL ?? "https://rpc.test.mezo.org";

async function expectOk(label, url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${label}: expected 2xx, received ${response.status}`);
  console.log(`PASS ${label} (${response.status})`);
  return response;
}

async function main() {
  for (const route of ["/", "/portfolio", "/lend", "/auctions", "/transparency", "/loans/1"]) {
    await expectOk(`frontend ${route}`, `${webUrl}${route}`);
  }

  await expectOk("indexer health", `${indexerUrl}/health`);
  await expectOk("indexer readiness", `${indexerUrl}/ready`);

  const graphql = await expectOk("indexer GraphQL", `${indexerUrl}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "{ loans(limit: 1) { items { id } } }" }),
  });
  const payload = await graphql.json();
  if (payload.errors || !payload.data?.loans?.items) {
    throw new Error(`indexer GraphQL returned an unexpected payload: ${JSON.stringify(payload)}`);
  }
  console.log("PASS indexer GraphQL response shape");

  const contractVariables = Object.entries(process.env).filter(([key, value]) =>
    key.startsWith("THAW_CONTRACT_") && /^0x[0-9a-fA-F]{40}$/.test(value ?? ""),
  );
  if (!contractVariables.length) {
    throw new Error("Provide one or more THAW_CONTRACT_* address variables to verify deployed contract code.");
  }

  for (const [name, address] of contractVariables) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: name, method: "eth_getCode", params: [address, "latest"] }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error || payload.result === "0x") {
      throw new Error(`${name}: no deployed bytecode at ${address}`);
    }
    console.log(`PASS ${name} bytecode (${address})`);
  }
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});
