/**
 * GMGN X Tracker Scraper
 *
 * Scrapes X/Twitter accounts from GMGN's X Tracker "Top Subscriptions" list
 * using Playwright to intercept API calls. GMGN tracks ~10,000+ crypto-relevant
 * X accounts with subscriber counts and category tags.
 *
 * Usage: node scrape-gmgn-x-tracker.js
 * Output: site/data/gmgn-x-tracker.json
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "site", "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "gmgn-x-tracker.json");
const SCROLL_DELAY_MS = 1500;
const MAX_SCROLLS = 200; // Many pages of accounts

const GMGN_URL = "https://gmgn.ai/x";

async function scrape() {
  console.log("Starting GMGN X Tracker scraper...\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Collect all intercepted X tracker accounts
  const accountMap = new Map(); // handle -> data (dedup by handle)
  const apiResponses = [];

  // Intercept API responses for X tracker data
  page.on("response", async (response) => {
    const url = response.url();

    // Capture GMGN API calls related to X tracker / twitter subscriptions
    const isTargetApi =
      url.includes("/api/") &&
      (url.includes("twitter") ||
        url.includes("x_tracker") ||
        url.includes("x-tracker") ||
        url.includes("subscription") ||
        url.includes("influencer") ||
        url.includes("kol") ||
        url.includes("social"));

    // Also capture any JSON response from gmgn.ai domain
    const isGmgnApi =
      url.includes("gmgn.ai") &&
      (url.includes("/api/") || url.includes("/defi/"));

    if (!isTargetApi && !isGmgnApi) return;

    try {
      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("json")) return;

      const json = await response.json();
      apiResponses.push({ url, data: json });
      console.log(`  [API] ${url.substring(0, 140)}`);

      // Extract X tracker accounts from various response shapes
      extractAccounts(json, accountMap);
    } catch {
      // Not JSON or failed to parse — skip
    }
  });

  // Navigate to GMGN X Tracker page
  console.log(`Loading ${GMGN_URL} ...`);
  try {
    await page.goto(GMGN_URL, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
  } catch (e) {
    console.log(`  Navigation warning: ${e.message}`);
  }
  await page.waitForTimeout(3000);

  console.log(`\nPage loaded. Found ${accountMap.size} accounts so far.`);

  // Try to click "Top Subscriptions" or similar tab if available
  for (const tabText of [
    "Top Subscriptions",
    "Top Subscribe",
    "Featured",
    "Recommended",
  ]) {
    try {
      const tab = page.locator(`text=${tabText}`).first();
      if (await tab.isVisible({ timeout: 2000 })) {
        console.log(`  Clicking "${tabText}" tab...`);
        await tab.click();
        await page.waitForTimeout(2000);
      }
    } catch {
      // Tab not found
    }
  }

  // Scroll to load all accounts
  console.log("\nScrolling to load all accounts...");
  let prevCount = accountMap.size;
  let staleScrolls = 0;

  // Find the scrollable container
  const scrollContainer = await page.evaluate(() => {
    // Try common scroll containers
    const selectors = [
      '.x-tracker-list',
      '[class*="tracker"]',
      '[class*="subscription"]',
      '[class*="scroll"]',
      'main',
      '#__next > div > div',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) return sel;
    }
    return null;
  });

  for (let i = 0; i < MAX_SCROLLS; i++) {
    if (scrollContainer) {
      await page.evaluate(
        (sel) => {
          const el = document.querySelector(sel);
          if (el) el.scrollTop = el.scrollHeight;
        },
        scrollContainer,
      );
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }

    await page.waitForTimeout(SCROLL_DELAY_MS);

    // Also try to extract data from DOM directly
    const domAccounts = await extractFromDOM(page);
    for (const acc of domAccounts) {
      if (acc.handle && !accountMap.has(acc.handle.toLowerCase())) {
        accountMap.set(acc.handle.toLowerCase(), acc);
      }
    }

    const currentCount = accountMap.size;
    if (currentCount === prevCount) {
      staleScrolls++;
      if (staleScrolls >= 5) {
        console.log(
          `  No new accounts after ${staleScrolls} scrolls — stopping.`,
        );
        break;
      }
    } else {
      staleScrolls = 0;
      console.log(
        `  Scroll ${i + 1}: ${currentCount} accounts (+${currentCount - prevCount})`,
      );
    }
    prevCount = currentCount;

    // Try "Load More" or "Show More" button
    try {
      const loadMore = page
        .locator('button:has-text("Load More"), button:has-text("Show More"), button:has-text("load more")')
        .first();
      if (await loadMore.isVisible({ timeout: 500 })) {
        await loadMore.click();
        await page.waitForTimeout(1500);
      }
    } catch {
      // No load more button
    }
  }

  // Final DOM extraction pass
  const finalDom = await extractFromDOM(page);
  for (const acc of finalDom) {
    if (acc.handle && !accountMap.has(acc.handle.toLowerCase())) {
      accountMap.set(acc.handle.toLowerCase(), acc);
    }
  }

  console.log(`\nTotal unique X accounts: ${accountMap.size}`);

  // Save results
  const result = {
    meta: {
      scrapedAt: new Date().toISOString(),
      source: "gmgn.ai/x",
      totalAccounts: accountMap.size,
    },
    accounts: Array.from(accountMap.values()).sort(
      (a, b) => (b.subscribers || 0) - (a.subscribers || 0),
    ),
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\nSaved to ${OUTPUT_FILE}`);

  // Also save raw API responses for debugging
  const debugFile = path.join(OUTPUT_DIR, "gmgn-x-tracker-raw.json");
  fs.writeFileSync(
    debugFile,
    JSON.stringify(
      { responsesCount: apiResponses.length, responses: apiResponses },
      null,
      2,
    ),
  );
  console.log(`Debug responses saved to ${debugFile}`);

  await browser.close();
  console.log("\nDone!");
}

/**
 * Extract X tracker accounts from GMGN API response JSON.
 * Handles various nested response shapes.
 */
