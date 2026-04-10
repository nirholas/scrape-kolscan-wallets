/**
 * GMGN Monad Smart Wallets Scraper
 *
 * Scrapes smart wallet / top trader data from https://gmgn.ai/trade?chain=monad
 * using Playwright to intercept API calls, then also attempts direct rank API.
 *
 * Usage: node scrape-gmgn-monad.js
 * Output:
 *   output/monad-smart-wallets.json
 *   output/monad-wallets.txt
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "monad-smart-wallets.json");
const WALLETS_FILE = path.join(OUTPUT_DIR, "monad-wallets.txt");

const GMGN_TRADE_URL = "https://gmgn.ai/trade?chain=monad";
const GMGN_API_BASE = "https://gmgn.ai/defi/quotation/v1";
const CHAIN = "monad";

const CATEGORIES = ["smart_degen", "kol", "sniper", "fresh_wallet", "top_dev", "pump_smart"];
const TIMEFRAMES = ["1d", "7d", "30d"];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://gmgn.ai/",
  Origin: "https://gmgn.ai",
};

if (process.env.GMGN_TOKEN) {
  HEADERS["Authorization"] = `Bearer ${process.env.GMGN_TOKEN}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ──────────────────────────────────────────────────────────────────────────────
// Direct API scraper (same pattern as scrape-gmgn-ranks.js)
// ──────────────────────────────────────────────────────────────────────────────

async function fetchJSON(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 429) {
        const wait = (attempt + 1) * 2000;
        console.log(`  [RATE LIMIT] waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        console.log(`  [WARN] ${url} → ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) console.log(`  [ERR] ${url}: ${err.message}`);
      else await sleep(1000);
    }
  }
  return null;
}

function mergeWalletTimeframes(byAddr) {
  const merged = [];
  for (const [addr, frames] of byAddr) {
    const base = frames["30d"] || frames["7d"] || frames["1d"];
    if (!base) continue;
    const w = { ...base, wallet_address: addr, address: addr };
    if (frames["1d"]) {
      w.realized_profit_1d = frames["1d"].realized_profit || frames["1d"].realized_profit_1d || "0";
      w.pnl_1d = frames["1d"].pnl || frames["1d"].pnl_1d || "0";
      w.buy_1d = frames["1d"].buy_1d || frames["1d"].buy || 0;
      w.sell_1d = frames["1d"].sell_1d || frames["1d"].sell || 0;
      w.txs_1d = frames["1d"].txs_1d || frames["1d"].txs || 0;
      w.winrate_1d = frames["1d"].winrate || frames["1d"].winrate_1d || 0;
      w.volume_1d = frames["1d"].volume_1d || frames["1d"].volume || "0";
    }
    if (frames["7d"]) {
      w.realized_profit_7d = frames["7d"].realized_profit || frames["7d"].realized_profit_7d || "0";
      w.pnl_7d = frames["7d"].pnl || frames["7d"].pnl_7d || "0";
      w.buy_7d = frames["7d"].buy_7d || frames["7d"].buy || 0;
      w.sell_7d = frames["7d"].sell_7d || frames["7d"].sell || 0;
      w.txs_7d = frames["7d"].txs_7d || frames["7d"].txs || 0;
      w.winrate_7d = frames["7d"].winrate || frames["7d"].winrate_7d || 0;
      w.volume_7d = frames["7d"].volume_7d || frames["7d"].volume || "0";
    }
    if (frames["30d"]) {
      w.realized_profit_30d =
        frames["30d"].realized_profit || frames["30d"].realized_profit_30d || "0";
      w.pnl_30d = frames["30d"].pnl || frames["30d"].pnl_30d || "0";
      w.buy_30d = frames["30d"].buy_30d || frames["30d"].buy || 0;
      w.sell_30d = frames["30d"].sell_30d || frames["30d"].sell || 0;
      w.txs_30d = frames["30d"].txs_30d || frames["30d"].txs || 0;
      w.winrate_30d = frames["30d"].winrate || frames["30d"].winrate_30d || 0;
      w.volume_30d = frames["30d"].volume_30d || frames["30d"].volume || "0";
    }
    merged.push(w);
  }
  return merged;
}

async function tryDirectApi() {
  console.log("\n[1] Attempting direct rank API for Monad...");
  const allWallets = {};
  const walletDetails = {};
  const stats = {};
  let totalFound = 0;

  for (const cat of CATEGORIES) {
    console.log(`  [MONAD] ${cat}...`);
    const byAddr = new Map();

    for (const tf of TIMEFRAMES) {
      let page = 1;
      let hasMore = true;
      let pageWallets = 0;

      while (hasMore) {
        const url = `${GMGN_API_BASE}/rank/${CHAIN}/${cat}/${tf}?orderby=pnl_${tf}&direction=desc&page=${page}&limit=100`;
        const data = await fetchJSON(url);
        await sleep(600);

        if (!data) {
          hasMore = false;
          break;
        }

        const rank = data?.data?.rank ?? data?.rank;
        if (!Array.isArray(rank) || rank.length === 0) {
          hasMore = false;
          break;
        }

        for (const w of rank) {
          const addr = w.wallet_address || w.address;
          if (!addr) continue;
          if (!byAddr.has(addr)) byAddr.set(addr, { "1d": null, "7d": null, "30d": null });
          byAddr.get(addr)[tf] = w;
          if (w.detail) walletDetails[addr] = w.detail;
          if (data?.data?.walletDetails?.[addr]) walletDetails[addr] = data.data.walletDetails[addr];
        }
        pageWallets += rank.length;
        hasMore = rank.length === 100 && page < 3;
        page++;
      }
      console.log(`      ${tf}: ${pageWallets} wallets`);
    }

    const wallets = mergeWalletTimeframes(byAddr);
    stats[cat] = wallets.length;
    totalFound += wallets.length;
    if (wallets.length > 0) {
      allWallets[cat] = wallets;
    }
    console.log(`    → ${wallets.length} unique wallets`);

    await sleep(800);
  }

  return { wallets: allWallets, walletDetails, stats, totalFound };
}

// ──────────────────────────────────────────────────────────────────────────────
// Playwright browser scraper (intercepts API calls from the trade page)
// ──────────────────────────────────────────────────────────────────────────────

function extractWallets(data, walletMap) {
  if (!data || typeof data !== "object") return;

  // Common shapes returned by GMGN APIs
  const candidates = [
    data?.data?.rank,
    data?.data?.wallets,
    data?.data?.list,
    data?.data?.traders,
    data?.data?.smart_money,
    data?.wallets,
    data?.rank,
    data?.list,
  ].filter(Array.isArray);

  for (const arr of candidates) {
    for (const w of arr) {
      const addr = w?.wallet_address || w?.address;
      if (!addr) continue;
      const existing = walletMap.get(addr) || {};
      walletMap.set(addr, { ...existing, ...w, wallet_address: addr });
    }
  }

  // Also try walking top-level array
  if (Array.isArray(data)) {
    for (const w of data) {
      const addr = w?.wallet_address || w?.address;
      if (!addr) continue;
      const existing = walletMap.get(addr) || {};
      walletMap.set(addr, { ...existing, ...w, wallet_address: addr });
    }
  }

  // Collect walletDetails map
  const details = data?.data?.walletDetails || data?.walletDetails;
  if (details && typeof details === "object") {
    for (const [addr, detail] of Object.entries(details)) {
      const existing = walletMap.get(addr) || { wallet_address: addr };
      walletMap.set(addr, { ...existing, detail });
    }
  }
}

async function scrapeWithPlaywright() {
  console.log("\n[2] Launching Playwright browser scraper...");
  console.log(`    URL: ${GMGN_TRADE_URL}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    userAgent: HEADERS["User-Agent"],
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const page = await context.newPage();

  const walletMap = new Map();
  const apiResponses = [];

  // Intercept all API/JSON responses
  page.on("response", async (response) => {
    const url = response.url();
    const isRelevant =
      url.includes("/rank/") ||
      url.includes("/trade") ||
      url.includes("/wallets") ||
      url.includes("/smart") ||
      url.includes("/quotation") ||
      url.includes("/defi/") ||
      url.includes("monad") ||
      (url.includes("gmgn.ai") && url.includes("/v1/"));

    if (!isRelevant) return;

    try {
      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("json")) return;

      const json = await response.json();
      apiResponses.push({ url, data: json });
      console.log(`  [API] ${url.substring(0, 120)}`);
      extractWallets(json, walletMap);
    } catch {
      // Not JSON or parse failed — skip
    }
  });

  // Navigate to GMGN Monad trade page
  console.log(`  Loading ${GMGN_TRADE_URL}...`);
  try {
    await page.goto(GMGN_TRADE_URL, { waitUntil: "networkidle", timeout: 60000 });
  } catch (err) {
    console.log(`  Navigation warning (continuing): ${err.message}`);
  }

  await sleep(4000);

  // Save debug screenshot
  await page.screenshot({ path: path.join(OUTPUT_DIR, "monad-debug.png") });
  console.log("  Saved debug screenshot → output/monad-debug.png");

  // Try clicking through tabs / filters to trigger more API calls
  const tabSelectors = [
    "text=Smart Money",
    "text=Smart Wallets",
    "text=Top Traders",
    "text=KOL",
    "text=Sniper",
    "text=Fresh Wallet",
  ];

  for (const sel of tabSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        console.log(`  Clicked tab: ${sel}`);
        await sleep(2500);
      }
    } catch {
      // Tab not found — continue
    }
  }

  // Scroll to trigger lazy-loaded data
  console.log("  Scrolling to load more data...");
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await sleep(1200);
  }

  // Also try paginating via direct fetch calls injected into the page context
  // in case the UI doesn't expose easy pagination controls
  console.log("  Triggering paginated API calls via page context...");
  try {
    const directData = await page.evaluate(async (apiBase) => {
      const results = [];
      const categories = ["smart_degen", "kol", "sniper", "fresh_wallet", "top_dev"];
      const timeframes = ["7d", "30d"];
      for (const cat of categories) {
        for (const tf of timeframes) {
          try {
            const url = `${apiBase}/rank/monad/${cat}/${tf}?orderby=pnl_${tf}&direction=desc&page=1&limit=100`;
            const res = await fetch(url, {
              headers: { Accept: "application/json", Referer: "https://gmgn.ai/" },
            });
            if (res.ok) {
              const json = await res.json();
              results.push({ cat, tf, data: json });
            }
          } catch (e) {
            results.push({ cat, tf, error: e.message });
          }
        }
      }
      return results;
    }, GMGN_API_BASE);

    for (const { cat, tf, data, error } of directData) {
      if (error) {
        console.log(`  [SKIP] ${cat}/${tf}: ${error}`);
        continue;
      }
      const rank = data?.data?.rank ?? data?.rank;
      if (Array.isArray(rank) && rank.length > 0) {
        console.log(`  [IN-PAGE API] ${cat}/${tf}: ${rank.length} wallets`);
        extractWallets(data, walletMap);
      }
    }
  } catch (err) {
    console.log(`  In-page fetch warning: ${err.message}`);
  }

  await browser.close();

  const wallets = Array.from(walletMap.values());
  console.log(`\n  Browser scraper found: ${wallets.length} total wallets`);
  return { wallets, apiResponses };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("GMGN Monad Smart Wallets Scraper");
  console.log(new Date().toISOString());
  console.log(`Target: ${GMGN_TRADE_URL}\n`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const startedAt = new Date().toISOString();

  // Phase 1: Try direct rank API
  const apiResult = await tryDirectApi();

  // Phase 2: Playwright browser scrape (captures any remaining endpoints)
  const browserResult = await scrapeWithPlaywright();

  // Merge results from both phases
  const mergedMap = new Map();

  // Add direct API wallets
  for (const wallets of Object.values(apiResult.wallets)) {
    for (const w of wallets) {
      const addr = w.wallet_address || w.address;
      if (addr) mergedMap.set(addr, { ...mergedMap.get(addr), ...w, wallet_address: addr });
    }
  }

  // Add browser-intercepted wallets (may fill gaps or add new ones)
  for (const w of browserResult.wallets) {
    const addr = w.wallet_address || w.address;
    if (addr) mergedMap.set(addr, { ...mergedMap.get(addr), ...w, wallet_address: addr });
  }

  const allWallets = Array.from(mergedMap.values());
  const finishedAt = new Date().toISOString();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Total unique wallets: ${allWallets.length}`);
  console.log(`  Direct API total:     ${apiResult.totalFound}`);
  console.log(`  Browser total:        ${browserResult.wallets.length}`);
  console.log(`${"=".repeat(60)}`);

  // Build output structure compatible with solwallets.json / bscwallets.json
  const output = {
    meta: {
      startedAt,
      finishedAt,
      chain: CHAIN,
      source: GMGN_TRADE_URL,
      version: "v1",
      scraper: "scrape-gmgn-monad.js",
    },
    interceptor: {
      walletsAll: allWallets.length,
      directApiCategories: apiResult.stats,
      browserApiCount: browserResult.wallets.length,
    },
    smartMoney: {
      wallets: apiResult.wallets,
      meta: {
        chain: CHAIN,
        startedAt,
      },
    },
    walletDetails: apiResult.walletDetails,
    // Flat list of all unique wallets (convenience field)
    allWallets,
  };

  // Save JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved JSON → ${OUTPUT_FILE}`);

  // Save plain wallet addresses
  const addresses = allWallets
    .map((w) => w.wallet_address || w.address)
    .filter(Boolean);
  fs.writeFileSync(WALLETS_FILE, addresses.join("\n") + "\n");
  console.log(`Saved wallet list (${addresses.length} addresses) → ${WALLETS_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
