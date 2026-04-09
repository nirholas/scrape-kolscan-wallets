/**
 * Scrape X/Twitter profile data for all KOLs.
 *
 * Usage:
 *   node scrape-x-profiles.js                          # guest mode (no login needed)
 *   X_AUTH_TOKEN=your_auth_token node scrape-x-profiles.js  # authenticated mode
 *
 * Guest mode works for public profiles but has lower rate limits (~50/15min).
 * Auth mode has higher rate limits (~95/15min).
 * On rate limit the script saves progress and waits, then resumes.
 * You can Ctrl+C anytime — re-run and it picks up where it left off.
 *
 * Output: site/data/x-profiles.json
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Constants — fully self-contained, no xactions dependency
// ---------------------------------------------------------------------------
const BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const GRAPHQL_BASE = "https://x.com/i/api/graphql";
const QUERY_ID = "NimuplG1OB7Fd2btCLdBOw"; // UserByScreenName

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
// 2. Direct Twitter GraphQL profile fetcher — fully self-contained
// --------------------------------------------------------------------------
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Build headers for Twitter API requests (auth or guest mode). */
function twitterHeaders(authToken, ct0, guestToken) {
  const headers = {
    authorization: `Bearer ${decodeURIComponent(BEARER)}`,
    "x-csrf-token": ct0,
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
    "content-type": "application/json",
    "user-agent": UA,
  };
  if (authToken) {
    headers.cookie = `auth_token=${authToken}; ct0=${ct0}`;
    headers["x-twitter-auth-type"] = "OAuth2Session";
  } else {
    headers.cookie = `ct0=${ct0}`;
    if (guestToken) headers["x-guest-token"] = guestToken;
  }
  return headers;
}

/**
 * Try to activate a guest token (unauthenticated access).
 * Returns { ct0, guestToken } or null if it fails.
 */
async function bootstrapGuestSession() {
  const ct0 = crypto.randomBytes(16).toString("hex");
  try {
    console.log("  Trying guest token activation...");
    const res = await fetch("https://api.x.com/1.1/guest/activate.json", {
      method: "POST",
      headers: {
        authorization: `Bearer ${decodeURIComponent(BEARER)}`,
        "user-agent": UA,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.guest_token) {
        console.log(`  Got guest token: ${data.guest_token.slice(0, 8)}...`);
        return { ct0, guestToken: data.guest_token };
      }
    }
    console.log(`  Guest activation: HTTP ${res.status}`);
  } catch (e) {
    console.log(`  Guest activation failed: ${e.message}`);
  }

  // Try without guest token — some endpoints work with just bearer + ct0
  try {
    console.log("  Trying bearer-only (no guest token)...");
    const testUrl = `${GRAPHQL_BASE}/${QUERY_ID}/UserByScreenName?` +
      new URLSearchParams({
        variables: JSON.stringify({ screen_name: "x", withSafetyModeUserFields: true }),
        features: JSON.stringify(USER_FEATURES),
      });
    const res = await fetch(testUrl, { headers: twitterHeaders(null, ct0, null) });
    console.log(`  Bearer-only test: HTTP ${res.status}`);
    if (res.ok || res.status === 200) {
      return { ct0, guestToken: null };
    }
  } catch (e) {
    console.log(`  Bearer-only test failed: ${e.message}`);
  }

  return null;
}

/**
 * Bootstrap an authenticated session — obtain a valid ct0 CSRF token.
 * Priority: env var → verify_credentials cookie → /home cookie → random.
 */
async function bootstrapAuthSession(authToken) {
  // 1. User-supplied ct0
  if (process.env.X_CT0) {
    console.log("  Using ct0 from X_CT0 env var");
    return process.env.X_CT0;
  }

  const probeToken = crypto.randomBytes(16).toString("hex");

  // 2. Try verify_credentials — Twitter often sets ct0 even on 403
  try {
    console.log("  Trying verify_credentials...");
    const res = await fetch(
      "https://x.com/i/api/1.1/account/verify_credentials.json",
      { headers: twitterHeaders(authToken, probeToken) }
    );
    console.log(`  verify_credentials: HTTP ${res.status}`);

    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      const m = c.match(/ct0=([^;]+)/);
      if (m && m[1] !== probeToken) {
        console.log("  Got ct0 from verify_credentials");
        return m[1];
      }
    }
    if (res.ok) return probeToken;
  } catch (e) {
    console.log(`  verify_credentials failed: ${e.message}`);
  }

  // 3. Try /home
  try {
    console.log("  Trying /home...");
    const res = await fetch("https://x.com/home", {
      headers: { cookie: `auth_token=${authToken}`, "user-agent": UA },
      redirect: "manual",
    });
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      const m = c.match(/ct0=([^;]+)/);
      if (m) { console.log("  Got ct0 from /home"); return m[1]; }
    }
  } catch {}

  // 4. Random ct0 (double-submit just needs cookie == header)
  console.log("  Using self-generated ct0");
  return probeToken;
}

