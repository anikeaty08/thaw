import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFile } from "node:fs/promises";

const privateKey = process.env.PRIVATE_KEY;
if (!/^0x[\da-fA-F]{64}$/.test(privateKey ?? "")) throw new Error("PRIVATE_KEY must be a 32-byte hex key.");

const deployment = JSON.parse(await readFile("deployments/mezo-testnet.json", "utf8"));
const { musd, vault, mockVe, mockAdapter, faucet, escrow, loanManager } = deployment.contracts;
const account = privateKeyToAccount(privateKey);
const transport = http(deployment.rpcUrl);
const publicClient = createPublicClient({ transport });
const walletClient = createWalletClient({ account, transport });
const erc20 = parseAbi(["function approve(address spender, uint256 amount) returns (bool)", "function balanceOf(address account) view returns (uint256)"]);
const erc721 = parseAbi(["function approve(address to, uint256 tokenId)", "function ownerOf(uint256 tokenId) view returns (address)"]);
const vaultAbi = parseAbi(["function totalAssets() view returns (uint256)", "function deposit(uint256 assets, address receiver) returns (uint256)"]);
const loanAbi = parseAbi([
  "function nextLoanId() view returns (uint256)",
  "function openLoan(address adapter, uint256 tokenId, uint8 mode, uint256 borrowAmount, uint16 repayShareBps) returns (uint256)",
  "function repay(uint256 loanId, uint256 amount)",
  "function debtOf(uint256 loanId) view returns (uint256)",
]);

async function send(label, request) {
  // Mezo's public RPC can under-estimate EIP-7623 data gas. A 1M limit is comfortably above the
  // small user actions exercised here; users still pay only for gas actually consumed.
  const hash = await walletClient.writeContract({ account, gas: 1_000_000n, ...request });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  console.log(`PASS ${label}: ${hash}`);
}

const balance = await publicClient.readContract({ address: musd, abi: erc20, functionName: "balanceOf", args: [account.address] });
if (balance < 501n * 10n ** 18n) throw new Error("Run the Thaw faucet drip before this flow.");

const vaultAssets = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "totalAssets" });
if (vaultAssets < 500n * 10n ** 18n) {
  await send("approve vault MUSD", { address: musd, abi: erc20, functionName: "approve", args: [vault, 500n * 10n ** 18n] });
  await send("lend MUSD to vault", { address: vault, abi: vaultAbi, functionName: "deposit", args: [500n * 10n ** 18n, account.address] });
}

const tokenId = 1n;
const owner = await publicClient.readContract({ address: mockVe, abi: erc721, functionName: "ownerOf", args: [tokenId] });
if (owner.toLowerCase() !== account.address.toLowerCase()) throw new Error(`Demo lock ${tokenId} is not owned by the test wallet.`);

const loanId = await publicClient.readContract({ address: loanManager, abi: loanAbi, functionName: "nextLoanId" });
await send("approve demo lock", { address: mockVe, abi: erc721, functionName: "approve", args: [escrow, tokenId] });
await send("open demo loan", { address: loanManager, abi: loanAbi, functionName: "openLoan", args: [mockAdapter, tokenId, 0, 300n * 10n ** 18n, 10_000] });

const debtBefore = await publicClient.readContract({ address: loanManager, abi: loanAbi, functionName: "debtOf", args: [loanId] });
await send("approve repayment", { address: musd, abi: erc20, functionName: "approve", args: [loanManager, 1n * 10n ** 18n] });
await send("repay demo loan", { address: loanManager, abi: loanAbi, functionName: "repay", args: [loanId, 1n * 10n ** 18n] });
const debtAfter = await publicClient.readContract({ address: loanManager, abi: loanAbi, functionName: "debtOf", args: [loanId] });
if (debtAfter >= debtBefore) throw new Error("Repayment did not reduce loan debt.");

console.log(`PASS loan ${loanId}: debt reduced from ${debtBefore} to ${debtAfter}.`);
console.log(`PASS faucet ${faucet} demo flow completed.`);
