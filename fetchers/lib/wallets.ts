/**
 * Load wallet addresses from project data files.
 * Returns deduplicated arrays for SOL and EVM (BSC) wallets.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..", "..");

interface WalletEntry {
  wallet_address?: string;
  address?: string;
}

function extractAddresses(data: any): string[] {
  const addrs = new Set<string>();

  // Walk the nested structure: data.smartMoney.wallets.{category}[].wallet_address
  function walk(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item?.wallet_address) addrs.add(item.wallet_address);
        else if (item?.address) addrs.add(item.address);
      }
      return;
    }
    for (const key of Object.keys(obj)) {
      walk(obj[key]);
    }
  }

  walk(data);
  return [...addrs];
}

function loadJSON(relPath: string): any {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf-8"));
}

/** Load all unique SOL wallet addresses */
export function loadSolWallets(): string[] {
  const addrs = new Set<string>();

  // From solwallets.json (root)
  const sol1 = loadJSON("solwallets.json");
  if (sol1) extractAddresses(sol1).forEach((a) => addrs.add(a));

  // From site/data/solwallets.json
  const sol2 = loadJSON("site/data/solwallets.json");
  if (sol2) extractAddresses(sol2).forEach((a) => addrs.add(a));

  // From output/wallets.txt (one address per line)
  const walletsTxt = join(ROOT, "output", "wallets.txt");
  if (existsSync(walletsTxt)) {
    const lines = readFileSync(walletsTxt, "utf-8").split("\n").filter(Boolean);
    for (const l of lines) addrs.add(l.trim());
  }

  return [...addrs];
}

/** Load all unique EVM (BSC) wallet addresses */
export function loadEvmWallets(): string[] {
  const addrs = new Set<string>();

  const bsc1 = loadJSON("bscwallets.json");
  if (bsc1) extractAddresses(bsc1).forEach((a) => addrs.add(a));

  const bsc2 = loadJSON("site/data/bscwallets.json");
  if (bsc2) extractAddresses(bsc2).forEach((a) => addrs.add(a));

  return [...addrs];
}

/** Load top N wallets by 30d profit from a wallets file */
export function loadTopWallets(chain: "sol" | "evm", limit: number = 50): string[] {
  const filepath = chain === "sol" ? "solwallets.json" : "bscwallets.json";
  const data = loadJSON(filepath);
  if (!data) return [];

  // Collect all wallet entries with profit data
  const entries: { address: string; profit: number }[] = [];

  function walk(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item?.wallet_address && item?.realized_profit_30d) {
          entries.push({
            address: item.wallet_address,
            profit: parseFloat(item.realized_profit_30d) || 0,
          });
        }
      }
      return;
    }
    for (const key of Object.keys(obj)) {
      walk(obj[key]);
    }
  }

  walk(data);
  entries.sort((a, b) => b.profit - a.profit);
  return entries.slice(0, limit).map((e) => e.address);
}
