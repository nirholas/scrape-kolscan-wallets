/**
 * GMGN Monad Smart Wallets — Browser Console Scraper (v2)
 *
 * INSTRUCTIONS:
 * 1. Go to https://gmgn.ai/trade?chain=monad in your browser
 * 2. Open DevTools (F12) → Console tab
 * 3. Paste this entire script and press Enter
 * 4. Run sniffUrls() first — it logs ALL API calls made by the page so you
 *    can see what endpoints GMGN actually uses for Monad.
 * 5. Run fetchAll() to attempt all known endpoint patterns.
 * 6. Scroll around the page — passive interception captures any wallet data
 *    that loads through normal page navigation.
 * 7. Run downloadData() when done — saves monad-smart-wallets.json
 *
 * Commands:
 *   sniffUrls()     - Log all GMGN API URLs the page calls (run first!)
 *   fetchAll()      - Try all known endpoint patterns to find wallets
 *   downloadData()  - Download captured wallets as JSON
 *   getStats()      - Show capture statistics by source
 *   clearData()     - Clear all data (including localStorage)
 *   pauseScraper()  - Pause active fetch
 *   resumeScraper() - Resume passive capture
 */

(function () {
  const STORAGE_KEY = '__monadWalletData';
  const CHAIN = 'monad';
  const API_BASE = 'https://gmgn.ai/defi/quotation/v1';

  // Rank API categories — used for chains like sol/bsc; may or may not work for monad
  const RANK_CATEGORIES = ['smart_degen', 'kol', 'sniper', 'fresh_wallet', 'top_dev', 'pump_smart'];
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
    seenUrls: [],
    isPaused: false,
    _fetching: false,
  };

  const loaded = window.__monadScraper.wallets.size;
  if (loaded > 0) {
    console.log('📂 Restored ' + loaded + ' wallets from localStorage.');
  }

  // ── Wallet merging ─────────────────────────────────────────────────────────

  function addWallet(addr, data, source) {
    if (!addr || addr.length < 10) return false;
    const existing = window.__monadScraper.wallets.get(addr) || {};
    const merged = {
      ...existing,
      ...data,
      wallet_address: addr,
      chain: CHAIN,
      _sources: Array.from(new Set([...(existing._sources || []), source])),
    };
    const isNew = !existing.wallet_address;
    window.__monadScraper.wallets.set(addr, merged);
    return isNew;
  }

  // ── Response parser — handles many different GMGN response shapes ──────────

  function parseResponse(json, source) {
    if (!json || typeof json !== 'object') return 0;
    let count = 0;

    // Shape 1: rank API — data.data.rank[]
    const rank = json?.data?.rank ?? json?.rank;
    if (Array.isArray(rank)) {
      const details = json?.data?.walletDetails ?? json?.walletDetails ?? {};
      for (const w of rank) {
        const addr = w.wallet_address || w.address;
        if (!addr) continue;
        const entry = { ...w };
        if (details[addr]) entry.detail = details[addr];
        if (addWallet(addr, entry, source)) count++;
      }
    }

    // Shape 2: trade feed — data.data.trades[] or data.data[]
    const trades = json?.data?.trades ?? json?.trades ?? (Array.isArray(json?.data) ? json.data : null);
    if (Array.isArray(trades)) {
      for (const t of trades) {
        // trader / maker / from address
        const addr = t.maker || t.trader || t.wallet_address || t.from || t.address;
        if (!addr) continue;
        const entry = {
          wallet_address: addr,
          name: t.maker_name || t.trader_name || null,
          twitter_username: t.maker_twitter || t.twitter || null,
          avatar: t.maker_avatar || t.avatar || null,
          tags: t.maker_tags || t.tags || [],
        };
        if (addWallet(addr, entry, source + ':trade')) count++;
      }
    }

    // Shape 3: smart money / wallet list — data.data.list[]
    const list = json?.data?.list ?? json?.list;
    if (Array.isArray(list)) {
      for (const w of list) {
        const addr = w.wallet_address || w.address || w.maker;
        if (!addr) continue;
        if (addWallet(addr, w, source + ':list')) count++;
      }
    }

    // Shape 4: top wallets / leaderboard — data.data.wallets[]
    const wallets = json?.data?.wallets ?? json?.wallets;
    if (Array.isArray(wallets)) {
      for (const w of wallets) {
        const addr = w.wallet_address || w.address;
        if (!addr) continue;
        if (addWallet(addr, w, source + ':wallets')) count++;
      }
    }

    if (count > 0) {
      saveToStorage(window.__monadScraper.wallets);
      console.log('  ✅ [' + source + '] +' + count + ' new wallets | total: ' + window.__monadScraper.wallets.size);
    }

    return count;
  }

  // ── Passive interception — capture EVERYTHING from gmgn.ai ────────────────

  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _origFetch.apply(this, args);
    if (window.__monadScraper.isPaused) return response;

    const url = (typeof args[0] === 'string' ? args[0] : args[0]?.url || args[0]?.toString?.() || '');

    if (url.includes('gmgn.ai')) {
      // Record every unique GMGN URL for sniffUrls()
      if (!window.__monadScraper.seenUrls.includes(url)) {
        window.__monadScraper.seenUrls.push(url);
      }

      response.clone().json().then(json => {
        // Extract source label from URL path
        const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        parseResponse(json, path);
      }).catch(() => {});
    }

    return response;
  };

  // XHR fallback
  const _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url, ...r) {
    this._url = url;
    return _xhrOpen.apply(this, [m, url, ...r]);
  };
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener('load', function () {
      if (window.__monadScraper.isPaused) return;
      if (this._url && this._url.includes('gmgn.ai')) {
        try {
          const json = JSON.parse(this.responseText);
          const path = this._url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
          parseResponse(json, path + ':xhr');
        } catch (e) {}
      }
    });
    return _xhrSend.apply(this, a);
  };

  // ── sniffUrls — show all GMGN API calls the page makes ────────────────────

  window.sniffUrls = function () {
    const urls = window.__monadScraper.seenUrls;
    if (urls.length === 0) {
      console.log('No GMGN URLs captured yet. Scroll the page to trigger API calls, then run sniffUrls() again.');
      return;
    }
    console.log('\n📡 GMGN API URLs captured (' + urls.length + '):');
    urls.forEach((u, i) => console.log('  ' + (i + 1) + '. ' + u));
    return urls;
  };

  // ── fetchAll — probe all known endpoint patterns for Monad ────────────────

  window.fetchAll = async function ({ delay = 700 } = {}) {
    if (window.__monadScraper._fetching) {
      console.log('⚠️ Already running. Call pauseScraper() to stop.');
      return;
    }
    window.__monadScraper._fetching = true;
    window.__monadScraper.isPaused  = false;

    const headers = {
      'Accept': 'application/json, */*',
      'Referer': 'https://gmgn.ai/trade?chain=' + CHAIN,
      'Origin': 'https://gmgn.ai',
    };

    async function tryFetch(url, label) {
      try {
        const res = await _origFetch(url, { headers, credentials: 'include' });
        if (res.status === 429) {
          console.log('  ⏳ Rate limited on ' + label + ' — waiting 3s...');
          await new Promise(r => setTimeout(r, 3000));
          return null;
        }
        if (!res.ok) {
          console.log('  [' + res.status + '] ' + label);
          return null;
        }
        const json = await res.json();
        console.log('  [200] ' + label);
        return json;
      } catch (err) {
        console.log('  [ERR] ' + label + ': ' + err.message);
        return null;
      }
    }

    console.log('🚀 Probing Monad endpoints...\n');

    // ── 1. Rank API (works for sol/bsc — probably 404 for monad but worth trying)
    console.log('— Rank API (standard) —');
    for (const cat of RANK_CATEGORIES) {
      if (window.__monadScraper.isPaused) break;
      for (const tf of TIMEFRAMES) {
        if (window.__monadScraper.isPaused) break;
        const url = API_BASE + '/rank/' + CHAIN + '/' + cat + '/' + tf +
          '?orderby=pnl_' + tf + '&direction=desc&page=1&limit=100';
        const json = await tryFetch(url, 'rank/' + cat + '/' + tf);
        if (json) parseResponse(json, 'rank/' + cat + '/' + tf);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // ── 2. Smart money / top traders endpoints (Monad-specific guesses)
    console.log('\n— Smart money / top traders endpoints —');
    const smartEndpoints = [
      API_BASE + '/smartmoney/' + CHAIN + '/wallets?limit=100&page=1',
      API_BASE + '/smartmoney/' + CHAIN + '/rank?limit=100&page=1',
      API_BASE + '/wallet_list/' + CHAIN + '?type=smart_money&limit=100',
      API_BASE + '/top_traders/' + CHAIN + '?limit=100',
      API_BASE + '/leaderboard/' + CHAIN + '?limit=100',
      'https://gmgn.ai/api/v1/smartmoney/' + CHAIN + '/wallets?limit=100',
      'https://gmgn.ai/api/v1/rank/' + CHAIN + '/smart_degen/7d?limit=100',
      'https://gmgn.ai/trade/api/v1/rank/' + CHAIN + '?limit=100',
      'https://gmgn.ai/defi/quotation/v1/smartmoney/' + CHAIN + '?limit=100&type=smart_degen',
    ];
    for (const url of smartEndpoints) {
      if (window.__monadScraper.isPaused) break;
      const label = url.replace('https://gmgn.ai', '').split('?')[0];
      const json = await tryFetch(url, label);
      if (json) parseResponse(json, label);
      await new Promise(r => setTimeout(r, delay));
    }

    // ── 3. Recent trades feed (collect wallet addresses of active traders)
    console.log('\n— Recent trades feed —');
    const tradeEndpoints = [
      API_BASE + '/trades/' + CHAIN + '?limit=100',
      API_BASE + '/trades/' + CHAIN + '/latest?limit=100',
      API_BASE + '/activity/' + CHAIN + '?limit=100',
      'https://gmgn.ai/defi/quotation/v1/' + CHAIN + '/trades?limit=100',
      'https://gmgn.ai/api/v1/trades/' + CHAIN + '?limit=100',
    ];
    for (const url of tradeEndpoints) {
      if (window.__monadScraper.isPaused) break;
      const label = url.replace('https://gmgn.ai', '').split('?')[0];
      const json = await tryFetch(url, label);
      if (json) parseResponse(json, label);
      await new Promise(r => setTimeout(r, delay));
    }

    // ── 4. Use any captured page URLs as additional targets
    const pageUrls = window.__monadScraper.seenUrls.filter(u =>
      u.includes(CHAIN) && !window.__monadScraper._triedPageUrls?.has(u)
    );
    window.__monadScraper._triedPageUrls = new Set([
      ...(window.__monadScraper._triedPageUrls || []),
      ...pageUrls,
    ]);
    if (pageUrls.length > 0) {
      console.log('\n— Re-fetching ' + pageUrls.length + ' URLs captured from page —');
      for (const url of pageUrls) {
        if (window.__monadScraper.isPaused) break;
        const label = url.replace('https://gmgn.ai', '').split('?')[0];
        const json = await tryFetch(url, label);
        if (json) parseResponse(json, label);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    window.__monadScraper._fetching = false;
    const total = window.__monadScraper.wallets.size;
    console.log('\n' + (total > 0
      ? '✅ Done! Total unique wallets: ' + total + '. Run downloadData() to save.'
      : '⚠️  No wallets found. Run sniffUrls() to see what the page actually calls, then share the output so we can target those endpoints directly.'));
  };

  // ── Control functions ──────────────────────────────────────────────────────

  window.pauseScraper = function () {
    window.__monadScraper.isPaused  = true;
    window.__monadScraper._fetching = false;
    console.log('⏸️  Paused.');
  };

  window.resumeScraper = function () {
    window.__monadScraper.isPaused = false;
    console.log('▶️  Resumed (passive capture active).');
  };

  window.clearData = function () {
    const n = window.__monadScraper.wallets.size;
    window.__monadScraper.wallets.clear();
    window.__monadScraper.seenUrls = [];
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️  Cleared ' + n + ' wallets.');
  };

  window.getStats = function () {
    const wallets = Array.from(window.__monadScraper.wallets.values());
    const bySrc = {};
    for (const w of wallets) {
      for (const src of (w._sources || ['unknown'])) {
        const key = src.split('/').slice(0, 4).join('/');
        bySrc[key] = (bySrc[key] || 0) + 1;
      }
    }
    console.log('\n📊 Total wallets: ' + wallets.length);
    console.table(bySrc);
    return { total: wallets.length, bySource: bySrc };
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
        source: 'https://gmgn.ai/trade?chain=' + CHAIN,
        totalWallets: wallets.length,
        capturedUrls: window.__monadScraper.seenUrls,
        scraper: 'scrape-gmgn-monad-browser.js v2',
      },
      wallets,
      addresses,
    };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'monad-smart-wallets.json' }).click();
    URL.revokeObjectURL(url);
    console.log('✅ Downloaded ' + wallets.length + ' wallets → monad-smart-wallets.json');
  };

  // ── Banner ─────────────────────────────────────────────────────────────────

  console.log([
    '╔══════════════════════════════════════════════════════════════╗',
    '║   GMGN Monad Smart Wallets Scraper (v2)                      ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  sniffUrls()   - Show all GMGN API URLs the page called      ║',
    '║  fetchAll()    - Probe all known endpoint patterns           ║',
    '║  downloadData()- Download wallets as JSON                    ║',
    '║  getStats()    - Show stats by API source                    ║',
    '║  clearData()   - Clear all data (incl. localStorage)         ║',
    '║  pauseScraper()- Pause  |  resumeScraper() - Resume          ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  Wallets in memory: ' + window.__monadScraper.wallets.size,
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    'Passive capture is ON — scroll the page to trigger API calls,',
    'then run sniffUrls() to see what endpoints GMGN uses for Monad.',
    'Then run fetchAll() to attempt all known patterns.',
  ].join('\n'));
})();

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
