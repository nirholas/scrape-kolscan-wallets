/**
 * GMGN X Tracker Browser Console Scraper (v2 - More Stable)
 * 
 * INSTRUCTIONS:
 * 1. Go to https://gmgn.ai/follow?chain=sol in your browser
 * 2. Open DevTools (F12) → Console tab
 * 3. Paste this entire script and press Enter
 * 4. Scroll the page, or run autoScroll() to gather data.
 * 5. If the page feels slow, run pauseScraper(). Run resumeScraper() to continue.
 * 6. When done, run: downloadData()
 * 
 * Commands available after pasting:
 *   autoScroll()    - Auto-scroll to load all data (~2-3 min)
 *   pauseScraper()  - Pause capturing data to reduce page load
 *   resumeScraper() - Resume capturing data
 *   downloadData()  - Download captured accounts as JSON
 *   getStats()      - Show current capture stats
 */

(function() {
  // Initialize global state to avoid conflicts and allow pausing
  window.__xTrackerScraper = window.__xTrackerScraper || {
    accounts: new Map(),
    isPaused: false,
  };
  
  const TAG_MAP = {
    kol: "KOL",
    trader: "Trader",
    master: "Master",
    politics: "Politics",
    media: "Media",
    companies: "Companies",
    founder: "Founders",
    exchange: "Exchanges",
    celebrity: "Celebrity",
    binance_square: "Binance Square",
    other: "Other",
  };

  function parseUser(user) {
    if (!user || typeof user !== 'object') return null;
    
    const handle = user.handle || user.twitter_username || user.screen_name || user.username;
    if (!handle) return null;
    
    let tag = null;
    if (user.user_tag) {
      tag = TAG_MAP[user.user_tag] || user.user_tag;
    } else if (Array.isArray(user.tags) && user.tags.length > 0) {
      tag = TAG_MAP[user.tags[0]] || user.tags[0];
    } else if (user.kol_tag) {
      tag = user.kol_tag;
    }
    
    return {
      handle: handle.replace(/^@/, ''),
      name: user.name || user.display_name || null,
      avatar: user.avatar || user.profile_image_url || null,
      subscribers: user.subscribers || user.subscriber_count || user.follow_count || 0,
      followers: user.followers || user.followers_count || 0,
      tag,
      verified: user.verified ?? user.is_verified ?? false,
      bio: user.bio || user.description || null,
    };
  }

  function extractFromResponse(data) {
    if (!data || typeof data !== 'object') return;
    
    // Handles various API response shapes
    const users = data?.data?.users || data?.data?.list || data?.data?.kols || data?.data || [];
    if (!Array.isArray(users)) return;
    
    let newCount = 0;
    for (const user of users) {
      const parsed = parseUser(user);
      if (parsed && parsed.handle) {
        const key = parsed.handle.toLowerCase();
        if (!window.__xTrackerScraper.accounts.has(key)) {
          newCount++;
        }
        const existing = window.__xTrackerScraper.accounts.get(key) || {};
        window.__xTrackerScraper.accounts.set(key, {
          ...existing,
          ...parsed,
          subscribers: Math.max(existing.subscribers || 0, parsed.subscribers || 0),
          followers: Math.max(existing.followers || 0, parsed.followers || 0),
        });
      }
    }
    
    if (newCount > 0) {
      console.log(`✅ Captured ${newCount} new accounts (total: ${window.__xTrackerScraper.accounts.size})`);
    }
  }

  // --- API Interception ---
  
  function processResponse(response) {
    // Process in the background to avoid blocking the page
    requestIdleCallback(async () => {
      try {
        const data = await response.json();
        extractFromResponse(data);
      } catch (e) {
        // Suppress errors for non-JSON responses
      }
    }, { timeout: 2000 });
  }

  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0]?.toString?.() || args[0];
    
    if (!window.__xTrackerScraper.isPaused && (url.includes('twitter/user/search') || url.includes('follow') || url.includes('kol'))) {
      processResponse(response.clone());
    }
    
    return response;
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      if (!window.__xTrackerScraper.isPaused && this._url && (this._url.includes('twitter/user/search') || this._url.includes('follow') || this._url.includes('kol'))) {
        requestIdleCallback(() => {
          try {
            const data = JSON.parse(this.responseText);
            extractFromResponse(data);
          } catch(e) {}
        });
      }
    });
    return originalXHRSend.apply(this, args);
  };

  // --- Control Functions ---

  window.pauseScraper = function() {
    window.__xTrackerScraper.isPaused = true;
    console.log('⏸️ Scraper paused. Run resumeScraper() to continue.');
  };

  window.resumeScraper = function() {
    window.__xTrackerScraper.isPaused = false;
    console.log('▶️ Scraper resumed.');
  };
  
  window.autoScroll = async function(maxScrolls = 300, delay = 1500) {
    console.log('🚀 Starting auto-scroll... Run pauseScraper() or refresh page to stop.');
    let prevCount = window.__xTrackerScraper.accounts.size;
    let staleScrolls = 0;
    
    for (let i = 0; i < maxScrolls; i++) {
      if (window.__xTrackerScraper.isPaused) {
        console.log("Auto-scroll paused. Run resumeScraper() to continue.");
        // Wait until resumed
        while (window.__xTrackerScraper.isPaused) {
          await new Promise(r => setTimeout(r, 1000));
        }
        console.log("Auto-scroll resumed.");
      }

      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, delay));
      
      const loadMoreBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(el => el.textContent.toLowerCase().includes('load more'));
      if (loadMoreBtn) loadMoreBtn.click();
      
      const currentCount = window.__xTrackerScraper.accounts.size;
      if (currentCount === prevCount) {
        staleScrolls++;
        if (staleScrolls >= 5) {
          console.log(`📊 No new data after ${staleScrolls} scrolls. Stopping.`);
          break;
        }
      } else {
        staleScrolls = 0;
        console.log(`📜 Scroll ${i+1}: ${currentCount} accounts (+${currentCount - prevCount})`);
      }
      prevCount = currentCount;
    }
    
    console.log(`\n✅ Auto-scroll complete! Total accounts: ${window.__xTrackerScraper.accounts.size}`);
    console.log('Run downloadData() to save the results.');
  };

  window.getStats = function() {
    const accounts = Array.from(window.__xTrackerScraper.accounts.values());
    const tags = {};
    for (const acc of accounts) {
      const t = acc.tag || 'Unknown';
      tags[t] = (tags[t] || 0) + 1;
    }
    console.log(`\n📊 X Tracker Stats:`);
    console.log(`Total accounts: ${accounts.length}`);
    console.log(`By tag:`, JSON.parse(JSON.stringify(tags)));
    return { total: accounts.length, byTag: tags };
  };

  window.getData = function() {
    return Array.from(window.__xTrackerScraper.accounts.values())
      .sort((a, b) => (b.followers || 0) - (a.followers || 0));
  };

  window.downloadData = function() {
    const accounts = window.getData();
    const result = {
      meta: {
        scrapedAt: new Date().toISOString(),
        source: "gmgn.ai/follow (browser)",
        totalAccounts: accounts.length,
      },
      accounts,
    };
    
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gmgn-x-tracker.json';
    a.click();
    URL.revokeObjectURL(url);
    
    console.log(`\n✅ Downloaded ${accounts.length} accounts to gmgn-x-tracker.json`);
    console.log('Move this file to: site/data/gmgn-x-tracker.json');
  };

  console.log(`
╔════════════════════════════════════════════════════════════╗
║      GMGN X Tracker Browser Scraper (v2 - Stable)          ║
╠════════════════════════════════════════════════════════════╣
║  Commands:                                                 ║
║    autoScroll()    - Auto-scroll to load all accounts      ║
║    pauseScraper()  - Pause data capture                    ║
║    resumeScraper() - Resume data capture                   ║
║    downloadData()  - Download accounts as JSON             ║
║    getStats()      - Show capture statistics               ║
╠════════════════════════════════════════════════════════════╣
║  Current accounts captured: ${String(window.__xTrackerScraper.accounts.size).padEnd(27)}║
╚════════════════════════════════════════════════════════════╝

Scroll the page or run autoScroll() to capture data.
  `);
})();
