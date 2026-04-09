/**
 * Scrape X/Twitter profile data for all KOLs using xactions.
 *
 * Usage:
 *   # With auth token (recommended — higher rate limits):
 *   X_AUTH_TOKEN=your_auth_token node scrape-x-profiles.js
 *
 *   # Without auth (guest tokens — works for public profiles):
 *   node scrape-x-profiles.js
 *
 * Output: site/data/x-profiles.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// xactions HTTP-based scraper (no browser needed)
import {
  TwitterHttpClient,
  GuestTokenManager,
  scrapeProfile,
  GRAPHQL,
  BEARER_TOKEN,
  DEFAULT_FEATURES,
  buildGraphQLUrl,
  parseUserData,
} from "xactions/scrapers/twitter/http";

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

      // SmartMoney categories
      if (raw.smartMoney?.wallets) {
        for (const list of Object.values(raw.smartMoney.wallets)) {
          extractFromWallets(list);
        }
      }
      // KOL wallets
      if (raw.kol?.wallets) extractFromWallets(raw.kol.wallets);
    }
  }

  return [...usernames].filter(
    (u) => u && u.length > 0 && !u.includes("/") && !u.includes("?")
  );
}

// --------------------------------------------------------------------------
// 2. Scrape profiles with rate limiting
// --------------------------------------------------------------------------
async function scrapeProfiles(usernames) {
  const authToken = process.env.X_AUTH_TOKEN;
  if (!authToken) {
    console.error("❌ X_AUTH_TOKEN environment variable required.");
    console.error(
      "   Set it to your x.com auth_token cookie value."
    );
    console.error(
      "   Browser DevTools → Application → Cookies → x.com → auth_token"
    );
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

  // Create HTTP client
  const client = new TwitterHttpClient({
    cookies: `auth_token=${authToken}`,
    rateLimitStrategy: "wait",
  });

  const results = { ...existing };
  let success = 0;
  let failed = 0;

  for (let i = 0; i < toScrape.length; i++) {
    const username = toScrape[i];
    const progress = `[${i + 1}/${toScrape.length}]`;

    try {
      let profile;
      try {
        profile = await scrapeProfile(client, username);
      } catch {
        // Fallback: direct GraphQL fetch
        profile = await fetchProfileDirect(authToken, username);
      }

      results[username] = {
        username: profile.username || username,
        name: profile.name || null,
        bio: profile.bio || null,
        location: profile.location || null,
        website: profile.website || null,
        avatar: profile.avatar || profile.profileImageUrl || null,
        header: profile.header || profile.bannerImageUrl || null,
        followers: profile.followers ?? profile.followersCount ?? 0,
        following: profile.following ?? profile.followingCount ?? 0,
        tweets: profile.tweets ?? profile.tweetsCount ?? 0,
        verified: profile.verified || false,
        joinDate: profile.joined || profile.joinDate || null,
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

      // Rate limit: ~1 request per 2 seconds to be safe
      await sleep(2000 + Math.random() * 1000);
    } catch (err) {
      failed++;
      const msg = err.message || String(err);
      if (msg.includes("not found") || msg.includes("suspended")) {
        console.log(`${progress} ⚠️  @${username} — ${msg}`);
        results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
      } else if (msg.includes("rate") || msg.includes("429")) {
        console.log(`${progress} ⏳ Rate limited, waiting 60s...`);
        await sleep(60000);
        i--; // retry
        failed--;
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

// --------------------------------------------------------------------------
// Fallback: direct GraphQL fetch (if xactions HTTP module doesn't load)
// --------------------------------------------------------------------------
async function fetchProfileDirect(authToken, username) {
  const variables = JSON.stringify({
    screen_name: username,
    withSafetyModeUserFields: true,
  });
  const features = JSON.stringify({
    hidden_profile_subscriptions_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  });

  const url = `https://x.com/i/api/graphql/BQ6xjFU6Mgm-WhEP3OiT9w/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

  const res = await fetch(url, {
    headers: {
      Authorization:
        "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
      Cookie: `auth_token=${authToken}`,
      "x-csrf-token": authToken,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("rate limited (429)");
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();
  const result = json?.data?.user?.result;
  if (!result || result.__typename === "UserUnavailable") {
    throw new Error("User not found or suspended");
  }

  const legacy = result.legacy || {};
  return {
    name: legacy.name || "",
    username: legacy.screen_name || username,
    bio: legacy.description || "",
    location: legacy.location || "",
    website: legacy.entities?.url?.urls?.[0]?.expanded_url || "",
    joined: legacy.created_at || "",
    followers: legacy.followers_count ?? 0,
    following: legacy.friends_count ?? 0,
    tweets: legacy.statuses_count ?? 0,
    avatar: (legacy.profile_image_url_https || "").replace("_normal", "_400x400"),
    header: legacy.profile_banner_url || "",
    verified: Boolean(result.is_blue_verified || legacy.verified),
  };
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
