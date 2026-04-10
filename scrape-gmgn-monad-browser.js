/**
 * GMGN Monad Smart Wallets — Browser Console Scraper (v1)
 *
 * INSTRUCTIONS:
 * 1. Go to https://gmgn.ai/trade?chain=monad in your browser
 * 2. Open DevTools (F12) → Console tab
 * 3. Paste this entire script and press Enter
 * 4. Run fetchAll() to pull all smart money categories automatically
 * 5. Run downloadData() when done — saves monad-smart-wallets.json
 *
 * Commands:
 *   fetchAll()      - Fetch all categories + timeframes via API (recommended)
 *   downloadData()  - Download captured wallets as JSON
 *   getStats()      - Show capture statistics by category
 *   clearData()     - Clear all data (including localStorage)
 *   pauseScraper()  - Pause active fetch
 *   resumeScraper() - Resume passive capture
 */

(function () {
  const STORAGE_KEY = '__monadWalletData';
  const CHAIN = 'monad';
  const API_BASE = 'https://gmgn.ai/defi/quotation/v1';
  const CATEGORIES = ['smart_degen', 'kol', 'sniper', 'fresh_wallet', 'top_dev', 'pump_smart'];
  const TIMEFRAMES = ['1d', '7d', '30d'];

  // ── Persistence ────────────────────────────────────────────────────────────

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        return new Map(arr.map(w => [w.wallet_address, w]));
      }
    } catch (e) {}
    return new Map();
  }

  function saveToStorage(wallets) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(wallets.values())));
    } catch (e) {
      console.warn('localStorage save failed (quota?):', e.message);
    }
  }

  // ── Global state ───────────────────────────────────────────────────────────

  window.__monadScraper = window.__monadScraper || {
    wallets: loadFromStorage(),
    isPaused: false,
    _fetching: false,
  };

  const loaded = window.__monadScraper.wallets.size;
  if (loaded > 0) {
    console.log(`📂 Restored ${loaded} wallets from localStorage.`);
  }

  // ── Wallet extraction ──────────────────────────────────────────────────────

  function extractWallets(data, category, timeframe) {
    if (!data || typeof data !== 'object') return 0;

    // GMGN rank API: data.data.rank
    const rank = data?.data?.rank ?? data?.rank;
    const details = data?.data?.walletDetails ?? data?.walletDetails ?? {};

    if (!Array.isArray(rank) || rank.length === 0) return 0;

    let newCount = 0;
    for (const w of rank) {
      const addr = w.wallet_address || w.address;
      if (!addr) continue;

      const existing = window.__monadScraper.wallets.get(addr) || {};
      const merged = {
        ...existing,
        ...w,
        wallet_address: addr,
        chain: CHAIN,
        // Tag with which category/timeframe sourced this
        _categories: Array.from(new Set([...(existing._categories || []), category])),
        _timeframes: Array.from(new Set([...(existing._timeframes || []), timeframe])),
      };

      // Attach per-timeframe stats under namespaced keys
      if (timeframe === '1d') {
        merged.realized_profit_1d = w.realized_profit ?? w.realized_profit_1d ?? existing.realized_profit_1d ?? '0';
        merged.pnl_1d             = w.pnl           ?? w.pnl_1d            ?? existing.pnl_1d            ?? '0';
        merged.winrate_1d         = w.winrate        ?? w.winrate_1d        ?? existing.winrate_1d        ?? 0;
        merged.buy_1d             = w.buy_1d         ?? w.buy               ?? existing.buy_1d            ?? 0;
        merged.sell_1d            = w.sell_1d        ?? w.sell              ?? existing.sell_1d           ?? 0;
        merged.volume_1d          = w.volume_1d      ?? w.volume            ?? existing.volume_1d         ?? '0';
      }
      if (timeframe === '7d') {
        merged.realized_profit_7d = w.realized_profit ?? w.realized_profit_7d ?? existing.realized_profit_7d ?? '0';
        merged.pnl_7d             = w.pnl           ?? w.pnl_7d            ?? existing.pnl_7d            ?? '0';
        merged.winrate_7d         = w.winrate        ?? w.winrate_7d        ?? existing.winrate_7d        ?? 0;
        merged.buy_7d             = w.buy_7d         ?? w.buy               ?? existing.buy_7d            ?? 0;
        merged.sell_7d            = w.sell_7d        ?? w.sell              ?? existing.sell_7d           ?? 0;
        merged.volume_7d          = w.volume_7d      ?? w.volume            ?? existing.volume_7d         ?? '0';
      }
      if (timeframe === '30d') {
        merged.realized_profit_30d = w.realized_profit ?? w.realized_profit_30d ?? existing.realized_profit_30d ?? '0';
        merged.pnl_30d             = w.pnl           ?? w.pnl_30d           ?? existing.pnl_30d           ?? '0';
        merged.winrate_30d         = w.winrate        ?? w.winrate_30d       ?? existing.winrate_30d       ?? 0;
        merged.buy_30d             = w.buy_30d        ?? w.buy               ?? existing.buy_30d           ?? 0;
        merged.sell_30d            = w.sell_30d       ?? w.sell              ?? existing.sell_30d          ?? 0;
        merged.volume_30d          = w.volume_30d     ?? w.volume            ?? existing.volume_30d        ?? '0';
      }

      // Attach wallet detail if present
      if (details[addr]) merged.detail = details[addr];
      if (w.detail)       merged.detail = { ...(merged.detail || {}), ...w.detail };

      const isNew = !existing.wallet_address;
      window.__monadScraper.wallets.set(addr, merged);
      if (isNew) newCount++;
    }

    if (newCount > 0 || rank.length > 0) {
      saveToStorage(window.__monadScraper.wallets);
      console.log(`  ✅ ${category}/${timeframe}: ${rank.length} wallets (+${newCount} new) | total: ${window.__monadScraper.wallets.size}`);
    }

    return newCount;
  }

  // ── Passive fetch interception (captures data as page loads) ───────────────

  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _origFetch.apply(this, args);
    if (window.__monadScraper.isPaused) return response;

    const url = (args[0]?.toString?.() || '');
    const isRankCall = url.includes('/rank/') && url.includes(CHAIN);

    if (isRankCall) {
      response.clone().json().then(json => {
        // Best-effort category/timeframe extraction from URL
        const m = url.match(/\/rank\/\w+\/(\w+)\/([\w]+)/);
        const cat = m?.[1] ?? 'unknown';
        const tf  = m?.[2] ?? 'unknown';
        extractWallets(json, cat, tf);
      }).catch(() => {});
    }
    return response;
  };

  // ── fetchAll: paginate through all categories × timeframes ────────────────

  window.fetchAll = async function ({ delay = 700 } = {}) {
    if (window.__monadScraper._fetching) {
      console.log('⚠️ Already running. Call pauseScraper() to stop.');
      return;
    }
    window.__monadScraper._fetching = true;
    window.__monadScraper.isPaused  = false;

    console.log(`🚀 Starting full fetch: ${CATEGORIES.length} categories × ${TIMEFRAMES.length} timeframes`);
    console.log('   Call pauseScraper() to stop early.\n');

    for (const category of CATEGORIES) {
      if (window.__monadScraper.isPaused) break;

      for (const timeframe of TIMEFRAMES) {
        if (window.__monadScraper.isPaused) break;

        let page = 1;
        let hasMore = true;

        while (hasMore && !window.__monadScraper.isPaused) {
          const url =
            `${API_BASE}/rank/${CHAIN}/${category}/${timeframe}` +
            `?orderby=pnl_${timeframe}&direction=desc&page=${page}&limit=100`;

          try {
            const res = await _origFetch(url, {
              headers: {
                Accept: 'application/json, */*',
                Referer: `https://gmgn.ai/trade?chain=${CHAIN}`,
                Origin: 'https://gmgn.ai',
              },
              credentials: 'include',
            });

            if (res.status === 429) {
              console.log('  ⏳ Rate limited — waiting 3s...');
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }
            if (!res.ok) {
              console.log(`  ⚠️  ${category}/${timeframe} page ${page}: HTTP ${res.status} — skipping`);
              hasMore = false;
              break;
            }

            const json = await res.json();
            const rank = json?.data?.rank ?? json?.rank;

            if (!Array.isArray(rank) || rank.length === 0) {
              hasMore = false;
              break;
            }

            extractWallets(json, category, timeframe);

            // Stop paginating after 3 pages (300 wallets) per category/timeframe
            hasMore = rank.length === 100 && page < 3;
            page++;
          } catch (err) {
            console.log(`  ❌ ${category}/${timeframe}: ${err.message}`);
            hasMore = false;
          }

          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    window.__monadScraper._fetching = false;
    const total = window.__monadScraper.wallets.size;
    console.log(`\n✅ Done! Total unique wallets: ${total}`);
    console.log('Run downloadData() to save.');
  };

  // ── Control functions ──────────────────────────────────────────────────────

  window.pauseScraper = function () {
    window.__monadScraper.isPaused  = true;
    window.__monadScraper._fetching = false;
    console.log('⏸️  Paused. Call fetchAll() to restart or resumeScraper() to re-enable passive capture.');
  };

  window.resumeScraper = function () {
    window.__monadScraper.isPaused = false;
    console.log('▶️  Passive capture resumed. Call fetchAll() to paginate.');
  };

  window.clearData = function () {
    const n = window.__monadScraper.wallets.size;
    window.__monadScraper.wallets.clear();
    localStorage.removeItem(STORAGE_KEY);
    console.log(`🗑️  Cleared ${n} wallets.`);
  };

  window.getStats = function () {
    const wallets = Array.from(window.__monadScraper.wallets.values());
    const byCat = {};
    for (const w of wallets) {
      for (const cat of (w._categories || ['unknown'])) {
        byCat[cat] = (byCat[cat] || 0) + 1;
      }
    }
    console.log(`\n📊 Total wallets: ${wallets.length}`);
    console.table(byCat);
    return { total: wallets.length, byCategory: byCat };
  };

  window.getData = function () {
    return Array.from(window.__monadScraper.wallets.values());
  };

  window.downloadData = function () {
    const wallets = window.getData();
    const addresses = wallets.map(w => w.wallet_address).filter(Boolean);

    const output = {
      meta: {
        scrapedAt: new Date().toISOString(),
        chain: CHAIN,
        source: `https://gmgn.ai/trade?chain=${CHAIN}`,
        totalWallets: wallets.length,
        scraper: 'scrape-gmgn-monad-browser.js',
      },
      wallets,
      addresses,
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
      href: url,
      download: 'monad-smart-wallets.json',
    }).click();
    URL.revokeObjectURL(url);
    console.log(`✅ Downloaded ${wallets.length} wallets → monad-smart-wallets.json`);
  };

  // ── Banner ─────────────────────────────────────────────────────────────────

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   GMGN Monad Smart Wallets Scraper (v1)                      ║
╠══════════════════════════════════════════════════════════════╣
║  fetchAll()      - Fetch ALL categories via API (do this!)   ║
║  downloadData()  - Download wallets as JSON                  ║
║  getStats()      - Show stats by category                    ║
║  clearData()     - Clear all data (incl. localStorage)       ║
║  pauseScraper()  - Pause active fetch                        ║
║  resumeScraper() - Resume passive capture                    ║
╠══════════════════════════════════════════════════════════════╣
║  Wallets in memory: ${String(window.__monadScraper.wallets.size).padEnd(40)}║
╚══════════════════════════════════════════════════════════════╝
Data auto-saves to localStorage on every capture.
Run fetchAll() to start!
`);
})();
