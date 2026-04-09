/**
 * Scrape X/Twitter profile data for all KOLs — no auth token required.
 *
 * Uses Playwright to load public X profile pages and intercept the GraphQL
 * responses that X's own JS makes. Since public profiles are viewable without
 * login, no credentials are needed.
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

// --------------------------------------------------------------------------
// 1. Collect all unique Twitter usernames from our data files
// --------------------------------------------------------------------------
function extractUsernames() {
  const usernames = new Set();

  // KolScan leaderboard
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

  // GMGN wallets
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
// 2. Parse a raw GraphQL UserByScreenName result into a clean profile object
// --------------------------------------------------------------------------
function parseUserResult(result, username) {
  if (!result) return null;
  if (result.__typename === "UserUnavailable") {
    throw new Error(`UNAVAILABLE:@${username}:${result.reason || ""}`);
  }

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

  // Upgrade avatar to full-size (remove _normal suffix)
  let avatar = legacy.profile_image_url_https || null;
  if (avatar) avatar = avatar.replace(/_normal\./, ".");

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
// 3. Main scraping loop using Playwright
// --------------------------------------------------------------------------
async function scrapeProfiles(usernames) {
  const outputPath = path.join(__dirname, "site/data/x-profiles.json");

  // Load existing profiles to resume
  let existing = {};
  if (fs.existsSync(outputPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      if (Object.keys(existing).length > 0) {
        console.log(`📂 Loaded ${Object.keys(existing).length} existing profiles`);
      }
    } catch {
      existing = {};
    }
  }

  // Skip already scraped (unless older than 7 days or errored)
  const STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const toScrape = usernames.filter((u) => {
    const ex = existing[u];
    if (!ex || ex.error) return true;
    if (ex.scrapedAt && now - new Date(ex.scrapedAt).getTime() < STALE_MS) return false;
    return true;
  });

  console.log(`\n🎯 ${usernames.length} total usernames, ${toScrape.length} to scrape (${usernames.length - toScrape.length} cached)\n`);

  if (toScrape.length === 0) {
    console.log("✅ All profiles up to date!");
    return existing;
  }

  const results = { ...existing };
  const saveToDisk = () => fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  process.on("SIGINT", () => {
    console.log(`\n\n⚡ Interrupted! Saving ${Object.keys(results).length} profiles...`);
    saveToDisk();
    console.log(`📁 Saved to ${outputPath}`);
    console.log(`   Re-run to resume from where you left off.\n`);
    process.exit(0);
  });

  const CONCURRENCY = 6; // parallel browser pages
  const SESSION_LIMIT = 100; // rotate context after this many requests
  let success = 0;
  let failed = 0;
  let completed = 0;

  console.log("🚀 Launching browser...");
  const browser = await chromium.launch({ headless: true });

  async function makeContext() {
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
    });
    // Block images/media/fonts — we only need the API responses
    await ctx.route("**/*.{png,jpg,jpeg,gif,webp,svg,mp4,woff,woff2,ttf,otf}", (route) => route.abort());
    return ctx;
  }

  // Shared context state — rotated when X starts showing the login wall
  let sharedCtx = await makeContext();
  let ctxRequestCount = 0;
  let rotating = false;

  async function getContext() {
    // Proactively rotate after SESSION_LIMIT requests to avoid login wall
    if (ctxRequestCount >= SESSION_LIMIT && !rotating) {
      rotating = true;
      console.log(`\n🔄 Rotating browser session after ${ctxRequestCount} requests...`);
      const oldCtx = sharedCtx;
      sharedCtx = await makeContext();
      ctxRequestCount = 0;
      rotating = false;
      await oldCtx.close().catch(() => {});
      console.log("✅ Fresh session ready\n");
    }
    // Wait if rotation is in progress
    while (rotating) await sleep(200);
    ctxRequestCount++;
    return sharedCtx;
  }

  // Work queue — process toScrape with a fixed-size pool of parallel workers
  const queue = [...toScrape];

  async function worker() {
    while (queue.length > 0) {
      const username = queue.shift();
      if (!username) break;
      const idx = toScrape.length - queue.length - 1;
      const progress = `[${idx + 1}/${toScrape.length}]`;

      try {
        const ctx = await getContext();
        const profile = await scrapeOne(ctx, username);
        results[username] = { ...profile, scrapedAt: new Date().toISOString() };
        success++;
        completed++;
        console.log(`${progress} ✅ @${username} — ${profile.name} (${profile.followers.toLocaleString()} followers)`);
        if (completed % 10 === 0) saveToDisk();
      } catch (err) {
        const msg = err.message || String(err);
        completed++;

        if (msg.startsWith("NOT_FOUND") || msg.startsWith("UNAVAILABLE") || msg.startsWith("SUSPENDED")) {
          console.log(`${progress} ⚠️  ${msg}`);
          results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
          failed++;
        } else if (msg.includes("LOGIN_WALL")) {
          // Session got blocked — put back, force rotate, retry
          queue.unshift(username);
          completed--;
          if (!rotating) {
            rotating = true;
            saveToDisk();
            console.log(`\n🔄 Login wall detected — rotating session...`);
            const oldCtx = sharedCtx;
            sharedCtx = await makeContext();
            ctxRequestCount = 0;
            rotating = false;
            await oldCtx.close().catch(() => {});
            console.log("✅ Fresh session ready\n");
          } else {
            await sleep(2000);
          }
        } else if (msg.includes("RATE_LIMIT") || msg.includes("429")) {
          queue.unshift(username);
          completed--;
          saveToDisk();
          console.log(`${progress} ⏳ Rate limited. Pausing 60s...`);
          await sleep(60000);
        } else {
          console.log(`${progress} ❌ @${username} — ${msg}`);
          results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
          failed++;
        }
      }
    }
  }

  // Launch CONCURRENCY workers in parallel
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await browser.close();
  saveToDisk();
  console.log(`\n✅ Done! ${success} scraped, ${failed} failed, ${Object.keys(results).length} total profiles`);
  console.log(`📁 Saved to ${outputPath}`);
  return results;
}

