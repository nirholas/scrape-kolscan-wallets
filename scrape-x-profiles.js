/**
 * Scrape X/Twitter profile data for all KOLs — no auth token required.
 *
 * Strategy: use Playwright once to load x.com and harvest real guest session
 * cookies/tokens, then use those for fast direct API calls (no browser overhead
 * per profile). Refreshes the session automatically when X blocks us.
 *
 * Usage:
 *   node scrape-x-profiles.js
 *
 * Ctrl+C anytime — re-run and it resumes from where it left off.
 * Output: site/data/x-profiles.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GRAPHQL_BASE = "https://x.com/i/api/graphql";
const QUERY_ID = "NimuplG1OB7Fd2btCLdBOw"; // UserByScreenName
const BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const USER_FEATURES = {
  hidden_profile_likes_enabled: true,
  hidden_profile_subscriptions_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
};

// --------------------------------------------------------------------------
// 1. Collect all unique Twitter usernames from our data files
// --------------------------------------------------------------------------
function extractUsernames() {
  const usernames = new Set();

  for (const filepath of [
    path.join(__dirname, "site/data/kolscan-leaderboard.json"),
    path.join(__dirname, "output/kolscan-leaderboard.json"),
  ]) {
    if (fs.existsSync(filepath)) {
      const data = JSON.parse(fs.readFileSync(filepath, "utf-8"));
      for (const entry of data) {
        if (entry.twitter) {
          const match = entry.twitter.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/);
          if (match) usernames.add(match[1].toLowerCase());
        }
      }
    }
  }

  for (const filepath of [
    path.join(__dirname, "site/data/solwallets.json"),
    path.join(__dirname, "solwallets.json"),
    path.join(__dirname, "site/data/bscwallets.json"),
    path.join(__dirname, "bscwallets.json"),
  ]) {
    if (fs.existsSync(filepath)) {
      const raw = JSON.parse(fs.readFileSync(filepath, "utf-8"));
      const extract = (wallets) => {
        if (!Array.isArray(wallets)) return;
        for (const w of wallets) {
          if (w.twitter_username) usernames.add(w.twitter_username.toLowerCase());
        }
      };
      if (raw.smartMoney?.wallets) {
        for (const list of Object.values(raw.smartMoney.wallets)) extract(list);
      }
      if (raw.kol?.wallets) extract(raw.kol.wallets);
    }
  }

  return [...usernames].filter((u) => u && u.length > 0 && !u.includes("/") && !u.includes("?"));
}

// --------------------------------------------------------------------------
// 2. Use Playwright to harvest real working request headers from x.com
//    by intercepting an actual outgoing GraphQL request.
// --------------------------------------------------------------------------
async function harvestSession() {
  console.log("  Launching browser to harvest session headers...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, locale: "en-US" });
  const page = await context.newPage();

  let harvestedHeaders = null;

  // Intercept an outgoing GraphQL request and steal its headers
  await page.route("**/graphql/**", async (route) => {
    const req = route.request();
    if (!harvestedHeaders) {
      harvestedHeaders = req.headers();
    }
    await route.continue();
  });

  // Load a well-known public profile to trigger a GraphQL request
  await page.goto("https://x.com/elonmusk", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // Wait up to 8s for the GraphQL request to fire
  for (let i = 0; i < 40 && !harvestedHeaders; i++) await sleep(200);

  await browser.close();

  if (!harvestedHeaders) throw new Error("Failed to harvest session — no GraphQL request observed");

  console.log(`  Got headers — keys: ${Object.keys(harvestedHeaders).join(", ")}`);
  return harvestedHeaders;
}

// --------------------------------------------------------------------------
// 3. Direct API call using harvested session headers
// --------------------------------------------------------------------------
async function fetchProfile(session, username) {
  const params = new URLSearchParams();
  params.set("variables", JSON.stringify({ screen_name: username, withSafetyModeUserFields: true }));
  params.set("features", JSON.stringify(USER_FEATURES));
  const url = `${GRAPHQL_BASE}/${QUERY_ID}/UserByScreenName?${params}`;

  // Use the real headers captured from the browser — guaranteed to work
  const res = await fetch(url, { headers: session });

  if (res.status === 429) {
    const reset = res.headers.get("x-rate-limit-reset");
    const waitSec = reset ? Math.max(parseInt(reset) - Math.floor(Date.now() / 1000), 5) : 60;
    throw new Error(`RATE_LIMIT:${waitSec}`);
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    throw new Error(`AUTH_FAIL:${res.status}:${body.slice(0, 100)}`);
  }
  if (!res.ok) throw new Error(`HTTP_${res.status}`);

  const json = await res.json();
  if (json.errors?.length) throw new Error(`GQL:${json.errors.map((e) => e.message).join("; ")}`);

  const result = json?.data?.user?.result;
  if (!result) throw new Error(`NOT_FOUND:@${username}`);
  if (result.__typename === "UserUnavailable") throw new Error(`UNAVAILABLE:@${username}:${result.reason || ""}`);

  return parseUserResult(result, username);
}

// --------------------------------------------------------------------------
// 4. Parse raw GraphQL result into a clean profile object
// --------------------------------------------------------------------------
function parseUserResult(result, username) {
  const legacy = result.legacy || {};
  const descUrls = legacy.entities?.description?.urls || [];
  const websiteUrl =
    legacy.entities?.url?.urls?.[0]?.expanded_url ||
    legacy.entities?.url?.urls?.[0]?.url ||
    legacy.url ||
    null;

  let bio = legacy.description || "";
  for (const u of descUrls) {
    if (u.url && u.expanded_url) bio = bio.replace(u.url, u.expanded_url);
  }

  let avatar = legacy.profile_image_url_https || null;
  if (avatar) avatar = avatar.replace(/_normal\./, "_400x400.");

  return {
    id: result.rest_id || null,
    username: legacy.screen_name || username,
    name: legacy.name || "",
    bio: bio || null,
    location: legacy.location || null,
    website: websiteUrl,
    avatar,
    header: legacy.profile_banner_url || null,
    followers: legacy.followers_count ?? 0,
    following: legacy.friends_count ?? 0,
    tweets: legacy.statuses_count ?? 0,
    likes: legacy.favourites_count ?? 0,
    media: legacy.media_count ?? 0,
    verified: Boolean(result.is_blue_verified || legacy.verified),
    protected: Boolean(legacy.protected),
    joinDate: legacy.created_at || null,
    pinnedTweetId: (legacy.pinned_tweet_ids_str || [])[0] || null,
  };
}

// --------------------------------------------------------------------------
// 5. Main scraping loop
// --------------------------------------------------------------------------
async function scrapeProfiles(usernames) {
  const outputPath = path.join(__dirname, "site/data/x-profiles.json");

  let existing = {};
  if (fs.existsSync(outputPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      if (Object.keys(existing).length > 0)
        console.log(`📂 Loaded ${Object.keys(existing).length} existing profiles`);
    } catch { existing = {}; }
  }

  const STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const toScrape = usernames.filter((u) => {
    const ex = existing[u];
    if (!ex || ex.error) return true;
    if (ex.scrapedAt && now - new Date(ex.scrapedAt).getTime() < STALE_MS) return false;
    return true;
  });

  console.log(`\n🎯 ${usernames.length} total, ${toScrape.length} to scrape (${usernames.length - toScrape.length} cached)\n`);
  if (toScrape.length === 0) { console.log("✅ All profiles up to date!"); return existing; }

  const results = { ...existing };
  const saveToDisk = () => fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  process.on("SIGINT", () => {
    console.log(`\n\n⚡ Interrupted! Saving ${Object.keys(results).length} profiles...`);
    saveToDisk();
    console.log(`📁 Saved to ${outputPath}\n   Re-run to resume.\n`);
    process.exit(0);
  });

  // Harvest initial session
  console.log("🔑 Harvesting session headers from x.com...");
  let session = await harvestSession();
  let sessionUses = 0;
  const SESSION_ROTATE_AFTER = 80;

  let refreshing = false;
  async function getSession() {
    if (sessionUses >= SESSION_ROTATE_AFTER && !refreshing) {
      refreshing = true;
      console.log(`\n🔄 Rotating session after ${sessionUses} uses...`);
      session = await harvestSession();
      sessionUses = 0;
      refreshing = false;
      console.log("✅ Fresh session ready\n");
    }
    while (refreshing) await sleep(300);
    sessionUses++;
    return session;
  }

  const CONCURRENCY = 20; // many parallel requests — no browser overhead now
  let success = 0;
  let failed = 0;
  let completed = 0;
  const queue = [...toScrape];

  async function worker() {
    while (queue.length > 0) {
      const username = queue.shift();
      if (!username) break;
      const idx = toScrape.length - queue.length - 1;
      const progress = `[${idx + 1}/${toScrape.length}]`;

      try {
        const s = await getSession();
        const profile = await fetchProfile(s, username);
        results[username] = { ...profile, scrapedAt: new Date().toISOString() };
        success++;
        completed++;
        console.log(`${progress} ✅ @${username} — ${profile.name} (${profile.followers.toLocaleString()} followers)`);
        if (completed % 20 === 0) saveToDisk();

        // Small delay to avoid hammering
        await sleep(150 + Math.random() * 100);
      } catch (err) {
        const msg = err.message || String(err);
        completed++;

        if (msg.startsWith("NOT_FOUND") || msg.startsWith("UNAVAILABLE")) {
          console.log(`${progress} ⚠️  ${msg}`);
          results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
          failed++;
        } else if (msg.startsWith("RATE_LIMIT")) {
          const waitSec = Math.min(parseInt(msg.split(":")[1]) || 60, 900);
          queue.unshift(username);
          completed--;
          saveToDisk();
          console.log(`${progress} ⏳ Rate limited — waiting ${waitSec}s...`);
          await sleep(waitSec * 1000);
        } else if (msg.startsWith("AUTH_FAIL")) {
          // Session rejected — force refresh and retry
          queue.unshift(username);
          completed--;
          if (!refreshing) {
            refreshing = true;
            saveToDisk();
            console.log(`\n🔄 Auth failed — refreshing session...`);
            session = await harvestSession();
            sessionUses = 0;
            refreshing = false;
            console.log("✅ Fresh session ready\n");
          } else {
            await sleep(1000);
          }
        } else {
          console.log(`${progress} ❌ @${username} — ${msg}`);
          results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
          failed++;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  saveToDisk();
  console.log(`\n✅ Done! ${success} scraped, ${failed} failed, ${Object.keys(results).length} total`);
  console.log(`📁 Saved to ${outputPath}`);
  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
const usernames = extractUsernames();
console.log(`📋 Found ${usernames.length} unique X usernames across all data sources`);
console.log(`   Sample: ${usernames.slice(0, 5).map((u) => "@" + u).join(", ")}...`);

await scrapeProfiles(usernames);
