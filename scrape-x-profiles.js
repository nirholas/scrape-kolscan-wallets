/**
 * Scrape X/Twitter profile data for all KOLs.
 *
 * Usage:
 *   X_AUTH_TOKEN=your_auth_token node scrape-x-profiles.js
 *
 * The auth token is your x.com auth_token cookie.
 * Browser DevTools → Application → Cookies → x.com → auth_token
 *
 * Output: site/data/x-profiles.json
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import only constants and the parser from xactions (the client wrappers have bugs)
import {
  GRAPHQL,
  BEARER_TOKEN,
  buildGraphQLUrl,
  parseUserData,
} from "xactions/scrapers/twitter/http";

// User profile feature flags (from Twitter's web client)
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
// 1. Collect all unique Twitter usernames from our data
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
          const match = entry.twitter.match(
            /(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/
          );
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
      const extractFromWallets = (wallets) => {
        if (!Array.isArray(wallets)) return;
        for (const w of wallets) {
          if (w.twitter_username) {
            usernames.add(w.twitter_username.toLowerCase());
          }
        }
      };

      if (raw.smartMoney?.wallets) {
        for (const list of Object.values(raw.smartMoney.wallets)) {
          extractFromWallets(list);
        }
      }
      if (raw.kol?.wallets) extractFromWallets(raw.kol.wallets);
    }
  }

  return [...usernames].filter(
    (u) => u && u.length > 0 && !u.includes("/") && !u.includes("?")
  );
}

// --------------------------------------------------------------------------
// 2. Direct Twitter GraphQL profile fetcher
// --------------------------------------------------------------------------
const BEARER = decodeURIComponent(BEARER_TOKEN);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Bootstrap a session — get a valid ct0 CSRF token from Twitter.
 * Twitter uses double-submit cookies: ct0 cookie must match x-csrf-token header.
 */
async function bootstrapSession(authToken) {
  // Try fetching x.com to get ct0 from set-cookie
  try {
    const res = await fetch("https://x.com/i/api/1.1/account/verify_credentials.json", {
      headers: {
        authorization: `Bearer ${BEARER}`,
        cookie: `auth_token=${authToken}; ct0=probe`,
        "x-csrf-token": "probe",
        "user-agent": UA,
      },
    });

    // Even on 403, Twitter often sets ct0 in response cookies
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      const m = c.match(/ct0=([^;]+)/);
      if (m && m[1] !== "probe") return m[1];
    }
  } catch {}

  // Fallback: hit x.com homepage
  try {
    const res = await fetch("https://x.com/home", {
      headers: {
        cookie: `auth_token=${authToken}`,
        "user-agent": UA,
      },
      redirect: "manual",
    });

    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      const m = c.match(/ct0=([^;]+)/);
      if (m) return m[1];
    }
  } catch {}

  // Last resort: generate our own ct0 (double-submit just needs matching values)
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Fetch a single profile via Twitter's GraphQL UserByScreenName endpoint.
 */