/**
 * Scrape a single profile by navigating to the public X profile page
 * and intercepting the UserByScreenName GraphQL response.
 */
async function scrapeOne(context, username) {
  const page = await context.newPage();
  let profileData = null;
  let resolveProfile;

  const profilePromise = new Promise((res) => {
    resolveProfile = res;
  });

  // Intercept the GraphQL response X's own JS makes when loading a profile
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("UserByScreenName") && !url.includes("UserResultByScreenName")) return;
    try {
      const json = await response.json();
      const result =
        json?.data?.user?.result ||
        json?.data?.user_result_by_screen_name?.result;
      if (result) {
        resolveProfile(result);
      }
    } catch {
      // not JSON or wrong shape — ignore
    }
  });

  try {
    await page.goto(`https://x.com/${username}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Wait up to 12s for the GraphQL response to be intercepted
    const result = await Promise.race([
      profilePromise,
      sleep(12000).then(() => null),
    ]);

    if (!result) {
      const finalUrl = page.url();
      // Login wall — X redirected us to the sign-in flow
      if (finalUrl.includes("/login") || finalUrl.includes("/i/flow/login")) {
        throw new Error(`LOGIN_WALL:@${username}`);
      }
      const bodyText = await page.textContent("body").catch(() => "");
      if (bodyText.includes("Account suspended")) throw new Error(`SUSPENDED:@${username}`);
      if (bodyText.includes("doesn't exist") || bodyText.includes("This account")) {
        throw new Error(`NOT_FOUND:@${username}`);
      }
      // Check for login wall in body text too
      if (bodyText.includes("Sign in to X") || bodyText.includes("Log in to X")) {
        throw new Error(`LOGIN_WALL:@${username}`);
      }
      throw new Error(`TIMEOUT:@${username} — no GraphQL response intercepted`);
    }

    profileData = parseUserResult(result, username);
    if (!profileData) throw new Error(`PARSE_FAIL:@${username}`);
  } finally {
    await page.close();
  }

  return profileData;
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