/**
 * Fetch a single profile via Twitter's GraphQL UserByScreenName endpoint.
 * Returns a clean profile object, or throws on error.
 */
async function fetchProfile(authToken, ct0, username, { debug = false, guestToken = null } = {}) {
  const variables = { screen_name: username, withSafetyModeUserFields: true };
  const params = new URLSearchParams();
  params.set("variables", JSON.stringify(variables));
  params.set("features", JSON.stringify(USER_FEATURES));
  const url = `${GRAPHQL_BASE}/${QUERY_ID}/UserByScreenName?${params}`;

  const res = await fetch(url, { headers: twitterHeaders(authToken, ct0, guestToken) });

  if (debug) {
    console.log(`  [DEBUG] @${username}: HTTP ${res.status}`);
  }

  if (res.status === 429) {
    const reset = res.headers.get("x-rate-limit-reset");
    const waitSec = reset ? Math.max(parseInt(reset) - Math.floor(Date.now() / 1000), 10) : 60;
    throw new Error(`RATE_LIMIT:${waitSec}`);
  }
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    throw new Error(`AUTH_FAIL:${res.status}:${body.slice(0, 200)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP_${res.status}:${body.slice(0, 200)}`);
  }

  const json = await res.json();

  if (debug) {
    console.log(`  [DEBUG] Response keys: ${Object.keys(json)}`);
    if (json.data) console.log(`  [DEBUG] data keys: ${Object.keys(json.data)}`);
  }

  if (json.errors?.length) {
    throw new Error(`GQL_ERROR:${json.errors.map((e) => e.message).join("; ")}`);
  }

  const result = json?.data?.user?.result;
  if (!result) {
    if (debug) console.log(`  [DEBUG] Full response: ${JSON.stringify(json).slice(0, 500)}`);
    throw new Error(`NOT_FOUND:@${username}`);
  }
  if (result.__typename === "UserUnavailable") {
    throw new Error(`UNAVAILABLE:@${username}:${result.reason || ""}`);
  }

  // Parse the raw GraphQL user result
  const legacy = result.legacy || {};
  const descUrls = legacy.entities?.description?.urls || [];
  const websiteUrl =
    legacy.entities?.url?.urls?.[0]?.expanded_url ||
    legacy.entities?.url?.urls?.[0]?.url ||
    legacy.url ||
    null;

  // Expand t.co URLs in bio
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
// 3. Main scraping loop
// --------------------------------------------------------------------------
async function scrapeProfiles(usernames) {
  const authToken = process.env.X_AUTH_TOKEN || null;
  let ct0, guestToken = null;
  let mode;

  // Load existing profiles to resume
  const outputPath = path.join(__dirname, "site/data/x-profiles.json");
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

  // Skip already scraped (unless older than 7 days)
  const STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const toScrape = usernames.filter((u) => {
    const ex = existing[u];
    if (!ex || ex.error) return true;
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

  // Bootstrap session — try guest first, fall back to auth
  if (authToken) {
    console.log("🔑 Bootstrapping authenticated session...");
    ct0 = await bootstrapAuthSession(authToken);
    mode = "auth";
    console.log(`✅ Auth mode, ct0: ${ct0.slice(0, 12)}...\n`);
  } else {
    console.log("🔓 No X_AUTH_TOKEN — trying guest mode...");
    const guest = await bootstrapGuestSession();
    if (guest) {
      ct0 = guest.ct0;
      guestToken = guest.guestToken;
      mode = "guest";
      console.log(`✅ Guest mode${guestToken ? " (with guest token)" : " (bearer-only)"}\n`);
    } else {
      console.error("❌ Guest mode failed. Provide X_AUTH_TOKEN:");
      console.error("   1. Open x.com in browser (logged in)");
      console.error("   2. DevTools → Application → Cookies → x.com");
      console.error("   3. Copy 'auth_token' value");
      console.error("\n   X_AUTH_TOKEN=abc123 node scrape-x-profiles.js");
      process.exit(1);
    }
  }

  // Test with a known account
  console.log("🧪 Testing session with @elonmusk...");
  try {
    const test = await fetchProfile(authToken, ct0, "elonmusk", { debug: true, guestToken });
    console.log(
      `✅ Session works! @${test.username} — ${test.name} (${test.followers.toLocaleString()} followers)\n`
    );
  } catch (e) {
    const msg = e.message || String(e);
    console.error(`\n❌ Session test FAILED: ${msg}`);
    if (!authToken) {
      console.error("\n   Guest mode didn't work. Provide X_AUTH_TOKEN:");
      console.error("   X_AUTH_TOKEN=your_token node scrape-x-profiles.js");
    } else {
      console.error("\n   Your auth_token may be expired. Get a fresh one from browser.");
    }
    process.exit(1);
  }

  const results = { ...existing };
  let success = 0;
  let failed = 0;
  let rateLimitHits = 0;
  const saveToDisk = () => {
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  };

  // Save on Ctrl+C
  process.on("SIGINT", () => {
    console.log(`\n\n⚡ Interrupted! Saving ${Object.keys(results).length} profiles...`);
    saveToDisk();
    console.log(`📁 Saved to ${outputPath}`);
    console.log(`   Re-run the same command to resume from where you left off.\n`);
    process.exit(0);
  });

  for (let i = 0; i < toScrape.length; i++) {
    const username = toScrape[i];
    const progress = `[${i + 1}/${toScrape.length}]`;

    try {
      const profile = await fetchProfile(authToken, ct0, username, { guestToken });

      results[username] = { ...profile, scrapedAt: new Date().toISOString() };
      success++;
      console.log(
        `${progress} ✅ @${username} — ${profile.name} (${profile.followers.toLocaleString()} followers)`
      );

      // Save every 10 profiles
      if (success % 10 === 0) saveToDisk();

      // Rate limit: ~1.5–2.5s between requests
      await sleep(1500 + Math.random() * 1000);
    } catch (err) {
      const msg = err.message || String(err);

      if (msg.startsWith("NOT_FOUND") || msg.startsWith("UNAVAILABLE")) {
        console.log(`${progress} ⚠️  ${msg}`);
        results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
        failed++;
      } else if (msg.startsWith("RATE_LIMIT")) {
        rateLimitHits++;
        const waitSec = Math.min(parseInt(msg.split(":")[1]) || 60, 900);
        saveToDisk(); // save before waiting!
        console.log(`${progress} ⏳ Rate limited! Saved ${Object.keys(results).length} profiles.`);
        console.log(`         Waiting ${waitSec}s (until ${new Date(Date.now() + waitSec * 1000).toLocaleTimeString()})...`);
        console.log(`         (Ctrl+C to stop — re-run to resume)`);
        await sleep(waitSec * 1000);
        i--; // retry this username
      } else if (msg.startsWith("AUTH_FAIL")) {
        console.error(`\n❌ Auth failed: ${msg}`);
        console.error("   Token expired. Get a fresh auth_token from your browser.");
        saveToDisk();
        console.log(`📁 Saved ${Object.keys(results).length} profiles. Re-run to resume.`);
        process.exit(1);
      } else {
        console.log(`${progress} ❌ @${username} — ${msg}`);
        results[username] = { username, error: msg, scrapedAt: new Date().toISOString() };
        failed++;
      }
    }
  }

  saveToDisk();
  console.log(
    `\n✅ Done! ${success} scraped, ${failed} failed, ${Object.keys(results).length} total profiles`
  );
  if (rateLimitHits > 0) console.log(`   (hit rate limit ${rateLimitHits} time${rateLimitHits > 1 ? "s" : ""})`);
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