async function fetchProfile(authToken, ct0, username) {
  const { queryId, operationName } = GRAPHQL.UserByScreenName;
  const variables = {
    screen_name: username,
    withSafetyModeUserFields: true,
  };

  // Use USER_FEATURES (specific to profile queries) if available, else fallback
  const features = USER_FEATURES || {};

  const url = buildGraphQLUrl(queryId, operationName, variables, features);

  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${BEARER}`,
      cookie: `auth_token=${authToken}; ct0=${ct0}`,
      "x-csrf-token": ct0,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
      "content-type": "application/json",
      "user-agent": UA,
    },
  });

  if (res.status === 429) {
    const resetHeader = res.headers.get("x-rate-limit-reset");
    const resetMs = resetHeader ? parseInt(resetHeader) * 1000 - Date.now() : 60000;
    throw new Error(`rate limited (429), resets in ${Math.ceil(resetMs / 1000)}s`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`auth failed (${res.status}) — token may be expired`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();

  // Check for GraphQL errors
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const result = json?.data?.user?.result;
  if (!result) {
    throw new Error(`@${username} not found`);
  }
  if (result.__typename === "UserUnavailable") {
    throw new Error(`@${username} suspended/unavailable`);
  }

  // Use xactions' parser for clean output
  return parseUserData(result);
}

// --------------------------------------------------------------------------
// 3. Main scraping loop
// --------------------------------------------------------------------------
async function scrapeProfiles(usernames) {
  const authToken = process.env.X_AUTH_TOKEN;
  if (!authToken) {
    console.error("❌ X_AUTH_TOKEN environment variable required.");
    console.error("   Set it to your x.com auth_token cookie value.");
    console.error("   Browser DevTools → Application → Cookies → x.com → auth_token");
    process.exit(1);
  }

  // Load existing profiles to resume
  const outputPath = path.join(__dirname, "site/data/x-profiles.json");
  let existing = {};
  if (fs.existsSync(outputPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      console.log(`📂 Loaded ${Object.keys(existing).length} existing profiles`);
    } catch {
      existing = {};
    }
  }

  // Skip already scraped (unless older than 7 days)
  const STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const toScrape = usernames.filter((u) => {
    const ex = existing[u];
    if (!ex) return true;
    if (ex.scrapedAt && now - new Date(ex.scrapedAt).getTime() < STALE_MS)
      return false;
    return true;
  });

  console.log(
    `\n🎯 ${usernames.length} total usernames, ${toScrape.length} to scrape (${usernames.length - toScrape.length} cached)\n`
  );

  if (toScrape.length === 0) {
    console.log("✅ All profiles up to date!");
    return existing;
  }

  // Bootstrap session
  console.log("🔑 Bootstrapping Twitter session...");
  const ct0 = await bootstrapSession(authToken);
  console.log(`✅ Got ct0 token: ${ct0.slice(0, 8)}...`);

  // Test with a known account
  try {
    const test = await fetchProfile(authToken, ct0, "elonmusk");
    console.log(`✅ Session working — test: @${test.username} (${test.followers} followers)\n`);
  } catch (e) {
    console.error(`❌ Session test failed: ${e.message}`);
    console.error("   Your auth_token may be expired. Get a fresh one from your browser.");
    process.exit(1);
  }

  const results = { ...existing };
  let success = 0;
  let failed = 0;

  for (let i = 0; i < toScrape.length; i++) {
    const username = toScrape[i];
    const progress = `[${i + 1}/${toScrape.length}]`;

    try {
      const profile = await fetchProfile(authToken, ct0, username);

      results[username] = {
        username: profile.username || username,
        name: profile.name || null,
        bio: profile.bio || null,
        location: profile.location || null,
        website: profile.website || null,
        avatar: profile.avatar || null,
        header: profile.header || null,
        followers: profile.followers ?? 0,
        following: profile.following ?? 0,
        tweets: profile.tweets ?? 0,
        verified: profile.verified || false,
        joinDate: profile.joined || null,
        scrapedAt: new Date().toISOString(),
      };

      success++;
      console.log(
        `${progress} ✅ @${username} — ${results[username].name} (${results[username].followers} followers)`
      );

      // Save every 10 profiles
      if (success % 10 === 0) {
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      }

      // Rate limit: ~1.5s between requests (95 req / 15 min ≈ 1 per 9.5s, but be conservative)
      await sleep(1500 + Math.random() * 1000);
    } catch (err) {
      failed++;
      const msg = err.message || String(err);
      if (msg.includes("not found") || msg.includes("suspended") || msg.includes("unavailable")) {
        console.log(`${progress} ⚠️  ${msg}`);
        results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
      } else if (msg.includes("rate") || msg.includes("429")) {
        // Extract wait time from error message if available
        const waitMatch = msg.match(/resets in (\d+)s/);
        const waitSecs = waitMatch ? Math.min(parseInt(waitMatch[1]) + 5, 900) : 60;
        console.log(`${progress} ⏳ Rate limited, waiting ${waitSecs}s...`);
        await sleep(waitSecs * 1000);
        i--; // retry
        failed--;
      } else if (msg.includes("auth failed") || msg.includes("expired")) {
        console.error(`\n❌ ${msg}`);
        console.error("   Get a fresh auth_token from your browser and retry.");
        // Save what we have so far
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`📁 Saved ${Object.keys(results).length} profiles before exit`);
        process.exit(1);
      } else {
        console.log(`${progress} ❌ @${username} — ${msg}`);
        results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
      }
    }
  }

  // Final save
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(
    `\n✅ Done! ${success} scraped, ${failed} failed, ${Object.keys(results).length} total profiles`
  );
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
