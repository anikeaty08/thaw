import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFile } from "node:fs/promises";

const rpcUrl = process.env.THAW_RPC_URL ?? "https://rpc.test.mezo.org";
const privateKey = process.env.PRIVATE_KEY;
const broadcastFile = process.env.THAW_BROADCAST_FILE ?? "contracts/broadcast/Deploy.s.sol/31611/run-latest.json";

if (!/^0x[\da-fA-F]{64}$/.test(privateKey ?? "")) throw new Error("PRIVATE_KEY must be a 32-byte hex key.");

const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ transport });
const walletClient = createWalletClient({ account, transport });
const broadcast = JSON.parse(await readFile(broadcastFile, "utf8"));
const nextNonce = BigInt(await publicClient.getTransactionCount({ address: account.address, blockTag: "latest" }));
const planned = broadcast.transactions.filter((transaction) => BigInt(transaction.transaction.nonce) >= nextNonce);

console.log(`Resuming at nonce ${nextNonce}; ${planned.length} transaction(s) remain.`);

for (const transaction of planned) {
  const nonce = BigInt(transaction.transaction.nonce);
  if (nonce !== nextNonce + BigInt(planned.indexOf(transaction))) {
    throw new Error(`Broadcast file has a nonce gap before ${transaction.contractName ?? transaction.function}.`);
  }

  const hash = await walletClient.sendTransaction({
    account,
    chain: null,
    nonce,
    to: transaction.transaction.to,
    data: transaction.transaction.input,
    value: BigInt(transaction.transaction.value ?? "0x0"),
    gas: BigInt(transaction.transaction.gas),
  });
  console.log(`Sent nonce ${nonce}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`Nonce ${nonce} reverted: ${hash}`);
  console.log(`Confirmed nonce ${nonce} in block ${receipt.blockNumber}.`);
}

console.log("All remaining transactions confirmed.");
