/**
 * CoinGecko fetcher — free plan (no key, rate-limited to ~10-30 req/min)
 * Docs: https://www.coingecko.com/en/api/documentation
 *
 * Endpoints hit:
 * - /ping
 * - /coins/markets (top 500 by market cap, multiple pages)
 * - /coins/list
 * - /global
 * - /global/decentralized_finance_defi
 * - /trending
 * - /search/trending
 * - /exchanges (top CEX/DEX list)
 * - /exchanges/list
 * - /coins/{id} for top coins (detailed metadata)
 * - /nfts/list
 * - /asset_platforms
 * - /categories/list
 * - /categories (with market data)
 */

import { fetchJSON, saveArchive, log, sleep, chunk } from "../lib/utils.ts";

const BASE = "https://api.coingecko.com/api/v3";
const SRC = "coingecko";

// Top coins to deep-fetch
const TOP_COIN_IDS = [
  "bitcoin", "ethereum", "tether", "binancecoin", "solana", "usd-coin",
  "ripple", "dogecoin", "cardano", "shiba-inu", "avalanche-2", "polkadot",
  "near", "chainlink", "uniswap", "litecoin", "cosmos", "stellar",
  "algorand", "filecoin", "aave", "maker", "compound", "curve-dao-token",
  "sushiswap", "pancakeswap-token", "raydium", "serum", "jupiter-exchange-solana",
  "bonk", "dogwifcoin", "popcat", "book-of-meme", "official-trump",
];

export async function runCoinGecko() {
  log(SRC, "Starting CoinGecko full fetch...");

  // 1. Ping
  const ping = await fetchJSON(`${BASE}/ping`, { source: SRC });
  saveArchive(SRC, "ping", ping);
  await sleep(1500);

  // 2. Global market data
  const global = await fetchJSON(`${BASE}/global`, { source: SRC });
  if (global) saveArchive(SRC, "global", global);
  await sleep(1500);

  // 3. Global DeFi
  const defi = await fetchJSON(`${BASE}/global/decentralized_finance_defi`, { source: SRC });
  if (defi) saveArchive(SRC, "global-defi", defi);
  await sleep(1500);

  // 4. Trending
  const trending = await fetchJSON(`${BASE}/search/trending`, { source: SRC });
  if (trending) saveArchive(SRC, "trending", trending);
  await sleep(1500);

  // 5. Asset platforms
  const platforms = await fetchJSON(`${BASE}/asset_platforms`, { source: SRC });
  if (platforms) saveArchive(SRC, "asset-platforms", platforms);
  await sleep(1500);

  // 6. Category list
  const catList = await fetchJSON(`${BASE}/coins/categories/list`, { source: SRC });
  if (catList) saveArchive(SRC, "categories-list", catList);
  await sleep(1500);

  // 7. Categories with market data
  const cats = await fetchJSON(`${BASE}/coins/categories`, { source: SRC });
  if (cats) saveArchive(SRC, "categories", cats);
  await sleep(1500);

  // 8. Coins list (full universe)
  const coinList = await fetchJSON(`${BASE}/coins/list?include_platform=true`, { source: SRC });
  if (coinList) saveArchive(SRC, "coins-list", coinList);
  log(SRC, `Coins list: ${Array.isArray(coinList) ? coinList.length : "?"} coins`);
  await sleep(1500);

  // 9. Coins markets — pages 1-5 (250 per page = 1250 coins)
  const allMarkets: any[] = [];
  for (let p = 1; p <= 5; p++) {
    const markets = await fetchJSON(
      `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${p}&sparkline=true&price_change_percentage=1h,24h,7d,30d`,
      { source: SRC }
    );
    if (markets) {
      allMarkets.push(...markets);
      saveArchive(SRC, `coins-markets-page${p}`, markets);
      log(SRC, `Markets page ${p}: ${markets.length} coins`);
    }
    await sleep(2000);
  }

  // 10. Exchanges
  const exchanges = await fetchJSON(`${BASE}/exchanges?per_page=100&page=1`, { source: SRC });
  if (exchanges) saveArchive(SRC, "exchanges", exchanges);
  await sleep(1500);

  // 11. Exchange list
  const exchangeList = await fetchJSON(`${BASE}/exchanges/list`, { source: SRC });
  if (exchangeList) saveArchive(SRC, "exchanges-list", exchangeList);
  await sleep(1500);

  // 12. NFTs list
  const nftList = await fetchJSON(`${BASE}/nfts/list?per_page=100&page=1`, { source: SRC });
  if (nftList) saveArchive(SRC, "nfts-list", nftList);
  await sleep(1500);

  // 13. Detailed coin data for top coins (in chunks to respect rate limit)
  const coinChunks = chunk(TOP_COIN_IDS, 5);
  for (const batch of coinChunks) {
    for (const id of batch) {
      const coin = await fetchJSON(
        `${BASE}/coins/${id}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=true`,
        { source: SRC }
      );
      if (coin) saveArchive(SRC, `coin-${id}`, coin);
      await sleep(1200);
    }
  }

  log(SRC, "CoinGecko fetch complete.");
}