function extractAccounts(data, map) {
  if (!data || typeof data !== "object") return;

  // Direct array of accounts
  if (Array.isArray(data)) {
    for (const item of data) extractSingleAccount(item, map);
    return;
  }

  // { data: [...] } or { data: { list: [...] } }
  if (data.data) {
    if (Array.isArray(data.data)) {
      for (const item of data.data) extractSingleAccount(item, map);
    } else if (data.data.list && Array.isArray(data.data.list)) {
      for (const item of data.data.list) extractSingleAccount(item, map);
    } else if (typeof data.data === "object") {
      extractAccounts(data.data, map);
    }
  }

  // { list: [...] }
  if (data.list && Array.isArray(data.list)) {
    for (const item of data.list) extractSingleAccount(item, map);
  }

  // { items: [...] }
  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) extractSingleAccount(item, map);
  }

  // { accounts: [...] }
  if (data.accounts && Array.isArray(data.accounts)) {
    for (const item of data.accounts) extractSingleAccount(item, map);
  }

  // { result: [...] }
  if (data.result && Array.isArray(data.result)) {
    for (const item of data.result) extractSingleAccount(item, map);
  }
}

function extractSingleAccount(item, map) {
  if (!item || typeof item !== "object") return;

  // Look for twitter handle fields
  const handle =
    item.twitter_username ||
    item.screen_name ||
    item.handle ||
    item.username ||
    item.twitter_handle ||
    (item.twitter_url &&
      item.twitter_url.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/)?.[1]);

  if (!handle) return;
  const key = handle.toLowerCase().replace(/^@/, "");
  if (!key || key.length === 0) return;

  const existing = map.get(key) || {};
  map.set(key, {
    handle: handle.replace(/^@/, ""),
    name: item.name || item.display_name || item.twitter_name || existing.name || null,
    avatar:
      item.avatar ||
      item.profile_image_url ||
      item.twitter_avatar ||
      item.image ||
      existing.avatar ||
      null,
    subscribers: item.subscribers || item.subscriber_count || item.follow_count || existing.subscribers || 0,
    followers: item.followers || item.followers_count || existing.followers || 0,
    tag: item.tag || item.category || item.label || item.group || existing.tag || null,
    verified: item.verified ?? item.is_verified ?? existing.verified ?? false,
    bio: item.bio || item.description || existing.bio || null,
    ...existing,
    // Overwrite with new data
    handle: handle.replace(/^@/, ""),
  });
}

/**
 * Extract accounts directly from the page DOM as fallback.
 */
async function extractFromDOM(page) {
  return page.evaluate(() => {
    const accounts = [];

    // Look for table rows or list items with X handles
    const rows = document.querySelectorAll(
      'tr, [class*="item"], [class*="row"], [class*="account"], [class*="user"]',
    );

    for (const row of rows) {
      const text = row.textContent || "";
      // Look for @handle patterns
      const handleMatch = text.match(/@([A-Za-z0-9_]{1,15})/);
      if (!handleMatch) continue;

      const handle = handleMatch[1];

      // Try to find subscriber count (number near the handle)
      const numbers = text.match(/[\d,]+/g) || [];
      const subscribers =
        numbers.length > 0
          ? parseInt(numbers[0].replace(/,/g, ""), 10) || 0
          : 0;

      // Try to find tag/category
      const tagPatterns = [
        "Binance Square",
        "Founders",
        "Politics",
        "Companies",
        "Exchanges",
        "KOL",
        "Influencer",
        "Trader",
        "NFT",
        "DeFi",
        "Gaming",
        "Media",
        "VC",
        "Developer",
        "Analyst",
      ];
      let tag = null;
      for (const t of tagPatterns) {
        if (text.includes(t)) {
          tag = t;
          break;
        }
      }

      // Try to find name (text before @handle)
      const nameMatch = text.match(/^([^@\n]{2,30})@/);
      const name = nameMatch ? nameMatch[1].trim() : null;

      // Avatar image
      const img = row.querySelector("img");
      const avatar = img ? img.src : null;

      accounts.push({ handle, name, avatar, subscribers, tag, verified: false });
    }

    return accounts;
  });
}

scrape().catch(console.error);
