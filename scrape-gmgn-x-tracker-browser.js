/**
 * GMGN X Tracker Browser Console Scraper
 * 
 * INSTRUCTIONS:
 * 1. Go to https://gmgn.ai/follow?chain=sol in your browser
 * 2. Open DevTools (F12) → Console tab
 * 3. Paste this entire script and press Enter
 * 4. Scroll down the page to load more accounts (or use autoScroll())
 * 5. When done, run: downloadData()
 * 
 * Commands available after pasting:
 *   autoScroll()   - Auto-scroll to load all data (~2-3 min)
 *   downloadData() - Download captured accounts as JSON
 *   getStats()     - Show current capture stats
 *   getData()      - Get raw data array (for manual copy)
 */

(function() {
  // Storage for captured accounts
  window.__xTrackerAccounts = window.__xTrackerAccounts || new Map();
  
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
    
    const users = data?.data?.users || data?.data?.list || data?.data || [];
    if (!Array.isArray(users)) return;
    
    let newCount = 0;
    for (const user of users) {
      const parsed = parseUser(user);
      if (parsed && parsed.handle) {
        const key = parsed.handle.toLowerCase();
        if (!window.__xTrackerAccounts.has(key)) {
          newCount++;
        }
        const existing = window.__xTrackerAccounts.get(key) || {};
        window.__xTrackerAccounts.set(key, {
          ...existing,
          ...parsed,
          subscribers: Math.max(existing.subscribers || 0, parsed.subscribers || 0),
          followers: Math.max(existing.followers || 0, parsed.followers || 0),
        });
      }
    }
    
    if (newCount > 0) {
      console.log(`✅ Captured ${newCount} new accounts (total: ${window.__xTrackerAccounts.size})`);
    }
  }

  // Intercept fetch responses
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0]?.toString?.() || args[0];
    
    if (url.includes('twitter/user/search') || url.includes('x_tracker') || url.includes('twitter') || url.includes('follow') || url.includes('kol')) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        extractFromResponse(data);
      } catch (e) {}
    }
    
    return response;
  };

  // Intercept XHR responses
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      if (this._url && (this._url.includes('twitter/user/search') || this._url.includes('twitter') || this._url.includes('follow') || this._url.includes('kol'))) {
        try {
          const data = JSON.parse(this.responseText);
          extractFromResponse(data);
        } catch (e) {}
      }
    });
    return originalXHRSend.apply(this, args);
  };

  // Auto-scroll function
  window.autoScroll = async function(maxScrolls = 300, delay = 1500) {
    console.log('🚀 Starting auto-scroll... Press Ctrl+C or refresh to stop.');
    let prevCount = window.__xTrackerAccounts.size;
    let staleScrolls = 0;
    
    for (let i = 0; i < maxScrolls; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, delay));
      
      // Try clicking "Load More" button if present
      const loadMoreBtn = document.querySelector('button:has-text("Load More"), button:has-text("load more"), [class*="load-more"]');
      if (loadMoreBtn) loadMoreBtn.click();
      
      const currentCount = window.__xTrackerAccounts.size;
      if (currentCount === prevCount) {
        staleScrolls++;
        if (staleScrolls >= 5) {
          console.log(`📊 No new data after ${staleScrolls} scrolls. Done!`);
          break;
        }
      } else {
        staleScrolls = 0;
        console.log(`📜 Scroll ${i+1}: ${currentCount} accounts (+${currentCount - prevCount})`);
      }
      prevCount = currentCount;
    }
    
    console.log(`\n✅ Auto-scroll complete! Total accounts: ${window.__xTrackerAccounts.size}`);
    console.log('Run downloadData() to save the results.');
  };

  // Get stats
  window.getStats = function() {
    const accounts = Array.from(window.__xTrackerAccounts.values());
    const tags = {};
    for (const acc of accounts) {
      const t = acc.tag || 'Unknown';
      tags[t] = (tags[t] || 0) + 1;
    }
    console.log(`\n📊 X Tracker Stats:`);
    console.log(`Total accounts: ${accounts.length}`);
    console.log(`By tag:`, tags);
    return { total: accounts.length, byTag: tags };
  };

  // Get raw data
  window.getData = function() {
    return Array.from(window.__xTrackerAccounts.values())
      .sort((a, b) => (b.followers || 0) - (a.followers || 0));
  };

  // Download as JSON
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
║           GMGN X Tracker Browser Scraper Ready             ║
╠════════════════════════════════════════════════════════════╣
║  Commands:                                                 ║
║    autoScroll()   - Auto-scroll to load all accounts       ║
║    downloadData() - Download accounts as JSON              ║
║    getStats()     - Show capture statistics                ║
║    getData()      - Get raw data array                     ║
╠════════════════════════════════════════════════════════════╣
║  Current accounts captured: ${String(window.__xTrackerAccounts.size).padEnd(27)}║
╚════════════════════════════════════════════════════════════╝

Scroll the page or run autoScroll() to capture data.
  `);
})();
