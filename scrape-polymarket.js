#!/usr/bin/env node
/**
 * Polymarket Leaderboard Scraper
 *
 * Scrapes trader leaderboard and market data from Polymarket APIs.
 * Outputs: site/data/polymarket-leaderboard.json
 *
 * Usage: node scrape-polymarket.js
 *
 * APIs used (all public, no key required):
 * - Data API: https://data-api.polymarket.com
 * - Gamma API: https://gamma-api.polymarket.com
 */

const fs = require("fs");
const path = require("path");

const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

const OUTPUT_FILE = path.join(__dirname, "site", "data", "polymarket-leaderboard.json");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://polymarket.com",
  Referer: "https://polymarket.com/",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.log(`  [WARN] ${url} returned ${res.status}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.log(`  [ERR] ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Map raw leaderboard entry to our PolymarketTrader format
 */
function mapTrader(raw, rank) {
  return {
    wallet_address: raw.address || raw.user || raw.proxyWallet || "",
    username: raw.username || raw.name || null,
    display_name: raw.displayName || raw.display_name || raw.name || null,
    profile_image: raw.profileImage || raw.avatar || raw.pfp || null,
    bio: raw.bio || null,
    twitter_handle: raw.twitterHandle || raw.twitter || null,
    rank,

    // PnL
    pnl_total: parseFloat(raw.pnl) || parseFloat(raw.profit) || parseFloat(raw.totalPnl) || 0,
    pnl_7d: parseFloat(raw.pnl_7d) || parseFloat(raw.weeklyPnl) || 0,
    pnl_30d: parseFloat(raw.pnl_30d) || parseFloat(raw.monthlyPnl) || 0,
    pnl_ytd: parseFloat(raw.pnl_ytd) || parseFloat(raw.ytdPnl) || 0,

    // Volume
    volume_total: parseFloat(raw.volume) || parseFloat(raw.totalVolume) || 0,
    volume_7d: parseFloat(raw.volume_7d) || parseFloat(raw.weeklyVolume) || 0,
    volume_30d: parseFloat(raw.volume_30d) || parseFloat(raw.monthlyVolume) || 0,

    // Stats
    trades_count: raw.tradesCount || raw.trades || raw.numTrades || 0,
    markets_traded: raw.marketsTraded || raw.markets || raw.numMarkets || 0,
    positions_count: raw.positionsCount || raw.positions || raw.numPositions || 0,

    // Win rate
    winrate: parseFloat(raw.winRate) || parseFloat(raw.winrate) || 0,
    profit_factor: parseFloat(raw.profitFactor) || 0,

    // Social
    followers_count: raw.followersCount || raw.followers || 0,
    last_trade_at: raw.lastTradeAt || raw.lastTrade || raw.lastActive || null,
    created_at: raw.createdAt || raw.joinDate || null,

    // Tags
    tags: raw.tags || raw.badges || [],
  };
}

/**
 * Map raw market to our PolymarketMarket format
 */
function mapMarket(raw) {
  return {
    id: raw.id || raw.conditionId || raw.condition_id || "",
    condition_id: raw.conditionId || raw.condition_id || raw.id || "",
    slug: raw.slug || "",
    question: raw.question || raw.title || "",
    description: raw.description || null,
    category: raw.category || raw.tag || "other",
    end_date: raw.endDate || raw.end_date || raw.endDateIso || null,

    outcomes: raw.outcomes || raw.outcomePrices ? Object.keys(raw.outcomePrices || {}) : ["Yes", "No"],
    outcome_prices: raw.outcomePrices 
      ? Object.values(raw.outcomePrices).map(Number)
      : [parseFloat(raw.bestBid) || 0.5, 1 - (parseFloat(raw.bestBid) || 0.5)],

    volume: parseFloat(raw.volume) || parseFloat(raw.umaVolume) || 0,
    liquidity: parseFloat(raw.liquidity) || 0,
    open_interest: parseFloat(raw.openInterest) || parseFloat(raw.open_interest) || 0,

    active: raw.active !== false && !raw.closed && !raw.resolved,
    closed: raw.closed || false,
    resolved: raw.resolved || false,
    resolution_outcome: raw.resolutionOutcome || raw.resolution || null,

    image: raw.image || raw.icon || null,
    icon: raw.icon || null,
  };
}

async function scrape() {
  console.log("=".repeat(60));
  console.log("  Polymarket Leaderboard Scraper");
  console.log("  " + new Date().toISOString());
  console.log("=".repeat(60));

  const traders = [];
  const markets = [];
  const seenAddresses = new Set();

  // ────────────────────────────────────────────────────────────
  // 1. Fetch main leaderboard
  // ────────────────────────────────────────────────────────────
  console.log("\n[1] Fetching leaderboard...");
  
  const leaderboard = await fetchJSON(`${DATA_API}/leaderboard?limit=500`);
  if (Array.isArray(leaderboard)) {
    console.log(`    Found ${leaderboard.length} traders on main leaderboard`);
    for (let i = 0; i < leaderboard.length; i++) {
      const t = mapTrader(leaderboard[i], i + 1);
      if (t.wallet_address && !seenAddresses.has(t.wallet_address.toLowerCase())) {
        traders.push(t);
        seenAddresses.add(t.wallet_address.toLowerCase());
      }
    }
  }
  await sleep(500);

  // ────────────────────────────────────────────────────────────
  // 2. Fetch 7d and 30d leaderboards for additional context
  // ────────────────────────────────────────────────────────────
  console.log("\n[2] Fetching weekly/monthly leaderboards...");

  const leaderboard7d = await fetchJSON(`${DATA_API}/leaderboard?window=7d&limit=200`);
  if (Array.isArray(leaderboard7d)) {
    console.log(`    Found ${leaderboard7d.length} traders on 7d leaderboard`);
    for (let i = 0; i < leaderboard7d.length; i++) {
      const addr = (leaderboard7d[i].address || leaderboard7d[i].user || "").toLowerCase();
      // Update existing trader's 7d data
      const existing = traders.find((t) => t.wallet_address.toLowerCase() === addr);
      if (existing && leaderboard7d[i].pnl) {
        existing.pnl_7d = parseFloat(leaderboard7d[i].pnl) || existing.pnl_7d;
      } else if (!seenAddresses.has(addr) && addr) {
        const t = mapTrader(leaderboard7d[i], traders.length + 1);
        traders.push(t);
        seenAddresses.add(addr);
      }
    }
  }
  await sleep(300);

  const leaderboard30d = await fetchJSON(`${DATA_API}/leaderboard?window=30d&limit=200`);
  if (Array.isArray(leaderboard30d)) {
    console.log(`    Found ${leaderboard30d.length} traders on 30d leaderboard`);
    for (let i = 0; i < leaderboard30d.length; i++) {
      const addr = (leaderboard30d[i].address || leaderboard30d[i].user || "").toLowerCase();
      const existing = traders.find((t) => t.wallet_address.toLowerCase() === addr);
      if (existing && leaderboard30d[i].pnl) {
        existing.pnl_30d = parseFloat(leaderboard30d[i].pnl) || existing.pnl_30d;
      } else if (!seenAddresses.has(addr) && addr) {
        const t = mapTrader(leaderboard30d[i], traders.length + 1);
        traders.push(t);
        seenAddresses.add(addr);
      }
    }
  }
  await sleep(300);

  // ────────────────────────────────────────────────────────────
  // 3. Try to get profiles for top traders
  // ────────────────────────────────────────────────────────────
  console.log("\n[3] Enriching top trader profiles...");
  
  const topN = Math.min(30, traders.length);
  for (let i = 0; i < topN; i++) {
    const t = traders[i];
    const profile = await fetchJSON(`${GAMMA_API}/profiles/${t.wallet_address}`);
    if (profile) {
      t.username = t.username || profile.username || profile.name || null;
      t.display_name = t.display_name || profile.displayName || profile.name || null;
      t.profile_image = t.profile_image || profile.profileImage || profile.avatar || null;
      t.bio = t.bio || profile.bio || null;
      t.twitter_handle = t.twitter_handle || profile.twitterHandle || profile.twitter || null;
    }
    await sleep(150);
    if ((i + 1) % 10 === 0) {
      console.log(`    Processed ${i + 1}/${topN} profiles`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 4. Fetch active markets
  // ────────────────────────────────────────────────────────────
  console.log("\n[4] Fetching active markets...");
  
  const activeMarkets = await fetchJSON(`${GAMMA_API}/markets?limit=200&active=true&order=volume&ascending=false`);
  if (Array.isArray(activeMarkets)) {
    console.log(`    Found ${activeMarkets.length} active markets`);
    for (const m of activeMarkets) {
      markets.push(mapMarket(m));
    }
  }
  await sleep(300);

  // ────────────────────────────────────────────────────────────
  // 5. Save output
  // ────────────────────────────────────────────────────────────
  console.log("\n[5] Saving data...");

  const output = {
    meta: {
      scrapedAt: new Date().toISOString(),
      source: "polymarket",
      totalTraders: traders.length,
      totalMarkets: markets.length,
    },
    traders,
    markets,
  };

  // Ensure directory exists
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`    Saved to ${OUTPUT_FILE}`);

  // Also write to root for backwards compat
  const rootFile = path.join(__dirname, "polymarket-leaderboard.json");
  fs.writeFileSync(rootFile, JSON.stringify(output, null, 2));
  console.log(`    Saved to ${rootFile}`);

  console.log("\n" + "=".repeat(60));
  console.log(`  Done! ${traders.length} traders, ${markets.length} markets`);
  console.log("=".repeat(60));
}

scrape().catch(console.error);
