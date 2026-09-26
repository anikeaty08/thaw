import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Address } from "viem";
import { config } from "./config.js";

interface LinksFile {
  // chatId -> lowercase wallet address
  byChat: Record<string, string>;
}

function load(): LinksFile {
  if (!existsSync(config.linksStorePath)) return { byChat: {} };
  return JSON.parse(readFileSync(config.linksStorePath, "utf-8")) as LinksFile;
}

function save(data: LinksFile): void {
  mkdirSync(dirname(config.linksStorePath), { recursive: true });
  writeFileSync(config.linksStorePath, JSON.stringify(data, null, 2));
}

export function linkWallet(chatId: number, address: Address): void {
  const data = load();
  data.byChat[String(chatId)] = address.toLowerCase();
  save(data);
}

export function getLinkedWallet(chatId: number): Address | undefined {
  const data = load();
  const addr = data.byChat[String(chatId)];
  return addr as Address | undefined;
}

export function allLinkedChats(): { chatId: number; address: Address }[] {
  const data = load();
  return Object.entries(data.byChat).map(([chatId, address]) => ({
    chatId: Number(chatId),
    address: address as Address,
  }));
}
