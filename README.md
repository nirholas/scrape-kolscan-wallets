# KolScan Leaderboard Scraper

Scrapes all KOL (Key Opinion Leader) wallet data from [kolscan.io/leaderboard](https://kolscan.io/leaderboard) — including wallet addresses, names, socials, profit, win/loss records across Daily, Weekly, and Monthly timeframes.

## Quick Start

```bash
npm install
npx playwright install chromium
sudo npx playwright install-deps chromium   # Linux only — installs system libs
npm run scrape
```

## Output

```
output/kolscan-leaderboard.json   # Full dataset (all timeframes)
output/wallets.txt                # Deduplicated wallet address list
```

### Schema

| Field | Type | Description |
|-------|------|-------------|
| `wallet_address` | string | Solana wallet address |
| `name` | string | KOL display name |
| `twitter` | string\|null | Twitter/X profile URL |
| `telegram` | string\|null | Telegram channel URL |
| `profit` | number | Profit in SOL |
| `wins` | number | Number of winning trades |
| `losses` | number | Number of losing trades |
| `timeframe` | number | 1 = Daily, 7 = Weekly, 30 = Monthly |

### Sample Entry

```json
{
  "wallet_address": "CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o",
  "name": "Cented",
  "telegram": null,
  "twitter": "https://x.com/Cented7",
  "profit": 116.700812423713,
  "wins": 99,
  "losses": 135,
  "timeframe": 1
}
```

---

## How We Reverse-Engineered This

This is a full walkthrough of the process used to figure out how to scrape kolscan.io, from first attempt to working scraper.

### Step 1: Initial Recon

First, we fetched the raw HTML to understand what framework the site uses:

```bash
curl -s 'https://kolscan.io/leaderboard' -o /tmp/kolscan_page.html
head -100 /tmp/kolscan_page.html
```

This revealed Next.js script tags (`/_next/static/chunks/...`), confirming it's a **Next.js** application.

### Step 2: Hunting for API Endpoints

We tried common API patterns with GET requests:

```bash
curl -s -o /dev/null -w "%{http_code}" 'https://kolscan.io/api/leaderboard'   # 400
curl -s -o /dev/null -w "%{http_code}" 'https://kolscan.io/api/kols'           # 400
curl -s -o /dev/null -w "%{http_code}" 'https://kolscan.io/api/v1/leaderboard' # 400
curl -s -o /dev/null -w "%{http_code}" 'https://kolscan.io/api/traders'         # 400
```

All returned **400** — the endpoints exist but reject GET requests. We also found `api.kolscan.io` returns **401** (auth required).

### Step 3: Identifying JS Bundles

We extracted the script chunk URLs from the HTML:

```bash
curl -s 'https://kolscan.io/leaderboard' | grep -oE '"[^"]*/_next/static/chunks/[^"]*"' | head -10
```

This revealed the key chunks, including `app/leaderboard/page-*.js` and shared chunks `184-*.js`, `341-*.js`, etc.

### Step 4: Finding the API Call in Source Code

We searched each JS chunk for `/api/` paths:

```bash
for chunk in 341-*.js 400-*.js 184-*.js 255-*.js; do
  curl -s "https://kolscan.io/_next/static/chunks/${chunk}" | grep -oP '"/api/[^"]*"'
done
```

**Chunk 184** contained the gold:

```
"/api/trades"
"/api/tokens"
"/api/leaderboard"
"/api/data"
```

### Step 5: Extracting the Exact Fetch Call

We pulled the surrounding code context:

```bash
curl -s 'https://kolscan.io/_next/static/chunks/184-*.js' | grep -oP '.{0,200}/api/leaderboard.{0,200}'
```

This revealed the **exact fetch implementation**:

```javascript
fetch("/api/leaderboard", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ timeframe: e, page: t, pageSize: n })
})
```

Key discovery: **It's a POST endpoint**, not GET. Parameters are `timeframe` (1/7/30), `page` (0-indexed), and `pageSize` (50).

### Step 6: Trying Direct POST (Failed)

We tried hitting it directly with curl:

```bash
curl -s -X POST 'https://kolscan.io/api/leaderboard' \
  -H 'Content-Type: application/json' \
  -d '{"timeframe":1,"page":0,"pageSize":50}'
```

Result: **Forbidden**. The API requires a valid browser session — likely Cloudflare or cookie-based protection.

### Step 7: Extracting SSR Data from HTML

We discovered the page server-renders initial data via the `initLeaderboard` React prop:

```bash
curl -s 'https://kolscan.io/leaderboard' | grep -oP '\{[^}]*wallet_address[^}]*\}' | head -10
```

This extracted **616 wallet entries** from the HTML — but only the first page per timeframe (50 each), plus many had missing `timeframe` fields due to regex limitations.

### Step 8: Analyzing the Leaderboard Component

By reading the full `page-*.js` chunk (~14KB), we found:

- **Infinite scroll** uses `react-infinite-scroll-component` targeting `scrollableTarget: "mainScroll"`
- **Timeframes**: `[1, 7, 30]` mapped to Daily/Weekly/Monthly
- **Page size**: hardcoded at 50
- The component fetches more data on scroll via the POST API

### Step 9: Headless Browser Approach

Since the API is protected, we needed a real browser session. First attempt with Puppeteer failed (module not found). We switched to **Playwright**:

```bash
npm install playwright
npx playwright install chromium
sudo npx playwright install-deps chromium  # needed for Linux shared libraries
```

### Step 10: First Playwright Attempt (0 results)

```javascript
// Scrolled window — captured nothing
for (let i = 0; i < 30; i++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
}
```

**Problem**: The infinite scroll listens on `#mainScroll`, not window. Scrolling the window doesn't trigger pagination.

### Step 11: Working Solution

The fix was scrolling the **correct container**:

```javascript
await page.evaluate(() => {
  const el = document.getElementById('mainScroll');
  if (el) el.scrollTop = el.scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
});
```

Combined with intercepting the POST responses and switching between timeframe tabs, this captured **all 1,304 entries across 472 unique wallets**.

### Final Result

```
Daily:   434 entries (9 pages × 50 + 34)
Weekly:  435 entries (8 pages × 50 + 35)
Monthly: 435 entries (8 pages × 50 + 35)
─────────────────────────────────────────
Total:   1,304 entries
Unique:  472 wallets
```

### Key Lessons

1. **Check the HTTP method** — this API only accepts POST, not GET
2. **Read the JS source** — minified code still reveals exact API signatures
3. **Protected APIs** require browser sessions — headless browsers solve this
4. **Scroll containers matter** — infinite scroll often binds to a specific element, not `window`
5. **SSR data is free** — Next.js embeds initial page data in HTML as React props
6. **Look at chunk names** — `app/leaderboard/page-*.js` is obviously the leaderboard page code
7. **Shared chunks** like `184-*.js` often contain API helper functions used across multiple pages

## License

MIT

---

## Full Wallet List

### Wallets & Socials

| # | Name | Wallet | Twitter | Telegram |
|---|------|--------|---------|----------|
| 1 | Inquixit | `3L8RAxLkvwkz4CgHivaVRtq19741FAdGLk5DgjRfc1fW` | [inquixit](https://x.com/inquixit) | - |
| 2 | Pikalosi | `9cdZg6xR4c9kZiqKSzqjn4QHCXNQuC9HEWBzzMJ3mzqw` | [pikalosi](https://x.com/pikalosi) | [Link](https://t.me/PikalosiCalls) |
| 3 | Idontpaytaxes | `2T5NgDDidkvhJQg8AHDi74uCFwgp25pYFMRZXBaCUNBH` | [untaxxable](https://x.com/untaxxable) | - |
| 4 | zeropnl | `4xY9T1Q7foJzJsJ6YZDSsfp9zkzeZsXnxd45SixduMmr` | [im0pnl](https://x.com/im0pnl) | - |
| 5 | Dior | `87rRdssFiTJKY4MGARa4G5vQ31hmR7MxSmhzeaJ5AAxJ` | [Dior100x](https://x.com/Dior100x) | - |
| 6 | 👀 | `Ew6qBU7N34gRNgpgUwhJ3PgrtbPYpLYWLBEG5yuQTceD` | [UniswapVillain](https://x.com/UniswapVillain) | - |
| 7 | Eric Cryptoman | `EgnY4zmqXuaqodCLW366jjd2ecki6pvmMF74MkSxMFQW` | [EricCryptoman](https://x.com/EricCryptoman) | [Link](https://t.me/Erics_Calls) |
| 8 | hood | `91sP85Ds9A4EXJ3gU3iHyLtUNJimxz8LrxRb2qhBNod9` | [hoodscall](https://x.com/hoodscall) | - |
| 9 | PattyIce | `6nhskL8RVpXzWXC7mcC1UXpe3ze2p6P6og1jXVGUW88s` | [patty_fi](https://x.com/patty_fi) | - |
| 10 | sadizmed | `DTdHa4auX68jFtXv9wkzMYCahg295AnRuwvm6moW6meZ` | [sadizmed](https://x.com/sadizmed) | [Link](https://t.me/SadizFig) |
| 11 | Paper | `FwjYcbfktK8PC2bzCrqxR6QkUPxmHFbcFGNrz3YAV7ft` | [stackppr](https://x.com/stackppr) | - |
| 12 | Xelf | `9Vk7pkBZ9KFJmzaPzNYjGedyz8qoKMQtnYyYi2AehNMT` | [xelf_sol](https://x.com/xelf_sol) | [Link](https://t.me/xelfalpha) |
| 13 | Lectron | `Gv8YFCU9WESGpN6fcGKG9nirqcyF9wVZAqnQ1DjrsfcE` | [LectronNFT](https://x.com/LectronNFT) | - |
| 14 | 7 | `FTg1gqW7vPm4kdU1LPM7JJnizbgPdRDy2PitKw6mY27j` | [Soloxbt](https://x.com/Soloxbt) | - |
| 15 | Phineas.SOL | `64ymeD9XTAkNJgHtXgrG6JCNZmBC9fSVcmgkL54pFikE` | [Phineas_Sol](https://x.com/Phineas_Sol) | [Link](https://t.me/PhineasCabal) |
| 16 | Ricco 🥀 | `7Gi4H4wugm2n3rRWa6BijsQPJV7sMardawTi2tXDL9zM` | [RiccoRosas](https://x.com/RiccoRosas) | - |
| 17 | lyftical | `951wq3qDowjKHaycrNaiRB5WpovYVKXnqhnrcKPh46zt` | [lyftical](https://x.com/lyftical) | - |
| 18 | Gh0stee | `2kv8X2a9bxnBM8NKLc6BBTX2z13GFNRL4oRotMUJRva9` | [4GH0STEE](https://x.com/4GH0STEE) | - |
| 19 | CryptoStacksss | `FEGu1issUaiWS7NhSNLwDYRudBSSUHaBenHF14qStv4W` | [CryptoStacksss](https://x.com/CryptoStacksss) | [Link](https://t.me/Stacksendors) |
| 20 | Pavel | `3jckt69SiN3aCMbBWJoDS1s4xxGpqNxFFKnwhpRAQmuL` | [pavelbtc](https://x.com/pavelbtc) | [Link](http://t.me/pavelcalls) |
| 21 | cuban | `EcVgevcb8F3QsHuBg96wrCXwC3j2gnrhLr1Q21YULNk8` | [oCubann](https://x.com/oCubann) | - |
| 22 | Laanie | `37Y6bz7AXpHHRzMHGMqGRxv8JMuHQCS2FFHrPZkUeRt2` | [cryptolaanie](https://x.com/cryptolaanie) | [Link](https://t.me/laaniecalls) |
| 23 | gambles.sol | `Hi5yNvPSfagdja5xjYMTYWnnjSE3ze5KsezTLfuD2mqd` | [mastern0de3](https://x.com/mastern0de3) | [Link](https://t.me/launchlog) |
| 24 | Coler | `99xnE2zEFi8YhmKDaikc1EvH6ELTQJppnqUwMzmpLXrs` | [ColerCooks](https://x.com/ColerCooks) | - |
| 25 | Walta | `39q2g5tTQn9n7KnuapzwS2smSx3NGYqBoea11tBjsGEt` | [Walta61](https://x.com/Walta61) | [Link](https://t.me/waltacalls) |
| 26 | Zachary | `D52tmCnycFovhx2ueMuEnxq5LCdwfZrU9u8ECE5foCW5` | [Zakidge](https://x.com/Zakidge) | - |
| 27 | MACXBT | `ETU3GyrUsv6UztQJxHgsBX2UoJFmq79WJe3JyDpAqGMz` | [00MACXBT](https://x.com/00MACXBT) | [Link](https://t.me/memecoinitalia) |
| 28 | Cowboy🔶BNB | `6EDaVsS6enYgJ81tmhEkiKFcb4HuzPUVFZeom6PHUqN3` | [feibo03](https://x.com/feibo03) | - |
| 29 | Pain | `GEpM1SmE8ExgznJwyZX64F2Mv5LLFgvBCxm5zNWYUXL4` | [ipaincharts](https://x.com/ipaincharts) | [Link](http://t.me/PainofMoney) |
| 30 | Classic | `DsqRyTUh1R37asYcVf1KdX4CNnz5DKEFmnXvgT4NfTPE` | [simplyclassic69](https://x.com/simplyclassic69) | [Link](https://t.me/mrclassiccalls) |
| 31 | merky | `ATpSExwhE2x1H7rv6Uoi4TJdzGz15LjDXNzhV6pjDVYi` | [Merkytrades](https://x.com/Merkytrades) | - |
| 32 | Jdn | `2iPgNgss7ow3v5YFkTpzABStfjFSyG3BGvP5sZqADtFM` | [JadenOnChain](https://x.com/JadenOnChain) | [Link](http://t.me/jadendegens) |
| 33 | Killua | `95TWoKkvv2z85EXBzd2z6NwbxH2f54AvwuCA9x3NoKep` | [cryptokillua99](https://x.com/cryptokillua99) | - |
| 34 | 0xWinged | `HrCPnDvDgbpbFxKxer6Pw3qEcfAQQNNjb6aJNFWgTEng` | [0xExorcized](https://x.com/0xExorcized) | - |
| 35 | jamessmith | `EQaxqKT3N981QBmdSUGNzAGK5S26zUwAdRHhBCgn87zD` | [luckedhub](https://x.com/luckedhub) | - |
| 36 | The Doc | `DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt` | [KayTheDoc](https://x.com/KayTheDoc) | [Link](https://t.me/+9OnlKXERe9hkODBh) |
| 37 | dints | `DbRQjQDTTsiBXg1TJdb55WvEr3JvqUyu4iJJ684Aqeu3` | [dintsfi](https://x.com/dintsfi) | - |
| 38 | Nyhrox | `6S8GezkxYUfZy9JPtYnanbcZTMB87Wjt1qx3c6ELajKC` | [nyhrox](https://x.com/nyhrox) | - |
| 39 | kitty | `qP3Q8d4WWsGbqkTfyA9Dr6cAD7DQoBuxPJMFTK48rWU` | [0xkitty69](https://x.com/0xkitty69) | [Link](https://t.me/KittysKasino) |
| 40 | Dan176 | `J2B5fnm2DAAUAGa4EaegwQFoYaN6B5FerGA5sjtQoaGM` | [176Dan](https://x.com/176Dan) | [Link](https://t.me/DansCall) |
| 41 | Schoen | `5hAgYC8TJCcEZV7LTXAzkTrm7YL29YXyQQJPCNrG84zM` | [Schoen_xyz](https://x.com/Schoen_xyz) | - |
| 42 | Preston | `HmtAZQn7U75jkAxrXNh8vRFCmjGjM3Q2WpiTHXoCJrUz` | [prestonharty](https://x.com/prestonharty) | - |
| 43 | Bottom Seller | `BtUBxH7bEjmDJbgVLxjEK7ZX72XPeDKaeXFufXnGATna` | [bottomseller](https://x.com/bottomseller) | - |
| 44 | blixze ♱ | `5vg7he5HibvsAW86wfiuP6jw7VwKmUAnP6P93mVCdpJu` | [blixze](https://x.com/blixze) | - |
| 45 | kitakitsune | `kita97U8XijSrkwoEa6ViskeJnP8mCYUTsusU5RyaN5` | [kitakitsune](https://x.com/kitakitsune) | [Link](https://t.me/kitabakes) |
| 46 | Numer0 (trench/arc) | `A3W8psibkTUvjxs4LRscbnjux6TFDXdvD4m4GsGpQ2KJ` | [Numerooo0](https://x.com/Numerooo0) | [Link](https://t.me/fakepumpsbynumer0) |
| 47 | Fozzy | `B9oKseVKRntTvfADyaUoH7oVmoyVbBfUf4NKyQc4KK2D` | [fozzycapone](https://x.com/fozzycapone) | - |
| 48 | big bags bobby | `8oQoMhfBQnRspn7QtNAq2aPThRE4q94kLSTwaaFQvRgs` | [bigbagsbobby](https://x.com/bigbagsbobby) | - |
| 49 | Keano | `Ez2jp3rwXUbaTx7XwiHGaWVgTPFdzJoSg8TopqbxfaJN` | [nftkeano](https://x.com/nftkeano) | - |
| 50 | Zef | `EjtQrPTbcMevStBkpnjsH23NfUCMhGHusTYsHuGVQZp2` | [zefwashere](https://x.com/zefwashere) | [Link](https://t.me/SefaPVP) |
| 51 | J Spizzle | `4z3WtX32eehkmnaNNstZWyAuVBhj6cgpk5JtkdTa4m4A` | [JSpizzleCrypto](https://x.com/JSpizzleCrypto) | - |
| 52 | Yenni | `5B52w1ZW9tuwUduueP5J7HXz5AcGfruGoX6YoAudvyxG` | [Yennii56](https://x.com/Yennii56) | - |
| 53 | Stacker ✝️ | `HbCxe8yWQJWnK3f3FX4oohgm87FZuPYD4Ydszqxgkwft` | [Stackeronsol](https://x.com/Stackeronsol) | - |
| 54 | Spike | `FhsSfTSHok3ryVfyuLSD1t9frc4c1ymyCr3S11Ci718z` | [NotSpikeG](https://x.com/NotSpikeG) | [Link](http://t.me/Spikescallss) |
| 55 | Zil | `FSAmbD6jm6SZZQadSJeC1paX3oTtAiY9hTx1UYzVoXqj` | [zilxbt](https://x.com/zilxbt) | [Link](https://t.me/zilcalls) |
| 56 | orangie | `DuQabFqdC9eeBULVa7TTdZYxe8vK8ct5DZr4Xcf7docy` | [orangie](https://x.com/orangie) | - |
| 57 | BIGWARZ | `7bsTkeWcSPG6nzsbXucxV89YUULoSExNJdX2WqfLHwZ4` | [bigwarzeth](https://x.com/bigwarzeth) | - |
| 58 | Alpha wallet 4 | `6pa2QnW2mB1F41FkytTYd2gTh9aTUCmdTGEgcFRXcQ8g` | [quarsays](https://x.com/quarsays) | [Link](https://t.me/magicalslol) |
| 59 | Meechie | `9iaawVBEsFG35PSwd4PahwT8fYNQe9XYuRdWm872dUqY` | [973Meech](https://x.com/973Meech) | [Link](https://t.co/zb0ZJIEhEm) |
| 60 | JADAWGS | `3H9LVHarjBoZ2YPEsgFbVD1zuERCGwfp4AeyHoHsFSEC` | [10xJDOG](https://x.com/10xJDOG) | - |
| 61 | Rasta | `RaSSH7hMwLKtMT96xZyY4JwHRCCNYvvNeBh6AaFMqdA` | [rastacowboy2021](https://x.com/rastacowboy2021) | [Link](https://t.me/rastasyard) |
| 62 | flock (6'3) | `F1WT79Jkw3BkBDUfCbrKKo15ghZNCEjvnjxQpiCfPuRM` | [flocko](https://x.com/flocko) | - |
| 63 | Naruza | `ASVzakePP6GNg9r95d4LPZHJDMXun6L6E4um4pu5ybJk` | [0xNaruza](https://x.com/0xNaruza) | - |
| 64 | DRT 🐂 | `7K7itu678xAaUcuPQ2f3c2DcjirRjBY4HMTW1dx6hiL6` | [pepeDRT](https://x.com/pepeDRT) | - |
| 65 | jester | `4s2WzRLa35FB58bZY1i4CN3WoywJeuYrGYHnTKFsT23z` | [thejester](https://x.com/thejester) | - |
| 66 | Scrim | `GBERKNpahPnBGmeUGWQVjGBDBj6CcJKpGz34FqegmTgu` | [mircs](https://x.com/mircs) | - |
| 67 | Hash | `DNsh1UfJdxmze6T6GV9QK5SoFm7HsM5TRNxVuwVgo8Zj` | [Hashbergers](https://x.com/Hashbergers) | [Link](https://t.me/HashTrades) |
| 68 | peely 🍌 | `BaLxyjXzATAnfm7cc5AFhWBpiwnsb71THcnofDLTWAPK` | [0xpeely](https://x.com/0xpeely) | [Link](https://t.me/peelystree) |
| 69 | SatsBuyer | `BWQPaFCn5Fp5ok2x5W69wspbsgiRXuPPUYX8Zgnm7XeQ` | [Satsbuyer](https://x.com/Satsbuyer) | [Link](https://t.me/+QuSpUmbxgtszOGI1) |
| 70 | Danny | `9FNz4MjPUmnJqTf6yEDbL1D4SsHVh7uA8zRHhR5K138r` | [0xSevere](https://x.com/0xSevere) | - |
| 71 | Setora | `HTVupcGHvA8tXX5pHmmAxQ8eiFAJSJhYNQjer3zycLcU` | [Setora__](https://x.com/Setora__) | - |
| 72 | Te' | `8RrMaJXYwANd4zEskfPQuSYE35dTzaYtuwyKz3ewcZQx` | [TeTheGamer](https://x.com/TeTheGamer) | [Link](https://t.me/trenchwithte) |
| 73 | Rich The Dev | `FCt3Gyuqcoc4vHrnAYdxVbqSg3m1AyDHtaVZMN8TctPv` | [Piana100x](https://x.com/Piana100x) | [Link](https://t.me/fivepct) |
| 74 | Divix | `FajxNukkjDLGXfB5V3L1msrU9qgzuzhN4s4YQfefSCKp` | [cryptodivix](https://x.com/cryptodivix) | [Link](https://t.me/divixtrades) |
| 75 | Jay | `HwRnKq7RPtKHvX9wyHsc1zvfHtGjPQa5tyZtGtbvfXE` | [BitBoyJay](https://x.com/BitBoyJay) | - |
| 76 | Toxic weast | `DU323DieHUGPmYamp6A4Ai1V4YSYgRi35mGpzJGrjf7k` | [Toxic_weast](https://x.com/Toxic_weast) | [Link](https://t.me/TOXICgambols) |
| 77 | Lowskii (believes) | `41uh7g1DxYaYXdtjBiYCHcgBniV9Wx57b7HU7RXmx1Gg` | [Lowskii_gg](https://x.com/Lowskii_gg) | [Link](http://t.me/lowskiicooks) |
| 78 | Aymory ⚡️ | `9qdiDGhXrGqPN4CTGvyKwFKHrgJSGn836cjkVcGfPd6N` | [Aymoryfun](https://x.com/Aymoryfun) | [Link](https://t.me/Aymoryfun) |
| 79 | Hermes | `5dzH7gh5FjtrxUwtfBufJyTBA4fyCUGheZsdYQsE9vag` | [coinsolmaxi](https://x.com/coinsolmaxi) | - |
| 80 | TMH メタ | `A38dM3RtNpewkwkWJeyj8C9c8yWtgaaAdh4Rdj1SXg3M` | [thememeshunterx](https://x.com/thememeshunterx) | - |
| 81 | Woozy | `9tRff7L6Mx3ZDNBoGPffdjD3c9JNzLc3nxzadYH4TnAp` | [woozy2so](https://x.com/woozy2so) | - |
| 82 | Padly | `FQEXjVZPT7BqcZNVs82Q46LFPUevG7YoDiKpugpJaiCb` | [Padly1k](https://x.com/Padly1k) | - |
| 83 | Scooter | `9NL6thsiaoyDnm7XF8hEbMoqeG172WmG7iKYpygvjfgo` | [imperooterxbt](https://x.com/imperooterxbt) | - |
| 84 | N’o | `Di75xbVUg3u1qcmZci3NcZ8rjFMj7tsnYEoFdEMjS4ow` | [Nosa1x](https://x.com/Nosa1x) | - |
| 85 | Robo | `4ZdCpHJrSn4E9GmfP8jjfsAExHGja2TEn4JmXfEeNtyT` | [roboPBOC](https://x.com/roboPBOC) | [Link](https://t.me/robogems) |
| 86 | trisha | `4Dm3g5goQkaaXM4s7sphZzk8Vqb39j2mjhABrannMGmj` | [trishhxy](https://x.com/trishhxy) | - |
| 87 | Trench Guerilla | `9St6ETbe3CFitw6UNSd8kg7kZ6STXy71wEGiERqQj89U` | [trenchguerilla](https://x.com/trenchguerilla) | - |
| 88 | sp | `722tXm5uB5uuG2tC43uKHXQ7Pbyz75pTokEAJv9x5VTx` | [SolanaPlays](https://x.com/SolanaPlays) | - |
| 89 | prosciutto | `4EsY8HQB4Ak65diFrSHjwWhKSGC8sKmnzyusM993gk2w` | [prosciuttosol](https://x.com/prosciuttosol) | [Link](http://t.me/prosciuttosol) |
| 90 | Legend | `EgjCS3ULUCU5JN83XumirPr6171zvN5i6wc12SDiVGX3` | [legend_calls](https://x.com/legend_calls) | - |
| 91 | Aroa | `Aen6LKc7sGVPTyjMd5cu9B9XVjL7m9pnvAiP2ZNJC4GZ` | [AroaOnSol](https://x.com/AroaOnSol) | [Link](https://t.me/AroasJournal) |
| 92 | MoneyMaykah | `3i8akM4xfSX9WKFB5bQ61fmiYkeKQEFqvdMEyu6pSEk9` | [moneymaykah_](https://x.com/moneymaykah_) | - |
| 93 | goob | `9BkauJdFYUyBkNBZwV4mNNyfeVKhHvjULb7cL4gFQaLt` | [goobfarmedyou](https://x.com/goobfarmedyou) | [Link](https://t.me/goobscall) |
| 94 | I̶l̷y̶ | `5XVKfruE4Zzeoz3aqBQfFMb5aSscY5nSyc6VwtQwNiid` | [ilyunow](https://x.com/ilyunow) | [Link](https://t.me/ilythinks) |
| 95 | ree | `EVCwZrtPFudcjw69RZ9Qogt8dW2HjBp6EiMgv1ujdYuJ` | [reeotrix](https://x.com/reeotrix) | - |
| 96 | xet | `9yGxZ43ngT7LvwquVdUAYPvJzVyY65cS6mQvuJXjTEUc` | [xet](https://x.com/xet) | - |
| 97 | Frost | `4nwfXw7n98jEQn93VWY7Cuf1jnn1scHXuXCPGVYS9k6T` | [FrostBallin](https://x.com/FrostBallin) | - |
| 98 | Guy | `ELNFHkwb5W9RpxAac6SdJcgYi4wn7bPpPvd3LwfhR2Xx` | [obeyguy](https://x.com/obeyguy) | [Link](http://t.me/richguytrades) |
| 99 | dns | `2DG4vs36XHf3V9czMopZufUn8ton4tuf6atuRpP4Kowr` | [DNS_ERR](https://x.com/DNS_ERR) | [Link](https://t.me/DNS_diary) |
| 100 | Pavlo | `7NnaXghjuU92gM9kmwXysqa5HboyZuR2LTaBnvazFxSH` | [pavlotrading](https://x.com/pavlotrading) | - |
| 101 | proh | `FksF9AqK7UvkkuzDoHQxYiyk6APwpPAaRzXp5QG3FGqA` | [PR0H0S](https://x.com/PR0H0S) | [Link](http://t.me/PR0H0S) |
| 102 | 十九岁绿帽少年🍀 | `DzeSE8ZBNk36qqswcDxd8919evdH5upwyZ4u1yieQSkp` | [19ys_GGboy](https://x.com/19ys_GGboy) | [Link](https://t.me/M19yrs1) |
| 103 | Gorilla Capital | `DpNVrtA3ERfKzX4F8Pi2CVykdJJjoNxyY5QgoytAwD26` | [gorillacapsol](https://x.com/gorillacapsol) | [Link](https://t.me/gorillacapitalcooks) |
| 104 | 0xMistBlade | `14HDbSrjCJKgwCXDBXv8PGRGFaLrAqDBq2mCwSA46q5x` | [0xMistBlade](https://x.com/0xMistBlade) | - |
| 105 | Chefin | `6Qs6joB349h7zu1z9xRgPgMSmpBYLDQb2wtAecY4LysH` | [Chefin100x](https://x.com/Chefin100x) | [Link](https://t.me/ChefinAlpha) |
| 106 | Issa | `2BU3NAzgRA2gg2MpzwwXpA8X4CCRaLgrf6TY1FKfJPX2` | [issathecooker](https://x.com/issathecooker) | [Link](https://t.me/issasthoughts) |
| 107 | old | `CA4keXLtGJWBcsWivjtMFBghQ8pFsGRWFxLrRCtirzu5` | [old](https://x.com/old) | - |
| 108 | Gake | `DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm` | [Ga__ke](https://x.com/Ga__ke) | [Link](https://t.me/GakesBakes) |
| 109 | jitter | `7PuHVAKDZ96s9P5FAt2eEdE8EYKxy9iUhvaLaMFqfCyj` | [jitterxyz](https://x.com/jitterxyz) | - |
| 110 | Pow | `8zFZHuSRuDpuAR7J6FzwyF3vKNx4CVW3DFHJerQhc7Zd` | [traderpow](https://x.com/traderpow) | [Link](https://t.me/PowsGemCalls) |
| 111 | MERK | `4jFPYSoUTRaFbFDJp9QpA1J5pXJmMJYoWhiFTpoLPq6X` | [MerkTrading](https://x.com/MerkTrading) | [Link](http://t.me/MerkTradingCalls) |
| 112 | polar | `GL8VLakj5AeAnkVNd4gQAkjXLqAzjeNbNXUQBdo8FwQG` | [polarsterrr](https://x.com/polarsterrr) | - |
| 113 | Ansem | `AVAZvHLR2PcWpDf8BXY4rVxNHYRBytycHkcB5z5QNXYm` | [blknoiz06](https://x.com/blknoiz06) | - |
| 114 | Mezoteric | `EdDCRfDDeiiDXdntrP59abH4DXHFNU48zpMPYisDMjA7` | [mezoteric](https://x.com/mezoteric) | - |
| 115 | fa1r | `8ggkt7Y1SZzmsdcy6ZHTif6HvgAUv2dxJCbTFTGD67MV` | [fa1rtrade](https://x.com/fa1rtrade) | - |
| 116 | Affu (aura farming) | `BjNueAZDxLpwHnpMVZrB5b8DTTBHdmXtg1ZaRPCJ1yYJ` | [lethal_affu](https://x.com/lethal_affu) | [Link](https://t.me/affucalls) |
| 117 | profitier | `FbvUU5qvD9JsU9jp3KDweCpZiVZHLoQBQ1PPCAAbd6FB` | [profitierr](https://x.com/profitierr) | - |
| 118 | Burixx 🇮🇹 | `A9aTuBuxoVY547n6hUBCq9oZm36LTJX9Kvn4NZXffXvp` | [Burix_sol](https://x.com/Burix_sol) | [Link](https://t.me/BurixxDegenCorner) |
| 119 | LJC | `6HJetMbdHBuk3mLUainxAPpBpWzDgYbHGTS2TqDAUSX2` | [OnlyLJC](https://x.com/OnlyLJC) | [Link](https://t.me/LJCcabals) |
| 120 | killz | `9Wagwcs6HVtMHaaxBjUbE7AKmxeg9nzEDcvXhN8bydUG` | [KillzzSol](https://x.com/KillzzSol) | - |
| 121 | Key | `4Bdn33fA7LLZQuuXuFLSxtPWGAUnMBcreQHfh9MXuixe` | [w3b3k3y](https://x.com/w3b3k3y) | - |
| 122 | wuzie | `Akht8EBJqFSLmhNR7Wdr53YmWjmb9URzbZYWY7FAJKeH` | [crypt0wu](https://x.com/crypt0wu) | [Link](https://t.me/wuziemakesmoney) |
| 123 | s0ber | `Hq5TTULwwmDjGvzQukgujHQogZ5uFSCyYHpP756Uvyae` | [whaIecrypto](https://x.com/whaIecrypto) | - |
| 124 | Connor | `9EyPAMyQvXaUWFxd2uQHvG8vpkKs33YdXvDvwmRXrUiH` | [Connoreo_](https://x.com/Connoreo_) | - |
| 125 | zoru | `BrT5kYQ125u6NaRKFKNiBnHak6X7MvcZSQ3LfQCB3sqg` | [zoruuuuu](https://x.com/zoruuuuu) | - |
| 126 | Nach | `9jyqFiLnruggwNn4EQwBNFXwpbLM9hrA4hV59ytyAVVz` | [NachSOL](https://x.com/NachSOL) | [Link](https://t.me/NarrativeNach) |
| 127 | Sully | `Ebk5ATdfrCuKi27dHZaw5YYsfREEzvvU8xeBhMxQoex6` | [sullyfromDeets](https://x.com/sullyfromDeets) | [Link](https://t.me/kitchenofsully) |
| 128 | Qtdegen | `7tiRXPM4wwBMRMYzmywRAE6jveS3gDbNyxgRrEoU6RLA` | [qtdegen](https://x.com/qtdegen) | - |
| 129 | Rektober | `3cG7d6GmX47HKSX5nWRX9MJpruCojbzUkak92gSXGtG5` | [rektober](https://x.com/rektober) | [Link](https://t.me/RektNFA) |
| 130 | waste management | `D2aXNmQgLnZFFoE8aSCZq1dBXKRDw29NoGY79jCscUmj` | [wastemanagem3nt](https://x.com/wastemanagem3nt) | [Link](https://t.me/managingwaste) |
| 131 | Fabix | `DN7pYLSGYqHXwvPLh8tJM2zoJjhMSsNGVRVkMWVpredr` | [Fabix_R](https://x.com/Fabix_R) | [Link](https://t.me/FabixAlpha) |
| 132 | Ferb | `m7Kaas3Kd8FHLnCioSjCoSuVDReZ6FDNBVM6HTNYuF7` | [ferbsol](https://x.com/ferbsol) | - |
| 133 | Dolo | `5wcc13mXoyqe6qh2iHH5GFknojoJ7y13ZPx9K4NXTuo3` | [doloxbt](https://x.com/doloxbt) | [Link](https://t.me/DolosTradingDojo) |
| 134 | Polly | `HtvLcCFehifb7G4j42JDn53zD7sQRiELF5WHzJzNvWMm` | [0xsushi](https://x.com/0xsushi) | [Link](https://t.me/WildyJournals) |
| 135 | Sue | `AXwssg5NjQodKofcLV6ypJL4R5usvysYt9q7YVwjEgAH` | [sue_xbt](https://x.com/sue_xbt) | [Link](https://t.me/sues_degenjournal) |
| 136 | YOUNIZ | `DVM5U7yTFUT8TwerBq1afLopuSuFs1rRVCu3KpTJbHUa` | [YOUNIZ_XLZ](https://x.com/YOUNIZ_XLZ) | - |
| 137 | i gamble your yearly salary | `KJXB1ot9nkCvq1ZD27vzNSBaPPCT82DpVnXrcwxftvY` | [aightbet](https://x.com/aightbet) | - |
| 138 | Terp | `HkFt55P3PhRWHXoTFeuvkKEE4ab26xZ1bk6UmXV88Pwz` | [OnlyTerp](https://x.com/OnlyTerp) | - |
| 139 | Prada | `gkNNf4NwkR61B1QKBFtELe6TVZFhYRaC2LbVkoNyCkB` | [0xPradaa](https://x.com/0xPradaa) | - |
| 140 | Ramset ✟ | `71PCu3E4JP5RDBoY6wJteqzxkKNXLyE1byg5BTAL9UtQ` | [Ramsetx](https://x.com/Ramsetx) | - |
| 141 | quant | `Fi2hrxExy6TJnKcbPtQpo6iZzX9SUVbB9mDw6d29NgCn` | [quantgz](https://x.com/quantgz) | - |
| 142 | Insentos | `7SDs3PjT2mswKQ7Zo4FTucn9gJdtuW4jaacPA65BseHS` | [insentos](https://x.com/insentos) | [Link](https://t.me/insentos) |
| 143 | zync (锌仔) | `zyncUiCSpP5zExdpvpRgx8twZ1AxTAqaeqtTVZ45ART` | [zyncxbt](https://x.com/zyncxbt) | - |
| 144 | mog | `EtuuyC1njBScPtYFpuDP6mxdkfTcs9zbUbJGheHzof3t` | [10piecedawg](https://x.com/10piecedawg) | - |
| 145 | TheDefiApe | `ExKCuoAzJCgCVjU3CvNoL8vVrdESTWkx3ubj6rQXwQM4` | [TheDefiApe](https://x.com/TheDefiApe) | [Link](https://t.me/DEFIAPEALERTS) |
| 146 | DJ.Σn | `Cxe1d5zFifK4a4UZoHQaCK7sfqd84XjcKy1qtjnz3bge` | [thisisdjen](https://x.com/thisisdjen) | [Link](http://t.me/djeninfo) |
| 147 | BagCalls | `4AHgEkTsGqY77qtde4UJn9yZCrbGcM7UM3vjT3qM4G5H` | [BagCalls](https://x.com/BagCalls) | [Link](https://t.me/bagcalls) |
| 148 | el charto | `CCUcjek5p6DLoH2YNtjizxYhAnStXAQAGVxhp1cYJF7w` | [elchartox](https://x.com/elchartox) | [Link](https://t.me/ChartoCartel) |
| 149 | Jack Duval🌊 | `BAr5csYtpWoNpwhUjixX7ZPHXkUciFZzjBp9uNxZXJPh` | [jackduvalstocks](https://x.com/jackduvalstocks) | - |
| 150 | Zeek | `DUTpdjVjZ3XKqeU5WFE3HbkQ77ZSaSi3CseMkr9zkC6T` | [zeekbased](https://x.com/zeekbased) | - |
| 151 | Saif | `BuhkHhM3j4viF71pMTd23ywxPhF35LUnc2QCLAvUxCdW` | [degensaif](https://x.com/degensaif) | - |
| 152 | Yokai Ryujin | `2w3zDW2e1KjYtM2pHTkgh78L8DjMrC6fuB9uhwKNigTs` | [YokaiCapital](https://x.com/YokaiCapital) | - |
| 153 | yeekidd | `88e2kBDJoN7eQCBj2sxT15etUZ3jPNzD4ijCs1TNySWJ` | [yeekiddd](https://x.com/yeekiddd) | - |
| 154 | ShockedJS | `6m5sW6EAPAHncxnzapi1ZVJNRb9RZHQ3Bj7FD84X9rAF` | [ShockedJS](https://x.com/ShockedJS) | [Link](https://t.me/shockedjstrading) |
| 155 | Oura | `4WPTQA7BB4iRdrPhgNpJihGcxKh8T43gLjMn5PbEVfQw` | [Oura456](https://x.com/Oura456) | [Link](https://t.me/OuraEmergencyCalls) |
| 156 | Lynk | `CkPFGv2Wv1vwdWjtXioEgb8jhZQfs3eVZez3QCetu7xD` | [lynk0x](https://x.com/lynk0x) | [Link](https://t.me/lynkscabal) |
| 157 | Monarch | `4uTeAz9TmZ1J5bNkgGLvqAELvCHJwLZgo7Hxar2KAiyu` | [MonarchBTC](https://x.com/MonarchBTC) | [Link](https://t.me/MonarchJournal) |
| 158 | Insyder | `G3g1CKqKWSVEVURZDNMazDBv7YAhMNTjhJBVRTiKZygk` | [insydercrypto](https://x.com/insydercrypto) | - |
| 159 | Zinc | `EBjXstFQBBnXVFEXouqGfUxQFmaEHu6KFbxrZQkGbjru` | [zinceth](https://x.com/zinceth) | [Link](https://t.me/zincalpha) |
| 160 | Lyxe | `HLv6yCEpgjQV9PcKsvJpem8ESyULTyh9HjHn9CtqSek1` | [cryptolyxe](https://x.com/cryptolyxe) | [Link](https://t.me/+yFy-8j3uwBBjMzhl) |
| 161 | Seee | `9EfTigVxHuNjqzxiv3BQ7wD2v7uFvdRQbrrnDEPr8pTk` | [tstar_frr1](https://x.com/tstar_frr1) | - |
| 162 | CC2 | `B3beyovNKBo4wF1uFrfGfpVeyEHjFyJPmEBciz7kpnoS` | [CC2Ventures](https://x.com/CC2Ventures) | - |
| 163 | Spuno | `GfXQesPe3Zuwg8JhAt6Cg8euJDTVx751enp9EQQmhzPH` | [spunosounds](https://x.com/spunosounds) | - |
| 164 | 🇩🇴 Jerry | `GmDXqHhXqfzEBErQqPft9xkznvgfkX6bcUT65MxQzNBj` | [0xJrmm](https://x.com/0xJrmm) | - |
| 165 | Brox | `7VBTpiiEjkwRbRGHJFUz6o5fWuhPFtAmy8JGhNqwHNnn` | [ohbrox](https://x.com/ohbrox) | [Link](https://t.me/broxcalls) |
| 166 | 0xJumpman | `8eioZubsRjFkNEFcSHKDbWa8MkpmXMBvQcfarGsLviuE` | [0xjumpman](https://x.com/0xjumpman) | - |
| 167 | Chris ☕️ | `CtUzwARj8A13M3hdJAXvsLkqJUfmFKqWzFXJPcq4MiMx` | [ChrisCoffeeEth](https://x.com/ChrisCoffeeEth) | - |
| 168 | Jakey | `B8kdogV1a39GPVpSiPjPdUGfFf8nx6EVexRMvdeiXB64` | [SolJakey](https://x.com/SolJakey) | - |
| 169 | kilo | `kiLogfWUXp7nby7Xi6R9t7u8ERQyRdAzg6wBjvuE49u` | [kilorippy](https://x.com/kilorippy) | - |
| 170 | Pullup 🗡️🧣✨ | `65paNEG8m7mCVoASVF2KbRdU21aKXdASSB9G3NjCSQuE` | [pullupso](https://x.com/pullupso) | - |
| 171 | Fawcette | `JBTJAkwqYR471nmeHqLSUaLezNz4Yx2wy9jYotveGnEm` | [Fawcette_](https://x.com/Fawcette_) | - |
| 172 | para | `uS74rigLoPmKdi169RPUB4VSF6T9PqChTpG5jWzVhVp` | [paradilf](https://x.com/paradilf) | - |
| 173 | Little Mustacho 🐕 | `Huk3KuMLsLBZSer2n7MXmMPAJE1eKcr8dJS6DDoM3m8f` | [littlemustacho](https://x.com/littlemustacho) | [Link](https://t.me/LittleMustachoCalls) |
| 174 | Bobby | `DBmRHNbSsVX8F6NyVaaaiuGdwo1aYGawiy3jfNcvXYSC` | [retardmode](https://x.com/retardmode) | - |
| 175 | GVQ | `GVQtcYiQLy3tKNPGzPa81RsCKycam1zLTQSybdnDjMkF` | [GVQ_xx](https://x.com/GVQ_xx) | - |
| 176 | Jordan | `EAnB5151L8ejp3SM6haLgyv3snk6oqc8acKgWEg9T5J` | [ohFrostyyy](https://x.com/ohFrostyyy) | - |
| 177 | Bolivian | `5AyJw1VNDgTho2chipbVmuGqTuX1fCvVkLneChQkQrw8` | [_bolivian](https://x.com/_bolivian) | [Link](http://t.me/boliviantrades) |
| 178 | Carti The Menace | `3mPypxb7ViYEdLv4siFmESvY5w5ZKknwgmB4TPcZ77qe` | [CartiTheMenace](https://x.com/CartiTheMenace) | - |
| 179 | Angi | `AGnd5WTHMUbyK3kjjQPdQFM3TbWcuPTtkwBFWVUwiCLu` | [angitradez](https://x.com/angitradez) | [Link](https://t.me/angiscalls) |
| 180 | Value & Time | `3nvC8cSrEBqFEXZjUpKfwZMPk7xYdqcnoxmFBjXiizVX` | [valueandtime](https://x.com/valueandtime) | - |
| 181 | Dutch | `9vWutdTBs66hWkeCmxaLFpkKy4q5RSe8DsFjfdxj5yFA` | [0xDutch_](https://x.com/0xDutch_) | - |
| 182 | Hustler | `HUS9ErdrDqpqQePbmfgJUTnDTE6eZ8ES62a25RihSK9U` | [JoeVargas](https://x.com/JoeVargas) | [Link](https://t.me/hustlersalpha) |
| 183 | Rev | `EgzjRCbcdRiPc1bW52tcvGDnKDbQWCzQbUhDBszD2BZm` | [solrevv](https://x.com/solrevv) | - |
| 184 | .exe | `42nsEk51owYM3uciuRvFerqK77yhXZyjBLRgkDzJPV2g` | [itoptick](https://x.com/itoptick) | [Link](https://t.me/exejournal) |
| 185 | Jalen | `F72vY99ihQsYwqEDCfz7igKXA5me6vN2zqVsVUTpw6qL` | [RipJalens](https://x.com/RipJalens) | - |
| 186 | Sabby | `9K18MstUaXmSFSBoa9qDTqWTnYhTZqdgEhuKRTVRgh6g` | [sabby_eth](https://x.com/sabby_eth) | - |
| 187 | Mitch | `4Be9CvxqHW6BYiRAxW9Q3xu1ycTMWaL5z8NX4HR3ha7t` | [idrawline](https://x.com/idrawline) | [Link](https://t.me/whimsicalclown) |
| 188 | Rizz | `BPWsae36tY6oFz7f5MjsfTGqzi3ttM1AsAtjMvUb91tT` | [sollrizz](https://x.com/sollrizz) | - |
| 189 | Collectible | `Ehqd8q5rAN8V7Y7EGxYm3Tp4KPQMTVWQtzjSSPP3Upg3` | [collectible](https://x.com/collectible) | - |
| 190 | cxltures | `3ZtwP8peTwTfLUF1rgUQgUxwyeHCxfmoELXghQzKqnAJ` | [cxlturesvz](https://x.com/cxlturesvz) | - |
| 191 | Michi | `8YYDiCbPd4nM8TxrQEVdPA4aG8jys8R7Z1kKsgPL4pwh` | [michibets](https://x.com/michibets) | - |
| 192 | evening | `E7gozEiAPNhpJsdS52amhhN2XCAqLZa7WPrhyR6C8o4S` | [eveningbtc](https://x.com/eveningbtc) | - |
| 193 | Obijai | `5dhKiVtynZVDWGgvAFrz9mPPU1VNKkaMrcbrjKMtoANw` | [Obijai](https://x.com/Obijai) | - |
| 194 | shaka | `4S8YBCt6hhi7Nr1NnKF6jF856LLN8JJFzD1a8nF5UuHA` | [solanashaka](https://x.com/solanashaka) | [Link](https://t.me/shakasisland) |
| 195 | aloh | `FGVjsmD76HMcMa6NNzhwxZ2qpx25fGnAZT7zF2A3SWtH` | [alohquant](https://x.com/alohquant) | [Link](https://t.me/alohcooks) |
| 196 | Fuzz | `FUZZUhT5qKncddMxLnkeiN7Dh1CmSpWPScp55iexZ85t` | [slfuzz](https://x.com/slfuzz) | - |
| 197 | ִֶָ | `B57ChV7Sa7FToRFsKWRWi5QPJJUn6cv4CuMQCzgw4VY2` | [fshmatt](https://x.com/fshmatt) | [Link](https://t.me/fullstackhitler) |
| 198 | RUSKY 🪬⚡️ | `J4rYYPEXHwYMvyNzVwRsTyaSVpHv4SXK6kQNGgvBdvc4` | [CryDevil23](https://x.com/CryDevil23) | [Link](https://t.me/cryptorusky) |
| 199 | kyz | `72YiE4crBv2UhxRgRYKs4GaTGT2avbacfL4HNCfQLqsm` | [kyzenill](https://x.com/kyzenill) | - |
| 200 | Noah | `6DwBGYF7JbLUmsMeAGn9ZMCv2sKF6s6UGAQtBkDzJtw4` | [Noahhcalls](https://x.com/Noahhcalls) | [Link](https://t.me/noahhcalls) |
| 201 | Achi | `FPx2BavA7J2C7Nz6WpoPL9f5kDAKjxLb38PHNZMoxCra` | [AchillesXBT](https://x.com/AchillesXBT) | - |
| 202 | asta | `AstaWuJuQiAS3AfqmM3xZxrJhkkZNXtW4VyaGQfqV6JL` | [astaso1](https://x.com/astaso1) | - |
| 203 | Al4n | `2YJbcB9G8wePrpVBcT31o8JEed6L3abgyCjt5qkJMymV` | [Al4neu](https://x.com/Al4neu) | - |
| 204 | fomo 🧠 | `9FEHWFjgbYnFCRRHkesJNq6znHjc5Aaq7TiKi1rCVSnH` | [fomomofosol](https://x.com/fomomofosol) | - |
| 205 | deecayz ⌐◨-◨ | `Dv32u9mvSXGVNshf7xM7afuMoPRifQxzuzEjfmfMysZY` | [deecayz](https://x.com/deecayz) | [Link](https://t.me/summerprinter) |
| 206 | 0xBossman | `BjYxVF81MgahqgahDTUEGzxzP7bZrA4p5Dg67Y4e3bXZ` | [0xBossman](https://x.com/0xBossman) | [Link](http://t.me/BossmanCallsOfficial) |
| 207 | iconXBT | `2FbbtmK9MN3Zxkz3AnqoAGnRQNy2SVRaAazq2sFSbftM` | [iconXBT](https://x.com/iconXBT) | - |
| 208 | yassir | `HFx9E1vvWyoMmiHuTMSAQ2GRkJ2N4snCUwhUMr83LLSs` | [yassirwtf](https://x.com/yassirwtf) | - |
| 209 | woopig🧙🏻‍♂️ | `9Bs2XgZynPdMfbpn3HQX8NKWLToPDwGrMHRbZruwbyPD` | [crypto_woopig](https://x.com/crypto_woopig) | [Link](https://t.me/woopigschannel) |
| 210 | sarah milady | `AAMnoNo3TpezKcT7ah9puLFZ4D59muEhQHJJqpX16ccg` | [saracrypto_eth](https://x.com/saracrypto_eth) | [Link](https://t.me/Solana100xhunt) |
| 211 | eq | `7w7f4P284zJhv3zotjCUmaNsZSsrHQKtpXGBJFq8gdzq` | [404flipped](https://x.com/404flipped) | - |
| 212 | R💫WDY | `DKgvpfttzmJqZXdavDwTxwSVkajibjzJnN2FA99dyciK` | [RowdyCrypto](https://x.com/RowdyCrypto) | [Link](https://t.me/CryptoUpdates) |
| 213 | Maurits | `274vmGgKuYQp8Fxvb8n3cr9ZeY3SYM6LgeaXM6jS2nD6` | [mauritsneo](https://x.com/mauritsneo) | [Link](https://t.me/mauritsfree) |
| 214 | Dolo 🥷 | `EeSx4wehRQhEbmbyFvfqA633v2P4C558bHh2ed7zgZh` | [Dolonomix](https://x.com/Dolonomix) | [Link](https://t.me/DolosColdCalls) |
| 215 | Fizzwick Bramblewhistle | `3pcmVZ1DwKbqnjbGbeg3FycThT1AkTpGQYB96jGU6oS1` | [fizzwickBW](https://x.com/fizzwickBW) | - |
| 216 | Nils😈 | `FkL99xVBParNcPTjxnLdqFFCg3cvcR7NjCGkMgDPFfW3` | [nilsthedegen](https://x.com/nilsthedegen) | [Link](https://t.me/nilshouse) |
| 217 | zurh | `HYgRa7NfuNhGZ7hsPix4N7evmmU5t5BTUUEoxwFcTKJD` | [zurhxbt](https://x.com/zurhxbt) | - |
| 218 | Fwasty | `J15mCwMU8EeSvaiFTTyM8teCoxXf82aLUh6FgtDy5q1g` | [Fwasty](https://x.com/Fwasty) | - |
| 219 | Dedmeow5 | `9THzoX5yGNSgPBAjCF4Lgqc1wLXoFkMQit4XWbhhRnqE` | [dedmeow5](https://x.com/dedmeow5) | [Link](https://t.me/nicotinelounge) |
| 220 | Charlie | `14k7D9HA5zff4EmQD6QTPBqM25CRiEA7ZqTjM3fhypgz` | [Charlduyomeme](https://x.com/Charlduyomeme) | - |
| 221 | JinMu | `8tP391aDbKKpQS7eKnCEfnJ8Cmek6jatEe2LFkdJ2PRP` | [LongzuAlpha](https://x.com/LongzuAlpha) | [Link](https://t.me/jinmucall) |
| 222 | Nuotrix | `Aa5LycwALUjaGeLyqe7y2jLZX3QetYnZqyvW2bLpwc2Q` | [Nuotrix](https://x.com/Nuotrix) | - |
| 223 | Dragon | `6SYhd67FqypKyNqd5iFikRhrmKAKcCwwurSYUAMNSH4r` | [DragonOnSol](https://x.com/DragonOnSol) | - |
| 224 | Iced | `DrJ6SnDXkEsPeGdmSs93v5rwWumv5QMvAGSZjAyWSd5o` | [IcedKnife](https://x.com/IcedKnife) | [Link](https://t.me/houseofdegeneracy) |
| 225 | Crypto Chef | `EbSjMKQ4GiAxawit6LuHBjDqhC5gYGQhbH2YpBerJiCJ` | [TheCryptoChefX](https://x.com/TheCryptoChefX) | [Link](https://t.me/CryptoChefCooks) |
| 226 | lucky flash | `2vXMy7EdkvU6SVzex1kfSeVhrBApC8WU4m9RQTTt4Ro4` | [flashcashy](https://x.com/flashcashy) | - |
| 227 | Yugi | `4TCMpxeevymUtCemwcVozhBLWq8Fikc1pVpfcW9zp66B` | [CryptoYugi0](https://x.com/CryptoYugi0) | - |
| 228 | eezzyLIVE 🧸 | `DiDbxfveAcnescZWYjkVJzXiEWjskZKAFVTq2hrfHNjN` | [notEezzy](https://x.com/notEezzy) | [Link](http://t.me/eezzyjournal) |
| 229 | zhynx | `zhYnXqK3MNSmwS3yxSvPmY5kUa1n2WUaCJgYUDrAHkL` | [onlyzhynx](https://x.com/onlyzhynx) | [Link](http://t.me/zhynxjournal) |
| 230 | nich | `nichQ7m3W37WJ9beNLZfTj27gLrjC7ddq4YguHufYas` | [nichxbt](https://x.com/nichxbt) | - |
| 231 | Frags | `2yoJibiZUGB1gs31gvtynRTyx9vmj8VrWoQvXDDzUFHS` | [cryptofrags](https://x.com/cryptofrags) | - |
| 232 | ItsVine | `ztRg1PdZbBQzMGbaz5UXqzaKX4frC82USoWiaVfohSv` | [ItsVineSOL](https://x.com/ItsVineSOL) | - |
| 233 | Rice | `CWvdyvKHEu8Z6QqGraJT3sLPyp9bJfFhoXcxUYRKC8ou` | [Ricecooker38](https://x.com/Ricecooker38) | - |
| 234 | KennyLoaded | `3BEtHGzhdWPtxSzqVsBorWpbi4jfMvD5cCZy1Qrtac7E` | [KennyLoaded](https://x.com/KennyLoaded) | - |
| 235 | Storm | `EYBMFf8mUyvZobqX7bkaCrvZ6bHCYxeVjFHQ9v2bmtAy` | [StormsTrades](https://x.com/StormsTrades) | - |
| 236 | Baraka | `CUKFKdJw7F91bZBbtAJMrLLxqtVigVSJhx644EFnCnw` | [baraka_wins](https://x.com/baraka_wins) | [Link](https://t.me/Jan_Cook) |
| 237 | denzaa | `4X199Pq6etVAdmZf5zfbhAu18biucGip3jFZMj3qvCA8` | [denzzaaa](https://x.com/denzzaaa) | - |
| 238 | arnz | `2G6CNJqfvGP3KWZXtV8rQHra3kxGK28nvzT6TjyWNtiJ` | [arnzxbt](https://x.com/arnzxbt) | [Link](https://t.me/xbtarnz) |
| 239 | Canis | `AzXDG1LSULfMai1Rpw9uzMtk3osdK2vmeBWFYKjymSAo` | [Canissolana](https://x.com/Canissolana) | - |
| 240 | ⚫️ | `13gj9sYDkj42PsC7koDk2cR9mj2YpVQxWvSBLcJcLkzG` | [jo5htheboss](https://x.com/jo5htheboss) | - |
| 241 | Iz | `FH6jdKkoRg8MQKrtAUwiHq53FyCwoeNQ1ok4doFwGMUg` | [IzCryptoG](https://x.com/IzCryptoG) | [Link](https://t.me/IzAlphaCalls) |
| 242 | milito | `EeXvxkcGqMDZeTaVeawzxm9mbzZwqDUMmfG3bF7uzumH` | [fnmilito](https://x.com/fnmilito) | - |
| 243 | voyage | `BJeWdzF9HVeWHktxwS9u8FbCrdSDRrDoS3S9stLafdQJ` | [voyage940](https://x.com/voyage940) | - |
| 244 | GK | `GxifJqkZv6CvgLVpcv5Z8tkqcCyVSWfUyvr2zCCjpEmV` | [Ygktgk](https://x.com/Ygktgk) | [Link](http://t.me/Ygktgk) |
| 245 | neko ≈💧🌸 | `7EQjTHVNHunhQHT7iRQDCR99mjDm2GvHyGKHVGzX8jv2` | [n_ekox](https://x.com/n_ekox) | - |
| 246 | Lunar cipher | `EtVEeqiKcf9Wgp38Z3L8HFi3heT4nPxsoDwe6cxwkqhc` | [Lunarc1pher](https://x.com/Lunarc1pher) | [Link](https://t.me/lunarsvault) |
| 247 | Jays | `By5huc2NCHjiA293DvstgNiQEEnmta2fkoyx86hsReTj` | [JaysOnEBT](https://x.com/JaysOnEBT) | - |
| 248 | Niners | `2RyUYqX1VFoGdDSKm3brWV5c2bY4thXx1Wctz22uYS1p` | [Niners](https://x.com/Niners) | - |
| 249 | Exploitz | `F5Tw3a3sUNXRUVabtKPE9C6mRxAoMnKDd8W2SLFQtAEB` | [exploitzonsol](https://x.com/exploitzonsol) | - |
| 250 | Lockiner | `ErhZ8c1DA68BUcxUBcLVrL4w457dU48dxNiqeehSGB5p` | [lockiner](https://x.com/lockiner) | - |
| 251 | Sugus | `2octNbV8QTtaFMJtbWhtkqMQt3deBe4D8mYcNworhv3t` | [SugusTrader](https://x.com/SugusTrader) | - |
| 252 | Basel de’ Medici | `8vPVTTpVamqRJKLhEQdupHTzGEJq23HE1pdC2Lic157t` | [bassel_amin](https://x.com/bassel_amin) | - |
| 253 | LUKEY ✣ | `DjM7Tu7whh6P3pGVBfDzwXAx2zaw51GJWrJE3PwtuN7s` | [VERYKOOLLUKEY](https://x.com/VERYKOOLLUKEY) | - |
| 254 | dints | `3PWGw2AmfR641mLLS1GhGSMcfbDft59EUFuvHf7TpDwU` | [dintsfi](https://x.com/dintsfi) | - |
| 255 | jimmy | `HcpsFY1tDhuzEGGwuqyYy6PSi6hHEjGbFKMz4oA5BicY` | [JIMMYEDGAR](https://x.com/JIMMYEDGAR) | - |
| 256 | bradjae | `8Dg8J8xSeKqtBvL1nBe9waX348w5FSFjVnQaRLMpf7eV` | [bradjae](https://x.com/bradjae) | - |
| 257 | Cesco.Sol | `7wr4Hf1v72q9eYXRYYg4jpfud3QPL3xLQHFYkZqRMdo4` | [Cesco_Sol](https://x.com/Cesco_Sol) | [Link](https://t.me/Cescone93) |
| 258 | AdamJae | `4xUEz1saHSQv1yvo4MhFL3bYM7AVgp7Jq5HhLQwdUeBy` | [Adam_JAE](https://x.com/Adam_JAE) | - |
| 259 | Crypto Pirate | `8mp548ZBaSavzpTHVeytQ4XGpVpbVZx9p2UxVyAJvRxV` | [Crypt0Pirate_](https://x.com/Crypt0Pirate_) | [Link](https://t.me/TheCryptoPirateBay) |
| 260 | maybe | `Gp9W8Qa2J1RQLvJNkJd8GDgqY16yAQfyzC4DiDZewKb7` | [marekeacc](https://x.com/marekeacc) | [Link](https://t.me/maybbtc) |
| 261 | appie | `7WaL6oKHAKtDtVBNHsSo61XenQFWsbd4KKrS5o1DWAjy` | [appiesol_](https://x.com/appiesol_) | - |
| 262 | ocr | `3MNu91fiPyCefHL88aBYntpwfraf3dBrqJ8VYjJQyaqt` | [ocrxa](https://x.com/ocrxa) | - |
| 263 | Nikolas (aura arc) | `iPUp3qkm39ycMGbywWFMUyvaDhiiPGXeWXaDtmHNe6C` | [ArcNikolas](https://x.com/ArcNikolas) | [Link](https://t.me/nikolasapes) |
| 264 | Kaaox | `GPryzRs7NshgCoxp382oYoye5PrfUBq8xE1CoEfNayNh` | [xKaaox](https://x.com/xKaaox) | - |
| 265 | 7xNickk | `AmofvGJ59dgf5P85Pofip83pk7nZqrQRmSZvv5rRFVtf` | [7xNickk](https://x.com/7xNickk) | - |
| 266 | Levis | `GwoFJFjUTUSWq2EwTz4P2Sznoq9XYLrf8t4q5kbTgZ1R` | [LevisNFT](https://x.com/LevisNFT) | [Link](https://t.me/LevisAlpha) |
| 267 | Pocket Hitlers | `9RrKUhRpbPDNxR7x88ZsCgdtqPHUfwYPjj4JdpV4FBj9` | [pockethitlers](https://x.com/pockethitlers) | - |
| 268 | Rilsio | `4fZFcK8ms3bFMpo1ACzEUz8bH741fQW4zhAMGd5yZMHu` | [CryptoRilsio](https://x.com/CryptoRilsio) | [Link](https://t.me/rilsio) |
| 269 | Yami 𓃵 | `7Js5gmq57y9jG2sseKrAeJt3vbncSWSFFHDEsyJDnyVm` | [YamiPNL](https://x.com/YamiPNL) | - |
| 270 | Ray | `HvNqQBTfoiksyvzGR5rrNAv46DjeNgGNMTB5YZpYh16W` | [23slyy](https://x.com/23slyy) | - |
| 271 | Chairman ² | `Be24Gbf5KisDk1LcWWZsBn8dvB816By7YzYF5zWZnRR6` | [Chairman_DN](https://x.com/Chairman_DN) | - |
| 272 | Exy | `8hKZKqCgZWxnvRz1XAvmbuzCAfqo5xFjH17vM2J2HTe1` | [eth_exy](https://x.com/eth_exy) | - |
| 273 | dyor ( revenge arc ) | `AVmFMbuehLbCWB6sPdZGComwyrHtxJETZVktdA65j3Gq` | [dyorwgmi](https://x.com/dyorwgmi) | [Link](http://t.me/dyormind) |
| 274 | Unipcs (aka 'Bonk Guy') | `5M8ACGKEXG1ojKDTMH3sMqhTihTgHYMSsZc6W8i7QW3Y` | [theunipcs](https://x.com/theunipcs) | - |
| 275 | Toz | `Fza6jHuaxeJGj3pMtWdTuYs52BHstpnpGawg2SWEra9` | [Cryptoze](https://x.com/Cryptoze) | [Link](https://t.me/Cryptoze0) |
| 276 | jazz | `3wDWKhxmvHaMwk2vc3aTgeY5oTqUnGhuDJgJfC9uyRKg` | [youngjazzeth](https://x.com/youngjazzeth) | - |
| 277 | Win All Day | `Gtg4qSMkxME783rNdwHYQ11DbQvoXgLodTBLAAa8G5C2` | [winallday_](https://x.com/winallday_) | - |
| 278 | Roxo | `AE3tJDEyUdwBM8ZoUb3iCo563gMbq26JtckfvjcVZbSa` | [ignRoxo](https://x.com/ignRoxo) | - |
| 279 | PRINCESS | `6vZenwrWzCE4aU59CP2SuAotjMHDU9FFcaNNkGXrnPoZ` | [lifebyprincess](https://x.com/lifebyprincess) | [Link](http://t.me/lifebyprincess) |
| 280 | fawi | `A3JBfM4aj2u5g5QdWzA6tVbFzCd8RpfL3jxCDHrM9Qn7` | [freakyfawi](https://x.com/freakyfawi) | - |
| 281 | Donuttcrypto | `3wjyaSegfV7SZzjv9Ut1p6AcY5ZdoZjmu6i6QPCVvnmz` | [donuttcrypto](https://x.com/donuttcrypto) | [Link](https://t.me/donuttcryptocalls) |
| 282 | Ron | `8JuRx7WEtgEwP6KqJ8s8FuaMfwbKUwthqFVhRQtP6Ehn` | [ronpf_](https://x.com/ronpf_) | - |
| 283 | Rozer | `4hGiRipRQHS7c1b5fCHVv4fG7eK4XMtfmQZVkpvSkvoK` | [Rozer_](https://x.com/Rozer_) | [Link](http://t.me/rozeralpha) |
| 284 | nad | `363sqMFaxZgvCoGzxKjXe1BqMGYkSVoCwmghZUndXuaT` | [NADGEMS](https://x.com/NADGEMS) | [Link](https://t.me/NADSGEMS) |
| 285 | Fey | `B6Jx8R9VQDAbwq4rkxsgsWgiJ6GKgWm4ZgCtat2BaHni` | [fey_xbt](https://x.com/fey_xbt) | - |
| 286 | Boru | `3rwzJNVRrprfTQD3xFgxRK279tVAhNBtGtQk4WdP6Lu2` | [boru_crypto](https://x.com/boru_crypto) | [Link](https://t.me/boru_insider) |
| 287 | guappy | `3TsRAE3Pdx4eJAcxbiwi9NY8mNYChEkjV5DbAwazFKSq` | [guappy_eth](https://x.com/guappy_eth) | - |
| 288 | ChartFu | `7i7vHEv87bs135DuoJVKe9c7abentawA5ydfWcWc8iY2` | [ChartFuMonkey](https://x.com/ChartFuMonkey) | - |
| 289 | buka ᚠ ᛏ ᚲ | `8T1HF5gr2fcULHv3j3nu4koGALCmc8puGGonggmwfg55` | [bukasphere](https://x.com/bukasphere) | [Link](https://t.me/bukasaurt) |
| 290 | Mr. Frog | `4DdrfiDHpmx55i4SPssxVzS9ZaKLb8qr45NKY9Er9nNh` | [TheMisterFrog](https://x.com/TheMisterFrog) | [Link](https://t.me/misterfrogofficial) |
| 291 | trav 🎒 | `CXnf4Tt7qFz3KZNwn3Yve5MKaRyxGoAy2eDX3QT8e99m` | [travonsol](https://x.com/travonsol) | [Link](https://t.me/travjournal) |
| 292 | B* | `3wZ6MfB1DRUvtozvcptvV1qAhQ5FKj3qpZR4Db45G6jk` | [BeezyScores](https://x.com/BeezyScores) | - |
| 293 | boogie | `75oEqXZC569dY1G6UweXviPz4pm8zkhKDSk2FT9Dug5i` | [boogiepnl](https://x.com/boogiepnl) | - |
| 294 | Thurston (zapped arc) | `ALauG4FwEYDgSXd5Hen6kvuWSCdUi2fYNSNqM1Ci31wE` | [itsthurstxn](https://x.com/itsthurstxn) | - |
| 295 | Owl | `A5uxHmjTVyBd1Aj4BFUAekujpPjaWnCrLSRJhjAyvjH4` | [OwlFN_](https://x.com/OwlFN_) | - |
| 296 | printer | `Bu8iZsGvS5dwuY3GiEDjUSDayEME7LthH4x7TRGTnMXA` | [prxnterr](https://x.com/prxnterr) | - |
| 297 | Bronsi | `4ud45nGBqtBptQPyoVtcLCCCs1Evh1zLsVVLMmDQn2JW` | [Bronsicooks](https://x.com/Bronsicooks) | [Link](https://t.me/Bronsisinsiderinfo) |
| 298 | staticc | `9pgKiUsNHXMe5p4DoGwzT9i6of7XympnNJ5TgbrZVqk6` | [staticctrades](https://x.com/staticctrades) | - |
| 299 | Sweep | `GP9PyTwGybX3q3tC5dMRKeuq8Dr15uPVvn3Z9fKbempH` | [0xSweep](https://x.com/0xSweep) | [Link](https://t.me/jsdao) |
| 300 | dingaling | `9X5n5i1mugTjgGPhqf1KJDt8r4kD8TF3s62ttbxKzFHa` | [dingalingts](https://x.com/dingalingts) | - |
| 301 | Don | `winkACDSxstg19HJgX1pwDGpD8f2ZpiqqAjyAbkgXLu` | [doncaarbon](https://x.com/doncaarbon) | [Link](https://t.me/dontrenches) |
| 302 | Sizeab1e | `AtmeWwb6Y6KNDgu2dPJT5dsar84bFCbNxLiW2DyYfm8p` | [sizeab1e](https://x.com/sizeab1e) | [Link](https://t.me/thetradingcorps) |
| 303 | oscar | `AeLb2RpVwrqKZJ87PEiFdReiEXJXACQn17c8APQS1FHx` | [oscarexitliq](https://x.com/oscarexitliq) | - |
| 304 | JB | `7dP8DmRka5rmQti4zEEDjdAyaQyvFsPkcXMjEKJucqCu` | [Jeetburner](https://x.com/Jeetburner) | - |
| 305 | Enjooyer | `Enjoy9BmQgAUD9AKC4HpUbHByVdzwp7jQppKukEvdyWm` | [0xEnjooyer](https://x.com/0xEnjooyer) | - |
| 306 | LilMoonLambo | `GJyhzLoZAxZHZGPvF3V1wsyGUnoGSQ55n6hN6nHv7W8B` | [LilMoonLambo](https://x.com/LilMoonLambo) | - |
| 307 | Solstice | `GrD2umbfEBjQKFPDQvmmYNQ5eyRL9SAdWJj9FFMyeaDN` | [The__Solstice](https://x.com/The__Solstice) | [Link](https://t.me/solsticesmoonshots) |
| 308 | Hail | `HA1L7GhQfypSRdfBi3tCkkCVEdEcBVYqBSQCENCrwPuB` | [ignHail](https://x.com/ignHail) | - |
| 309 | Jeets | `D1H83ueSw5Nxy5okxH7VBfV4jRnqAK5Mm1tm3JAj3m5t` | [ieatjeets](https://x.com/ieatjeets) | - |
| 310 | Daumen | `8MaVa9kdt3NW4Q5HyNAm1X5LbR8PQRVDc1W8NMVK88D5` | [daumenxyz](https://x.com/daumenxyz) | - |
| 311 | FINN | `BTeqNydtKyDaSxQNRm8ByaUDPK3cpQ1FsXMtaF1Hfaom` | [finnbags](https://x.com/finnbags) | - |
| 312 | Thesis ✍️ | `5S9qzJhSooakBaA9qZT6vWtoSy8FvyfxJ4t1vXvEK9G7` | [Theeesis](https://x.com/Theeesis) | - |
| 313 | Eddy 💹🧲 | `DuGezKLZp8UL2aQMHthoUibEC7WSbpNiKFJLTtK1QHjx` | [EddyMetaX](https://x.com/EddyMetaX) | [Link](https://t.me/MrEduTrades) |
| 314 | Megz 🦉 | `CECN4BW4DKnbyddkd9FhWVR5dotzKhQr5p7DUPhQ55Du` | [DeltaXtc](https://x.com/DeltaXtc) | - |
| 315 | Damian Prosalendis | `AEeJUPCiGR3yCoukTh1G58o4LYsUEyzrXtfmfMc2kJMX` | [DamianProsa](https://x.com/DamianProsa) | [Link](http://t.me/prosacalls) |
| 316 | Latuche | `GJA1HEbxGnqBhBifH9uQauzXSB53to5rhDrzmKxhSU65` | [Latuche95](https://x.com/Latuche95) | - |
| 317 | Inside Calls | `4NtyFqqRzvHWsTmJZoT26H9xtL7asWGTxpcpCxiKax9a` | [insidecalls](https://x.com/insidecalls) | [Link](http://t.me/callsfromwithin) |
| 318 | storm | `Dxudj2DQ5odnqgZvUocaeWc1eYC78Q8vfmVtPpvTrRNh` | [stormtradez](https://x.com/stormtradez) | [Link](http://t.me/stormcooks) |
| 319 | Dusty | `B799XD2RtgkxYRvv5Q9CFnSpVifrsJErWz6MpvBdYFdR` | [guidustyy](https://x.com/guidustyy) | [Link](https://t.me/dustycalls) |
| 320 | narc | `CxgPWvH2GoEDENELne2XKAR2z2Fr4shG2uaeyqZceGve` | [narracanz](https://x.com/narracanz) | - |
| 321 | Bastille | `3kebnKw7cPdSkLRfiMEALyZJGZ4wdiSRvmoN4rD1yPzV` | [BastilleBtc](https://x.com/BastilleBtc) | - |
| 322 | racks | `CM1dn5LZ21o6PQv3NQpQeEFPGGo9dNpSQ4eWQctmp17g` | [rackstm_](https://x.com/rackstm_) | - |
| 323 | gr3g | `J23qr98GjGJJqKq9CBEnyRhHbmkaVxtTJNNxKu597wsA` | [gr3gor14n](https://x.com/gr3gor14n) | - |
| 324 | dxrnelljcl | `3jzHjoPKaceZjA6AqAWka7Ghw9F3w9k9cvjGTmybdioT` | [dxrnell](https://x.com/dxrnell) | - |
| 325 | set | `62N1K57D37AUDGp68tnDYKPjGDsaAAtmo357nBtEtuR` | [Setuhx](https://x.com/Setuhx) | - |
| 326 | psykø | `FC3nyVqdufVfrgXiRJEqgST1JdJSEBEz6a9KoBfFP7c4` | [psykogem](https://x.com/psykogem) | - |
| 327 | Bluey | `6TAHDM5Tod7dBTZdYQxzgJZKxxPfiNV9udPHMiUNumyK` | [Blueycryp](https://x.com/Blueycryp) | - |
| 328 | Junior | `3tnzEgqo6U19ocZbbc49vcGv3mGSoWNFAYjQQk5gF2qP` | [Junior_dot_](https://x.com/Junior_dot_) | - |
| 329 | bruce | `4xHGhy4r41XNEgeHpKSC725aZjy6tR5E92xNjs4odBPR` | [onchainscammer](https://x.com/onchainscammer) | - |
| 330 | EvansOfWeb | `5RQEcWJZdhkxRMbwjSq32RaocgYPaWDhi3ztimWUcrwo` | [EvansOfWeb3](https://x.com/EvansOfWeb3) | - |
| 331 | mercy | `F5jWYuiDLTiaLYa54D88YbpXgEsA6NKHzWy4SN4bMYjt` | [mercularx](https://x.com/mercularx) | - |
| 332 | Banf | `Fv8byBKV8jK8jxoUtgB1A1dqGcxSoN8x7bUZobP8Xn1d` | [BanfSol](https://x.com/BanfSol) | - |
| 333 | Mak | `3SU8wjyKGsKZWdxVfak6gkApBqZ8twP613HDGc8Httzr` | [MakXBT](https://x.com/MakXBT) | [Link](https://t.me/MaksJournal) |
| 334 | Jookiaus | `jsjsxPQQ8xoHvQ7ezhKiKWD8FnZe9txuRw3ewKRZUsb` | [JookCrypto](https://x.com/JookCrypto) | - |
| 335 | dash | `4ESzFZUWUdr2GsgHBVeQKuzAmBWS5sRSaXw6PZH2EAau` | [dashcrypto_](https://x.com/dashcrypto_) | - |
| 336 | unprofitable | `DYmsQudNqJyyDvq86XmzAvrU9T7xwfQEwh6gPQw9TPNF` | [exitliquid1ty](https://x.com/exitliquid1ty) | - |
| 337 | Zemrics | `EP5mvfhGv6x1XR33Fd8eioiYjtRXAawafPmkz9xBpDvG` | [Zemrics](https://x.com/Zemrics) | - |
| 338 | wizard | `DwCp9GZw3ueoXPykHSPUkRZEwcTVbJH2i9Sf1cXYicWf` | [w1zar9](https://x.com/w1zar9) | - |
| 339 | rambo | `2net6etAtTe3Rbq2gKECmQwnzcKVXRaLcHy2Zy1iCiWz` | [goatedondsticks](https://x.com/goatedondsticks) | - |
| 340 | fl0wjoe | `9v9Xsxxu2pi4cDkTHtyL1Rg417uga48R2VcCP4L1Pe9R` | [fl0wjoe](https://x.com/fl0wjoe) | - |
| 341 | CookDoc | `Dvbv5TdAyPpJk16X9mUxWFVicYtCUxTLhuof8TGuUaRv` | [CookDoc1993](https://x.com/CookDoc1993) | - |
| 342 | Heyitsyolo | `Av3xWHJ5EsoLZag6pr7LKbrGgLRTaykXomDD5kBhL9YQ` | [Heyitsyolotv](https://x.com/Heyitsyolotv) | - |
| 343 | Matt | `3bzaJd5yZG73EVDz8xosQb7gfZm2LN5auFGh6wnP1n1f` | [MattFws](https://x.com/MattFws) | - |
| 344 | bilo | `7sA5em1nTKmLvGm8H85cpgA9hM9YvCoPp729mwe6akhh` | [chargememan](https://x.com/chargememan) | - |
| 345 | Coasty | `CATk62cYqDFXTh3rsRbS1ibCyzBeovc2KXpXEaxEg3nB` | [coasty_sol](https://x.com/coasty_sol) | - |
| 346 | Hueno | `FWAmTVsmAjxYZe4Nt5ooLDg6AHHUx3ST3nz89oGSGu59` | [HuenoZ](https://x.com/HuenoZ) | [Link](https://t.me/HuenosTaxEvaders) |
| 347 | decu | `4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9` | [notdecu](https://x.com/notdecu) | [Link](https://t.me/DecusCalls) |
| 348 | Mike | `A8i6J8B1DgVdQaoeyrCmc18473EzYocEtZGavHT4sXzw` | [mike8pump](https://x.com/mike8pump) | - |
| 349 | OGAntD | `215nhcAHjQQGgwpQSJQ7zR26etbjjtVdW74NLzwEgQjP` | [0GAntD](https://x.com/0GAntD) | - |
| 350 | Boomer | `4JyenL2p8eQZAQuRS8QAASy7TzEcqAeKGha6bhiJXudh` | [boomerbuilds](https://x.com/boomerbuilds) | - |
| 351 | Beaver | `GM7Hrz2bDq33ezMtL6KGidSWZXMWgZ6qBuugkb5H8NvN` | [beaverd](https://x.com/beaverd) | - |
| 352 | Sebi | `DxwDRWxQXDaVZquH3YvCVBQ75nUf16FttQ4q88okn5mc` | [limpcritisism](https://x.com/limpcritisism) | - |
| 353 | Lucas | `6uwzmiSnR2vVwrh6EsQfuwSVk8ScqsfYkJPQQ2eydU2M` | [LockedInLucas](https://x.com/LockedInLucas) | [Link](https://t.me/frontruncalls) |
| 354 | S | `ApRnQN2HkbCn7W2WWiT2FEKvuKJp9LugRyAE1a9Hdz1` | [runitbackghost](https://x.com/runitbackghost) | - |
| 355 | Rem | `3pfqebV65sHMbF5z86HsPKSiTxwpNhCzjK5X7GUqCbtK` | [yeaitsrem](https://x.com/yeaitsrem) | - |
| 356 | Zoke | `6MrVEEBypwJuakxLQTeEvidCgM6LDLtfMQeWdnrjpobM` | [z0ke](https://x.com/z0ke) | - |
| 357 | King | `69z4qTgQ5DBRTJvnQzx2h8jZhNsv5UgADotEwwKUm2JS` | [thekryptoking_](https://x.com/thekryptoking_) | - |
| 358 | Tally ꨄ︎ | `JAmx4Wsh7cWXRzQuVt3TCKAyDfRm9HA7ztJa4f7RM8h9` | [tallxyyy](https://x.com/tallxyyy) | [Link](https://t.me/Tallxybunker) |
| 359 | Veloce | `2W14ahXD3XBfWJchQ4K5NLXmguWWcTTUTuHDhEzeuvP3` | [VeloceSVJ](https://x.com/VeloceSVJ) | - |
| 360 | fz7 | `G2mgnzpr59vYjKpwU9q5zVfS9yQ9HezMwjuqF7LACvR4` | [fz7](https://x.com/fz7) | - |
| 361 | Dex | `mW4PZB45isHmnjGkLpJvjKBzVS5NXzTJ8UDyug4gTsM` | [igndex](https://x.com/igndex) | - |
| 362 | Xanse. | `B9K2wTQcRDLRLhMKFyRh2hPqHrr6VKiCC9yNGpkMUXrh` | [xansey](https://x.com/xansey) | [Link](https://t.me/Xansey_Citadel) |
| 363 | Advyth | `GEKZWL474tFAyYDUoTgKEgYuMxT3Se7HzKDDptrnXnvS` | [Advyth](https://x.com/Advyth) | - |
| 364 | bihoz | `An68XCxJvfXc9NRWjNXGSFY55dyFVKjfgtpt8AKGJ2dE` | [bihozNFTs](https://x.com/bihozNFTs) | - |
| 365 | marker | `CQervCdE3WAUGRmaTj9NHdbNrNGVsxJb68t3QggcntM2` | [m4rk3r](https://x.com/m4rk3r) | - |
| 366 | Solana degen | `9tY7u1HgEt2RDcxym3RJ9sfvT3aZStiiUwXd44X9RUr8` | [Solanadegen](https://x.com/Solanadegen) | - |
| 367 | Absol | `BXNiM7pqt9Ld3b2Hc8iT3mA5bSwoe9CRrtkSUs15SLWN` | [absolquant](https://x.com/absolquant) | [Link](https://t.me/absolcalls) |
| 368 | Groovy | `34ZEH778zL8ctkLwxxERLX5ZnUu6MuFyX9CWrs8kucMw` | [0xGroovy](https://x.com/0xGroovy) | - |
| 369 | samsrep | `CUHBzSPSaNS3tArEtM3maSV6pNdJhHJFYZpurPPK9P7H` | [samsrepx](https://x.com/samsrepx) | - |
| 370 | Marcell | `FixmSpsBa7ew26gWdiqpoMAgKRFgbSXFbGAgfMZw67X` | [MarcellxMarcell](https://x.com/MarcellxMarcell) | [Link](https://t.me/marcellcooks) |
| 371 | crayohla | `GDoG4tdbx8qkpECQKF5MebbEDpFJn6H739psqgoTG3aN` | [CrayohlaEU](https://x.com/CrayohlaEU) | - |
| 372 | ozark | `DZAa55HwXgv5hStwaTEJGXZz1DhHejvpb7Yr762urXam` | [ohzarke](https://x.com/ohzarke) | - |
| 373 | Betman | `BoYHJoKntk3pjkaV8qFojEonSPWmWMfQocZTwDd1bcGG` | [ImTheBetman](https://x.com/ImTheBetman) | - |
| 374 | Johnson | `J9TYAsWWidbrcZybmLSfrLzryANf4CgJBLdvwdGuC8MB` | [johnsoncooks101](https://x.com/johnsoncooks101) | - |
| 375 | k4ye | `5fHJszey2UdB2nETS1y6NS2wSG4ic9byKtbgJzaYzGeV` | [k4yeSol](https://x.com/k4yeSol) | - |
| 376 | slingoor | `6mWEJG9LoRdto8TwTdZxmnJpkXpTsEerizcGiCNZvzXd` | [slingoorio](https://x.com/slingoorio) | [Link](https://t.me/slingdeez) |
| 377 | Grimace | `EA4MXkyF8C2NzY8fw2acJPuarmoU271KRCCAYpLzMBJr` | [naughtygrimace](https://x.com/naughtygrimace) | - |
| 378 | trunoest | `ardinRsN1mNYVeoJWTBsWeYeXvuR9UUDGMsCDKpb6AT` | [trunoest](https://x.com/trunoest) | - |
| 379 | Hugo Fartingale | `Au1GUWfcadx7jMzhsg6gHGUgViYJrnPfL1vbdqnvLK4i` | [HugoMartingale](https://x.com/HugoMartingale) | - |
| 380 | Netti | `8WN7tkp8WcZEYX2cSXJQY8u3q5QHEtykrZqJmFP7NYcf` | [Netti_kun](https://x.com/Netti_kun) | [Link](https://t.me/nettikun) |
| 381 | Joji | `525LueqAyZJueCoiisfWy6nyh4MTvmF4X9jSqi6efXJT` | [metaversejoji](https://x.com/metaversejoji) | [Link](https://t.me/jojiinnercircle) |
| 382 | rise_crypt | `AUEQxhkAVz71w2WBa9BYSoZrydhYNJaKmfNomoNs9E4t` | [rise_crypt](https://x.com/rise_crypt) | [Link](https://t.me/rise_call) |
| 383 | Mazino | `9r1BenK1nPvkZyD88q3e6bTKjfqDcLjxnXn9ovreDL52` | [Mazinotrenches](https://x.com/Mazinotrenches) | [Link](https://t.me/MazinosTower) |
| 384 | saale | `SAALE2x3sn51EyahJyqD6913L3GqHZdZo3egUdMayQp` | [saale](https://x.com/saale) | - |
| 385 | Ban | `8DGbkGgQewL9mx4aXzZCUChr7hBVXvPK9fYqSqc7Ajpn` | [Bancrypto__](https://x.com/Bancrypto__) | - |
| 386 | Roshi 風と | `5JrDgnED5QFiaE8Znny2S9GwCeDK2pLYjMfWmjKogs3w` | [roshi100x](https://x.com/roshi100x) | [Link](https://t.me/prerichplayground) |
| 387 | JB | `JBrYniqfp9ZVWdrkhMEX2LNGBpYJ673Tzh2m3XsS14p7` | [JbTheQuant](https://x.com/JbTheQuant) | - |
| 388 | Dali | `CvNiezB8hofusHCKqu8irJ6t2FKY7VjzpSckofMzk5mB` | [SolanaDali](https://x.com/SolanaDali) | - |
| 389 | peacefuldestroy | `8AtQ4ka3dgtrH1z4Uq3Tm4YdMN3cK5RRj1eKuGNnvenm` | [peacefuldestroy](https://x.com/peacefuldestroy) | - |
| 390 | Putrick | `AVjEtg2ECYKXYeqdRQXvaaAZBjfTjYuSMTR4WLhKoeQN` | [Putrickk](https://x.com/Putrickk) | [Link](https://t.me/cryptoputro) |
| 391 | CoCo | `FqojC24nUn3x6oMQC2ypBHmtH7rFAnKS6DvwsJoCMaiv` | [CoCoCookerr](https://x.com/CoCoCookerr) | [Link](https://t.me/cococabin) |
| 392 | rez | `FkRN9yF3Gysw3BVhUqAXJJMEGfKiJNaPQAWYWBErgDuN` | [rezthegreatt](https://x.com/rezthegreatt) | - |
| 393 | juicyfruity | `Cv4JVc25RZ7JV8HhEXrnxJjzebMBCqN5prB5ec43aJSz` | [juicyfruityy2](https://x.com/juicyfruityy2) | - |
| 394 | Sanity | `5ruP877fu8sBshx9inDeHsVLjnJtgVBTbjnbupeDHYHH` | [Sanity100x](https://x.com/Sanity100x) | - |
| 395 | matsu | `9f5ywdCDA4QhSktBomozpHmZfSLqS6J9VqCrRehYWh1p` | [matsu_sol](https://x.com/matsu_sol) | - |
| 396 | Kimba | `7mHqL9GzGnbsYLoHLDzB7FiHAZbND2CZCJYFvU9PU1d3` | [Kimbazxz](https://x.com/Kimbazxz) | [Link](https://t.me/+fDC7q_ji3PNlNWI1) |
| 397 | bust | `FzVQSzj8JJr6WMGqbUHzx2XH1KkrfxRrRPv6WcbbZmND` | [IAmAboutToBust](https://x.com/IAmAboutToBust) | [Link](https://t.me/dustsdungeon) |
| 398 | Gasp | `xyzfhxfy8NhfeNG3Um3WaUvFXzNuHkrhrZMD8dsStB6` | [oh_gasp](https://x.com/oh_gasp) | - |
| 399 | Felix | `3uz65G8e463MA5FxcSu1rTUyWRtrRLRZYskKtEHHj7qn` | [Felixonchain](https://x.com/Felixonchain) | [Link](https://t.me/felixtradez) |
| 400 | ^1s1mple | `AeLaMjzxErZt4drbWVWvcxpVyo8p94xu5vrg41eZPFe3` | [s1mple_s1mple](https://x.com/s1mple_s1mple) | - |
| 401 | Megga | `H31vEBxSJk1nQdUN11qZgZyhScyShhscKhvhZZU3dQoU` | [Megga](https://x.com/Megga) | - |
| 402 | kreo | `BCnqsPEtA1TkgednYEebRpkmwFRJDCjMQcKZMMtEdArc` | [kreo444](https://x.com/kreo444) | - |
| 403 | EustazZ | `FqamE7xrahg7FEWoByrx1o8SeyHt44rpmE6ZQfT7zrve` | [Eustazzeus](https://x.com/Eustazzeus) | [Link](https://t.me/EustazzCooks) |
| 404 | Sebastian | `3BLjRcxWGtR7WRshJ3hL25U3RjWr5Ud98wMcczQqk4Ei` | [Saint_pablo123](https://x.com/Saint_pablo123) | - |
| 405 | Jidn | `3h65MmPZksoKKyEpEjnWU2Yk2iYT5oZDNitGy5cTaxoE` | [jidn_w](https://x.com/jidn_w) | [Link](https://t.me/JidnLosesMoney) |
| 406 | jakey | `B3JyPD3t9ufZWfL3namyvoc258KH74JojSxxurUg9jCT` | [jakeyPRMR](https://x.com/jakeyPRMR) | [Link](https://t.me/jakeyjournal) |
| 407 | chester | `PMJA8UQDyWTFw2Smhyp9jGA6aTaP7jKHR7BPudrgyYN` | [Chestererer](https://x.com/Chestererer) | - |
| 408 | Ataberk 🧙‍♂️ | `6hcX7fVMzeRpW3d7XhFsxYw2CuePfgSMmouZxSiNLj1U` | [ataberk](https://x.com/ataberk) | - |
| 409 | Reljoo | `FsG3BaPmRTdSrPaivbgJsFNCCa8cPfkUtk8VLWXkHpHP` | [Reljoooo](https://x.com/Reljoooo) | - |
| 410 | dv | `BCagckXeMChUKrHEd6fKFA1uiWDtcmCXMsqaheLiUPJd` | [vibed333](https://x.com/vibed333) | - |
| 411 | Giann | `GNrmKZCxYyNiSUsjduwwPJzhed3LATjciiKVuSGrsHEC` | [Giann2K](https://x.com/Giann2K) | - |
| 412 | Orange | `2X4H5Y9C4Fy6Pf3wpq8Q4gMvLcWvfrrwDv2bdR8AAwQv` | [OrangeSBS](https://x.com/OrangeSBS) | - |
| 413 | Ducky | `ADC1QV9raLnGGDbnWdnsxazeZ4Tsiho4vrWadYswA2ph` | [zXDuckyXz](https://x.com/zXDuckyXz) | - |
| 414 | King Solomon | `DEdEW3SMPU2dCfXEcgj2YppmX9H3bnMDJaU4ctn2BQDQ` | [0xsolomon](https://x.com/0xsolomon) | [Link](https://t.me/alwaysgems) |
| 415 | TIL | `EHg5YkU2SZBTvuT87rUsvxArGp3HLeye1fXaSDfuMyaf` | [tilcrypto](https://x.com/tilcrypto) | - |
| 416 | CameXBT | `67SNjkjV2MEyhDZcDjvMQSqFtjkh6TjCq6KDLmCgUxx6` | [Camexbt](https://x.com/Camexbt) | [Link](https://t.me/CameXBTGroup) |
| 417 | Exotic | `Dwo2kj88YYhwcFJiybTjXezR9a6QjkMASz5xXD7kujXC` | [74Exotic](https://x.com/74Exotic) | - |
| 418 | Otta | `As7HjL7dzzvbRbaD3WCun47robib2kmAKRXMvjHkSMB5` | [ottabag](https://x.com/ottabag) | [Link](https://t.me/ottabag) |
| 419 | Smokez | `5t9xBNuDdGTGpjaPTx6hKd7sdRJbvtKS8Mhq6qVbo8Qz` | [SmokezXBT](https://x.com/SmokezXBT) | - |
| 420 | tech | `5d3jQcuUvsuHyZkhdp78FFqc7WogrzZpTtec1X9VNkuE` | [technoviking46](https://x.com/technoviking46) | - |
| 421 | shah | `7xwDKXNG9dxMsBSCmiAThp7PyDaUXbm23irLr7iPeh7w` | [shahh](https://x.com/shahh) | [Link](https://t.me/shahlito) |
| 422 | Leens | `LeenseyyUU3ccdBPCFCrrZ8oKU2B3T2uToGGZ7eVABY` | [leensx100](https://x.com/leensx100) | [Link](https://t.me/leenscooks) |
| 423 | Kev | `BTf4A2exGK9BCVDNzy65b9dUzXgMqB4weVkvTMFQsadd` | [Kevsznx](https://x.com/Kevsznx) | - |
| 424 | Hesi | `FpD6n8gfoZNxyAN6QqNH4TFQdV9vZEgcv5W4H2YL8k4X` | [hesikillaz](https://x.com/hesikillaz) | - |
| 425 | Fashr | `719sfKUjiMThumTt2u39VMGn612BZyCcwbM5Pe8SqFYz` | [FASHRCrypto](https://x.com/FASHRCrypto) | - |
| 426 | noob mini | `AGqjivJr1dSv73TVUvdtqAwogzmThzvYMVXjGWg2FYLm` | [noobmini_](https://x.com/noobmini_) | - |
| 427 | West | `JDd3hy3gQn2V982mi1zqhNqUw1GfV2UL6g76STojCJPN` | [ratwizardx](https://x.com/ratwizardx) | - |
| 428 | Red | `7ABz8qEFZTHPkovMDsmQkm64DZWN5wRtU7LEtD2ShkQ6` | [redwithbag](https://x.com/redwithbag) | [Link](https://t.me/yvlred) |
| 429 | Monki | `53BnNc49Ajgstciq3CRoyxuBpkkW1r8pgPyvr7JGYnsh` | [m0nkicrypto](https://x.com/m0nkicrypto) | [Link](http://t.me/cryptomonki) |
| 430 | cryptovillain26 | `5sNnKuWKUtZkdC1eFNyqz3XHpNoCRQ1D1DfHcNHMV7gn` | [cryptovillain26](https://x.com/cryptovillain26) | - |
| 431 | WaiterG | `4cXnf2z85UiZ5cyKsPMEULq1yufAtpkatmX4j4DBZqj2` | [Waiter1x](https://x.com/Waiter1x) | [Link](https://t.me/Waitercooks) |
| 432 | Flames | `6aXFYXbFob1ZKAEDCcqZnX2vooA3TgEqDoy5dAQbeWoV` | [FlamesOnSol](https://x.com/FlamesOnSol) | - |
| 433 | Nilla | `j38fhfqWsJyt8hzym48P8QMsXWx1FfLUxQwuor7Ti4o` | [NillaGurilla](https://x.com/NillaGurilla) | - |
| 434 | Zuki | `922VvmmYDHV9KMTJJ71Y5Yd3Vn7cfJuFasLNSsZPygrG` | [zukiweb3](https://x.com/zukiweb3) | - |
| 435 | Scharo | `4sAUSQFdvWRBxR8UoLBYbw8CcXuwXWxnN8pXa4mtm5nU` | [XScharo](https://x.com/XScharo) | [Link](http://t.me/ScharoCooks) |
| 436 | Publix | `86AEJExyjeNNgcp7GrAvCXTDicf5aGWgoERbXFiG1EdD` | [Publixplayz](https://x.com/Publixplayz) | - |
| 437 | M A M B A 🧲 | `4nvNc7dDEqKKLM4Sr9Kgk3t1of6f8G66kT64VoC95LYh` | [mambatrades_](https://x.com/mambatrades_) | - |
| 438 | Silver | `67Nwfi9hgwqhxGoovT2JGLU67uxfomLwQAWncjXXzU6U` | [0xSilver](https://x.com/0xSilver) | - |
| 439 | Kadenox | `B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC` | [kadenox](https://x.com/kadenox) | - |
| 440 | Art | `CgaA9a1JwAXJyfHuvZ7VW8YfTVRkdiT5mjBBSKcg7Rz5` | [ArtCryptoz](https://x.com/ArtCryptoz) | - |
| 441 | Tom | `CEUA7zVoDRqRYoeHTP58UHU6TR8yvtVbeLrX1dppqoXJ` | [tdmilky](https://x.com/tdmilky) | - |
| 442 | Henn | `FRbUNvGxYNC1eFngpn7AD3f14aKKTJVC6zSMtvj2dyCS` | [henn100x](https://x.com/henn100x) | - |
| 443 | Padre | `4Ff9dbi9L93qMvevpESY4YLHtdqTd8Yj8jXj3VwCNY4g` | [PadrePrints](https://x.com/PadrePrints) | - |
| 444 | Cooker | `8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6` | [CookerFlips](https://x.com/CookerFlips) | [Link](https://t.me/CookersCooks) |
| 445 | Files | `DtjYbZntc2mEm1UrZHNcKguak6h6QM4S5xobnwFgg92Y` | [xfilesboy](https://x.com/xfilesboy) | - |
| 446 | Clown | `EDXHdSFdadFbYFFjxPXBqMe1kCEDFqpPu552uvp48HR8` | [ClownsTrenches](https://x.com/ClownsTrenches) | - |
| 447 | Earl | `F2SuErm4MviWJ2HzKXk2nuzBC6xe883CFWUDCPz6cyWm` | [earlTrades](https://x.com/earlTrades) | - |
| 448 | dov 7 | `8nqtxpFpuXwfXG4pBLsDkkuMMPK9FjSkBMCn542HiM3v` | [dovvvv7](https://x.com/dovvvv7) | - |
| 449 | Letterbomb | `BtMBMPkoNbnLF9Xn552guQq528KKXcsNBNNBre3oaQtr` | [ihateoop](https://x.com/ihateoop) | - |
| 450 | Dani | `AuPp4YTMTyqxYXQnHc5KUc6pUuCSsHQpBJhgnD45yqrf` | [DaniWorldwide](https://x.com/DaniWorldwide) | - |
| 451 | AlxCooks | `89HbgWduLwoxcofWpmn1EiF9wEdpgkNDEyPjzZ72mkDi` | [AlxCooks_off](https://x.com/AlxCooks_off) | - |
| 452 | Tuults | `5T229oePmJGE5Cefys8jE9Jq8C7qfGNNWy3RVA7SmwEP` | [tuults69](https://x.com/tuults69) | [Link](https://t.me/tuults1coma05x) |
| 453 | Zyaf | `F5TjPySiUJMdvqMZHnPP85Rc1vErDGV5FR5P2vdVm429` | [0xZyaf](https://x.com/0xZyaf) | [Link](https://t.me/zyafgambles) |
| 454 | Cupsey | `2fg5QD1eD7rzNNCsvnhmXFm5hqNgwTTG8p7kQ6f3rx6f` | [Cupseyy](https://x.com/Cupseyy) | - |
| 455 | Casino | `8rvAsDKeAcEjEkiZMug9k8v1y8mW6gQQiMobd89Uy7qR` | [casino616](https://x.com/casino616) | [Link](https://t.me/casino_calls) |
| 456 | Mayhem Bot | `BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s` | [pumpfun](https://x.com/pumpfun) | - |
| 457 | Sheep | `78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2` | [imsheepsol](https://x.com/imsheepsol) | - |
| 458 | Limfork.eth | `BQVz7fQ1WsQmSTMY3umdPEPPTm1sdcBcX9sP7o6kPRmB` | [Limfork](https://x.com/Limfork) | [Link](https://t.me/limforkdiary) |
| 459 | xunle | `4YzpSZpxDdjNf3unjkCtdWEsz2FL5mok7e5XQaDNqry8` | [xunle111](https://x.com/xunle111) | - |
| 460 | xander | `B3wagQZiZU2hKa5pUCj6rrdhWsX3Q6WfTTnki9PjwzMh` | [xandereef](https://x.com/xandereef) | [Link](https://t.me/xanderstrenches) |
| 461 | h14 | `BJXjRq566xt66pcxCmCMLPSuNxyUpPNBdJGP56S7fMda` | [H14onX](https://x.com/H14onX) | - |
| 462 | prettyover | `2e1w3Xo441Ytvwn54wCn8itAXwCKbiizc9ynGEv14Vis` | [prettyoverr](https://x.com/prettyoverr) | - |
| 463 | danny | `EaVboaPxFCYanjoNWdkxTbPvt57nhXGu5i6m9m6ZS2kK` | [cladzsol](https://x.com/cladzsol) | - |
| 464 | Setsu | `2k7Mnf2K3GhpB7hEVN1CFFeV4oNzzuCS5Q6SmcfAoLHd` | [Setsu2k](https://x.com/Setsu2k) | [Link](https://t.me/setsutrenching) |
| 465 | Ethan Prosper | `sAdNbe1cKNMDqDsa4npB3TfL62T14uAo2MsUQfLvzLT` | [pr6spr](https://x.com/pr6spr) | - |
| 466 | Trey | `831yhv67QpKqLBJjbmw2xoDUeeFHGUx8RnuRj9imeoEs` | [treysocial](https://x.com/treysocial) | [Link](https://t.me/treystele) |
| 467 | Leck | `98T65wcMEjoNLDTJszBHGZEX75QRe8QaANXokv4yw3Mp` | [LeckSol](https://x.com/LeckSol) | [Link](https://t.me/LeckSol) |
| 468 | Loopierr | `9yYya3F5EJoLnBNKW6z4bZvyQytMXzDcpU5D6yYr4jqL` | [Loopierr](https://x.com/Loopierr) | [Link](https://t.me/loopierrsjourney) |
| 469 | Domy | `3LUfv2u5yzsDtUzPdsSJ7ygPBuqwfycMkjpNreRR2Yww` | [domyxbt](https://x.com/domyxbt) | - |
| 470 | omar | `Dgehc8YMv6dHsiPJVoumvq4pSBkMVvrTgTUg7wdcYJPJ` | [maghrrebi](https://x.com/maghrrebi) | - |
| 471 | cap | `CAPn1yH4oSywsxGU456jfgTrSSUidf9jgeAnHceNUJdw` | [himothy](https://x.com/himothy) | [Link](https://t.me/capskitchen) |
| 472 | bandit | `5B79fMkcFeRTiwm7ehsZsFiKsC7m7n1Bgv9yLxPp9q2X` | [bandeez](https://x.com/bandeez) | - |

### Performance

| # | Name | Wallet | Profit (SOL) | Wins | Losses | Win Rate |
|---|------|--------|-------------|------|--------|----------|
| 1 | Inquixit | `3L8RAxLkvwkz4CgHivaVRtq19741FAdGLk5DgjRfc1fW` | +34.72 | 120 | 439 | 21.5% |
| 2 | Pikalosi | `9cdZg6xR4c9kZiqKSzqjn4QHCXNQuC9HEWBzzMJ3mzqw` | +33.73 | 167 | 224 | 42.7% |
| 3 | Idontpaytaxes | `2T5NgDDidkvhJQg8AHDi74uCFwgp25pYFMRZXBaCUNBH` | +32.64 | 103 | 68 | 60.2% |
| 4 | zeropnl | `4xY9T1Q7foJzJsJ6YZDSsfp9zkzeZsXnxd45SixduMmr` | +31.38 | 15 | 10 | 60.0% |
| 5 | Dior | `87rRdssFiTJKY4MGARa4G5vQ31hmR7MxSmhzeaJ5AAxJ` | +30.51 | 50 | 58 | 46.3% |
| 6 | 👀 | `Ew6qBU7N34gRNgpgUwhJ3PgrtbPYpLYWLBEG5yuQTceD` | +29.49 | 5 | 22 | 18.5% |
| 7 | Eric Cryptoman | `EgnY4zmqXuaqodCLW366jjd2ecki6pvmMF74MkSxMFQW` | +26.97 | 1 | 0 | 100.0% |
| 8 | hood | `91sP85Ds9A4EXJ3gU3iHyLtUNJimxz8LrxRb2qhBNod9` | +25.47 | 67 | 151 | 30.7% |
| 9 | PattyIce | `6nhskL8RVpXzWXC7mcC1UXpe3ze2p6P6og1jXVGUW88s` | +24.29 | 11 | 6 | 64.7% |
| 10 | sadizmed | `DTdHa4auX68jFtXv9wkzMYCahg295AnRuwvm6moW6meZ` | +24.17 | 12 | 1 | 92.3% |
| 11 | Paper | `FwjYcbfktK8PC2bzCrqxR6QkUPxmHFbcFGNrz3YAV7ft` | +17.17 | 30 | 114 | 20.8% |
| 12 | Xelf | `9Vk7pkBZ9KFJmzaPzNYjGedyz8qoKMQtnYyYi2AehNMT` | +16.99 | 7 | 11 | 38.9% |
| 13 | Lectron | `Gv8YFCU9WESGpN6fcGKG9nirqcyF9wVZAqnQ1DjrsfcE` | +13.83 | 1 | 1 | 50.0% |
| 14 | 7 | `FTg1gqW7vPm4kdU1LPM7JJnizbgPdRDy2PitKw6mY27j` | +13.75 | 5 | 5 | 50.0% |
| 15 | Phineas.SOL | `64ymeD9XTAkNJgHtXgrG6JCNZmBC9fSVcmgkL54pFikE` | +13.30 | 36 | 63 | 36.4% |
| 16 | Ricco 🥀 | `7Gi4H4wugm2n3rRWa6BijsQPJV7sMardawTi2tXDL9zM` | +11.44 | 15 | 23 | 39.5% |
| 17 | lyftical | `951wq3qDowjKHaycrNaiRB5WpovYVKXnqhnrcKPh46zt` | +11.19 | 32 | 79 | 28.8% |
| 18 | Gh0stee | `2kv8X2a9bxnBM8NKLc6BBTX2z13GFNRL4oRotMUJRva9` | +11.06 | 159 | 435 | 26.8% |
| 19 | CryptoStacksss | `FEGu1issUaiWS7NhSNLwDYRudBSSUHaBenHF14qStv4W` | +10.45 | 4 | 9 | 30.8% |
| 20 | Pavel | `3jckt69SiN3aCMbBWJoDS1s4xxGpqNxFFKnwhpRAQmuL` | +9.42 | 156 | 295 | 34.6% |
| 21 | cuban | `EcVgevcb8F3QsHuBg96wrCXwC3j2gnrhLr1Q21YULNk8` | +8.95 | 14 | 35 | 28.6% |
| 22 | Laanie | `37Y6bz7AXpHHRzMHGMqGRxv8JMuHQCS2FFHrPZkUeRt2` | +8.26 | 8 | 2 | 80.0% |
| 23 | gambles.sol | `Hi5yNvPSfagdja5xjYMTYWnnjSE3ze5KsezTLfuD2mqd` | +8.07 | 17 | 22 | 43.6% |
| 24 | Coler | `99xnE2zEFi8YhmKDaikc1EvH6ELTQJppnqUwMzmpLXrs` | +7.73 | 200 | 316 | 38.8% |
| 25 | Walta | `39q2g5tTQn9n7KnuapzwS2smSx3NGYqBoea11tBjsGEt` | +7.68 | 82 | 137 | 37.4% |
| 26 | Zachary | `D52tmCnycFovhx2ueMuEnxq5LCdwfZrU9u8ECE5foCW5` | +6.72 | 58 | 142 | 29.0% |
| 27 | MACXBT | `ETU3GyrUsv6UztQJxHgsBX2UoJFmq79WJe3JyDpAqGMz` | +6.64 | 137 | 249 | 35.5% |
| 28 | Cowboy🔶BNB | `6EDaVsS6enYgJ81tmhEkiKFcb4HuzPUVFZeom6PHUqN3` | +6.60 | 212 | 307 | 40.8% |
| 29 | Pain | `GEpM1SmE8ExgznJwyZX64F2Mv5LLFgvBCxm5zNWYUXL4` | +5.74 | 3 | 6 | 33.3% |
| 30 | Classic | `DsqRyTUh1R37asYcVf1KdX4CNnz5DKEFmnXvgT4NfTPE` | +5.21 | 71 | 95 | 42.8% |
| 31 | merky | `ATpSExwhE2x1H7rv6Uoi4TJdzGz15LjDXNzhV6pjDVYi` | +5.13 | 4 | 10 | 28.6% |
| 32 | Jdn | `2iPgNgss7ow3v5YFkTpzABStfjFSyG3BGvP5sZqADtFM` | +4.63 | 116 | 190 | 37.9% |
| 33 | Killua | `95TWoKkvv2z85EXBzd2z6NwbxH2f54AvwuCA9x3NoKep` | +4.28 | 1 | 0 | 100.0% |
| 34 | 0xWinged | `HrCPnDvDgbpbFxKxer6Pw3qEcfAQQNNjb6aJNFWgTEng` | +4.11 | 4 | 8 | 33.3% |
| 35 | jamessmith | `EQaxqKT3N981QBmdSUGNzAGK5S26zUwAdRHhBCgn87zD` | +3.87 | 77 | 204 | 27.4% |
| 36 | The Doc | `DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt` | +3.85 | 53 | 96 | 35.6% |
| 37 | dints | `DbRQjQDTTsiBXg1TJdb55WvEr3JvqUyu4iJJ684Aqeu3` | +3.80 | 4 | 0 | 100.0% |
| 38 | Nyhrox | `6S8GezkxYUfZy9JPtYnanbcZTMB87Wjt1qx3c6ELajKC` | +3.75 | 63 | 150 | 29.6% |
| 39 | kitty | `qP3Q8d4WWsGbqkTfyA9Dr6cAD7DQoBuxPJMFTK48rWU` | +3.65 | 4 | 6 | 40.0% |
| 40 | Dan176 | `J2B5fnm2DAAUAGa4EaegwQFoYaN6B5FerGA5sjtQoaGM` | +3.37 | 2 | 3 | 40.0% |
| 41 | Schoen | `5hAgYC8TJCcEZV7LTXAzkTrm7YL29YXyQQJPCNrG84zM` | +3.36 | 10 | 28 | 26.3% |
| 42 | Preston | `HmtAZQn7U75jkAxrXNh8vRFCmjGjM3Q2WpiTHXoCJrUz` | +3.29 | 2 | 5 | 28.6% |
| 43 | Bottom Seller | `BtUBxH7bEjmDJbgVLxjEK7ZX72XPeDKaeXFufXnGATna` | +3.18 | 10 | 38 | 20.8% |
| 44 | blixze ♱ | `5vg7he5HibvsAW86wfiuP6jw7VwKmUAnP6P93mVCdpJu` | +2.94 | 3 | 7 | 30.0% |
| 45 | kitakitsune | `kita97U8XijSrkwoEa6ViskeJnP8mCYUTsusU5RyaN5` | +2.93 | 1 | 3 | 25.0% |
| 46 | Numer0 (trench/arc) | `A3W8psibkTUvjxs4LRscbnjux6TFDXdvD4m4GsGpQ2KJ` | +2.61 | 14 | 17 | 45.2% |
| 47 | Fozzy | `B9oKseVKRntTvfADyaUoH7oVmoyVbBfUf4NKyQc4KK2D` | +2.60 | 8 | 15 | 34.8% |
| 48 | big bags bobby | `8oQoMhfBQnRspn7QtNAq2aPThRE4q94kLSTwaaFQvRgs` | +2.45 | 1 | 3 | 25.0% |
| 49 | Keano | `Ez2jp3rwXUbaTx7XwiHGaWVgTPFdzJoSg8TopqbxfaJN` | +2.24 | 6 | 6 | 50.0% |
| 50 | Zef | `EjtQrPTbcMevStBkpnjsH23NfUCMhGHusTYsHuGVQZp2` | +1.84 | 7 | 21 | 25.0% |
| 51 | J Spizzle | `4z3WtX32eehkmnaNNstZWyAuVBhj6cgpk5JtkdTa4m4A` | +1.78 | 2 | 3 | 40.0% |
| 52 | Yenni | `5B52w1ZW9tuwUduueP5J7HXz5AcGfruGoX6YoAudvyxG` | +1.77 | 32 | 86 | 27.1% |
| 53 | Stacker ✝️ | `HbCxe8yWQJWnK3f3FX4oohgm87FZuPYD4Ydszqxgkwft` | +1.70 | 49 | 106 | 31.6% |
| 54 | Spike | `FhsSfTSHok3ryVfyuLSD1t9frc4c1ymyCr3S11Ci718z` | +1.70 | 6 | 11 | 35.3% |
| 55 | Zil | `FSAmbD6jm6SZZQadSJeC1paX3oTtAiY9hTx1UYzVoXqj` | +1.58 | 13 | 18 | 41.9% |
| 56 | orangie | `DuQabFqdC9eeBULVa7TTdZYxe8vK8ct5DZr4Xcf7docy` | +1.53 | 1 | 0 | 100.0% |
| 57 | BIGWARZ | `7bsTkeWcSPG6nzsbXucxV89YUULoSExNJdX2WqfLHwZ4` | +1.50 | 3 | 8 | 27.3% |
| 58 | Alpha wallet 4 | `6pa2QnW2mB1F41FkytTYd2gTh9aTUCmdTGEgcFRXcQ8g` | +1.48 | 3 | 2 | 60.0% |
| 59 | Meechie | `9iaawVBEsFG35PSwd4PahwT8fYNQe9XYuRdWm872dUqY` | +1.48 | 134 | 246 | 35.3% |
| 60 | JADAWGS | `3H9LVHarjBoZ2YPEsgFbVD1zuERCGwfp4AeyHoHsFSEC` | +1.36 | 4 | 3 | 57.1% |
| 61 | Rasta | `RaSSH7hMwLKtMT96xZyY4JwHRCCNYvvNeBh6AaFMqdA` | +1.23 | 1 | 3 | 25.0% |
| 62 | flock (6'3) | `F1WT79Jkw3BkBDUfCbrKKo15ghZNCEjvnjxQpiCfPuRM` | +1.11 | 3 | 1 | 75.0% |
| 63 | Naruza | `ASVzakePP6GNg9r95d4LPZHJDMXun6L6E4um4pu5ybJk` | +1.00 | 7 | 6 | 53.8% |
| 64 | DRT 🐂 | `7K7itu678xAaUcuPQ2f3c2DcjirRjBY4HMTW1dx6hiL6` | +0.87 | 4 | 2 | 66.7% |
| 65 | jester | `4s2WzRLa35FB58bZY1i4CN3WoywJeuYrGYHnTKFsT23z` | +0.84 | 2 | 2 | 50.0% |
| 66 | Scrim | `GBERKNpahPnBGmeUGWQVjGBDBj6CcJKpGz34FqegmTgu` | +0.83 | 3 | 19 | 13.6% |
| 67 | Hash | `DNsh1UfJdxmze6T6GV9QK5SoFm7HsM5TRNxVuwVgo8Zj` | +0.80 | 46 | 65 | 41.4% |
| 68 | peely 🍌 | `BaLxyjXzATAnfm7cc5AFhWBpiwnsb71THcnofDLTWAPK` | +0.76 | 25 | 63 | 28.4% |
| 69 | SatsBuyer | `BWQPaFCn5Fp5ok2x5W69wspbsgiRXuPPUYX8Zgnm7XeQ` | +0.75 | 2 | 0 | 100.0% |
| 70 | Danny | `9FNz4MjPUmnJqTf6yEDbL1D4SsHVh7uA8zRHhR5K138r` | +0.75 | 28 | 80 | 25.9% |
| 71 | Setora | `HTVupcGHvA8tXX5pHmmAxQ8eiFAJSJhYNQjer3zycLcU` | +0.66 | 7 | 17 | 29.2% |
| 72 | Te' | `8RrMaJXYwANd4zEskfPQuSYE35dTzaYtuwyKz3ewcZQx` | +0.65 | 2 | 4 | 33.3% |
| 73 | Rich The Dev | `FCt3Gyuqcoc4vHrnAYdxVbqSg3m1AyDHtaVZMN8TctPv` | +0.54 | 2 | 1 | 66.7% |
| 74 | Divix | `FajxNukkjDLGXfB5V3L1msrU9qgzuzhN4s4YQfefSCKp` | +0.51 | 1 | 1 | 50.0% |
| 75 | Jay | `HwRnKq7RPtKHvX9wyHsc1zvfHtGjPQa5tyZtGtbvfXE` | +0.46 | 1 | 0 | 100.0% |
| 76 | Toxic weast | `DU323DieHUGPmYamp6A4Ai1V4YSYgRi35mGpzJGrjf7k` | +0.39 | 2 | 4 | 33.3% |
| 77 | Lowskii (believes) | `41uh7g1DxYaYXdtjBiYCHcgBniV9Wx57b7HU7RXmx1Gg` | +0.32 | 11 | 30 | 26.8% |
| 78 | Aymory ⚡️ | `9qdiDGhXrGqPN4CTGvyKwFKHrgJSGn836cjkVcGfPd6N` | +0.24 | 1 | 1 | 50.0% |
| 79 | Hermes | `5dzH7gh5FjtrxUwtfBufJyTBA4fyCUGheZsdYQsE9vag` | +0.22 | 2 | 4 | 33.3% |
| 80 | TMH メタ | `A38dM3RtNpewkwkWJeyj8C9c8yWtgaaAdh4Rdj1SXg3M` | +0.12 | 1 | 1 | 50.0% |
| 81 | Woozy | `9tRff7L6Mx3ZDNBoGPffdjD3c9JNzLc3nxzadYH4TnAp` | +0.05 | 36 | 92 | 28.1% |
| 82 | Padly | `FQEXjVZPT7BqcZNVs82Q46LFPUevG7YoDiKpugpJaiCb` | +0.05 | 1 | 0 | 100.0% |
| 83 | Scooter | `9NL6thsiaoyDnm7XF8hEbMoqeG172WmG7iKYpygvjfgo` | +0.03 | 1 | 0 | 100.0% |
| 84 | N’o | `Di75xbVUg3u1qcmZci3NcZ8rjFMj7tsnYEoFdEMjS4ow` | +0.00 | 0 | 0 | - |
| 85 | Robo | `4ZdCpHJrSn4E9GmfP8jjfsAExHGja2TEn4JmXfEeNtyT` | +0.00 | 0 | 0 | - |
| 86 | trisha | `4Dm3g5goQkaaXM4s7sphZzk8Vqb39j2mjhABrannMGmj` | +0.00 | 0 | 0 | - |
| 87 | Trench Guerilla | `9St6ETbe3CFitw6UNSd8kg7kZ6STXy71wEGiERqQj89U` | +0.00 | 0 | 0 | - |
| 88 | sp | `722tXm5uB5uuG2tC43uKHXQ7Pbyz75pTokEAJv9x5VTx` | +0.00 | 0 | 0 | - |
| 89 | prosciutto | `4EsY8HQB4Ak65diFrSHjwWhKSGC8sKmnzyusM993gk2w` | +0.00 | 0 | 0 | - |
| 90 | Legend | `EgjCS3ULUCU5JN83XumirPr6171zvN5i6wc12SDiVGX3` | +0.00 | 0 | 0 | - |
| 91 | Aroa | `Aen6LKc7sGVPTyjMd5cu9B9XVjL7m9pnvAiP2ZNJC4GZ` | +0.00 | 0 | 0 | - |
| 92 | MoneyMaykah | `3i8akM4xfSX9WKFB5bQ61fmiYkeKQEFqvdMEyu6pSEk9` | +0.00 | 0 | 0 | - |
| 93 | goob | `9BkauJdFYUyBkNBZwV4mNNyfeVKhHvjULb7cL4gFQaLt` | +0.00 | 0 | 0 | - |
| 94 | I̶l̷y̶ | `5XVKfruE4Zzeoz3aqBQfFMb5aSscY5nSyc6VwtQwNiid` | +0.00 | 0 | 0 | - |
| 95 | ree | `EVCwZrtPFudcjw69RZ9Qogt8dW2HjBp6EiMgv1ujdYuJ` | +0.00 | 0 | 0 | - |
| 96 | xet | `9yGxZ43ngT7LvwquVdUAYPvJzVyY65cS6mQvuJXjTEUc` | +0.00 | 0 | 0 | - |
| 97 | Frost | `4nwfXw7n98jEQn93VWY7Cuf1jnn1scHXuXCPGVYS9k6T` | +0.00 | 0 | 0 | - |
| 98 | Guy | `ELNFHkwb5W9RpxAac6SdJcgYi4wn7bPpPvd3LwfhR2Xx` | +0.00 | 0 | 0 | - |
| 99 | dns | `2DG4vs36XHf3V9czMopZufUn8ton4tuf6atuRpP4Kowr` | +0.00 | 0 | 0 | - |
| 100 | Pavlo | `7NnaXghjuU92gM9kmwXysqa5HboyZuR2LTaBnvazFxSH` | +0.00 | 0 | 0 | - |
| 101 | proh | `FksF9AqK7UvkkuzDoHQxYiyk6APwpPAaRzXp5QG3FGqA` | +0.00 | 0 | 0 | - |
| 102 | 十九岁绿帽少年🍀 | `DzeSE8ZBNk36qqswcDxd8919evdH5upwyZ4u1yieQSkp` | +0.00 | 0 | 0 | - |
| 103 | Gorilla Capital | `DpNVrtA3ERfKzX4F8Pi2CVykdJJjoNxyY5QgoytAwD26` | +0.00 | 0 | 0 | - |
| 104 | 0xMistBlade | `14HDbSrjCJKgwCXDBXv8PGRGFaLrAqDBq2mCwSA46q5x` | +0.00 | 0 | 0 | - |
| 105 | Chefin | `6Qs6joB349h7zu1z9xRgPgMSmpBYLDQb2wtAecY4LysH` | +0.00 | 0 | 0 | - |
| 106 | Issa | `2BU3NAzgRA2gg2MpzwwXpA8X4CCRaLgrf6TY1FKfJPX2` | +0.00 | 0 | 0 | - |
| 107 | old | `CA4keXLtGJWBcsWivjtMFBghQ8pFsGRWFxLrRCtirzu5` | +0.00 | 0 | 0 | - |
| 108 | Gake | `DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm` | +0.00 | 0 | 0 | - |
| 109 | jitter | `7PuHVAKDZ96s9P5FAt2eEdE8EYKxy9iUhvaLaMFqfCyj` | +0.00 | 0 | 0 | - |
| 110 | Pow | `8zFZHuSRuDpuAR7J6FzwyF3vKNx4CVW3DFHJerQhc7Zd` | +0.00 | 0 | 0 | - |
| 111 | MERK | `4jFPYSoUTRaFbFDJp9QpA1J5pXJmMJYoWhiFTpoLPq6X` | +0.00 | 0 | 0 | - |
| 112 | polar | `GL8VLakj5AeAnkVNd4gQAkjXLqAzjeNbNXUQBdo8FwQG` | +0.00 | 0 | 0 | - |
| 113 | Ansem | `AVAZvHLR2PcWpDf8BXY4rVxNHYRBytycHkcB5z5QNXYm` | +0.00 | 0 | 0 | - |
| 114 | Mezoteric | `EdDCRfDDeiiDXdntrP59abH4DXHFNU48zpMPYisDMjA7` | +0.00 | 0 | 0 | - |
| 115 | fa1r | `8ggkt7Y1SZzmsdcy6ZHTif6HvgAUv2dxJCbTFTGD67MV` | +0.00 | 0 | 0 | - |
| 116 | Affu (aura farming) | `BjNueAZDxLpwHnpMVZrB5b8DTTBHdmXtg1ZaRPCJ1yYJ` | +0.00 | 0 | 0 | - |
| 117 | profitier | `FbvUU5qvD9JsU9jp3KDweCpZiVZHLoQBQ1PPCAAbd6FB` | +0.00 | 0 | 0 | - |
| 118 | Burixx 🇮🇹 | `A9aTuBuxoVY547n6hUBCq9oZm36LTJX9Kvn4NZXffXvp` | +0.00 | 0 | 0 | - |
| 119 | LJC | `6HJetMbdHBuk3mLUainxAPpBpWzDgYbHGTS2TqDAUSX2` | +0.00 | 0 | 0 | - |
| 120 | killz | `9Wagwcs6HVtMHaaxBjUbE7AKmxeg9nzEDcvXhN8bydUG` | +0.00 | 0 | 0 | - |
| 121 | Key | `4Bdn33fA7LLZQuuXuFLSxtPWGAUnMBcreQHfh9MXuixe` | +0.00 | 0 | 0 | - |
| 122 | wuzie | `Akht8EBJqFSLmhNR7Wdr53YmWjmb9URzbZYWY7FAJKeH` | +0.00 | 0 | 0 | - |
| 123 | s0ber | `Hq5TTULwwmDjGvzQukgujHQogZ5uFSCyYHpP756Uvyae` | +0.00 | 0 | 0 | - |
| 124 | Connor | `9EyPAMyQvXaUWFxd2uQHvG8vpkKs33YdXvDvwmRXrUiH` | +0.00 | 0 | 0 | - |
| 125 | zoru | `BrT5kYQ125u6NaRKFKNiBnHak6X7MvcZSQ3LfQCB3sqg` | +0.00 | 0 | 0 | - |
| 126 | Nach | `9jyqFiLnruggwNn4EQwBNFXwpbLM9hrA4hV59ytyAVVz` | +0.00 | 0 | 0 | - |
| 127 | Sully | `Ebk5ATdfrCuKi27dHZaw5YYsfREEzvvU8xeBhMxQoex6` | +0.00 | 0 | 0 | - |
| 128 | Qtdegen | `7tiRXPM4wwBMRMYzmywRAE6jveS3gDbNyxgRrEoU6RLA` | +0.00 | 0 | 0 | - |
| 129 | Rektober | `3cG7d6GmX47HKSX5nWRX9MJpruCojbzUkak92gSXGtG5` | +0.00 | 0 | 0 | - |
| 130 | waste management | `D2aXNmQgLnZFFoE8aSCZq1dBXKRDw29NoGY79jCscUmj` | +0.00 | 0 | 0 | - |
| 131 | Fabix | `DN7pYLSGYqHXwvPLh8tJM2zoJjhMSsNGVRVkMWVpredr` | +0.00 | 0 | 0 | - |
| 132 | Ferb | `m7Kaas3Kd8FHLnCioSjCoSuVDReZ6FDNBVM6HTNYuF7` | +0.00 | 0 | 0 | - |
| 133 | Dolo | `5wcc13mXoyqe6qh2iHH5GFknojoJ7y13ZPx9K4NXTuo3` | +0.00 | 0 | 0 | - |
| 134 | Polly | `HtvLcCFehifb7G4j42JDn53zD7sQRiELF5WHzJzNvWMm` | +0.00 | 0 | 0 | - |
| 135 | Sue | `AXwssg5NjQodKofcLV6ypJL4R5usvysYt9q7YVwjEgAH` | +0.00 | 0 | 0 | - |
| 136 | YOUNIZ | `DVM5U7yTFUT8TwerBq1afLopuSuFs1rRVCu3KpTJbHUa` | +0.00 | 0 | 0 | - |
| 137 | i gamble your yearly salary | `KJXB1ot9nkCvq1ZD27vzNSBaPPCT82DpVnXrcwxftvY` | +0.00 | 0 | 0 | - |
| 138 | Terp | `HkFt55P3PhRWHXoTFeuvkKEE4ab26xZ1bk6UmXV88Pwz` | +0.00 | 0 | 0 | - |
| 139 | Prada | `gkNNf4NwkR61B1QKBFtELe6TVZFhYRaC2LbVkoNyCkB` | +0.00 | 0 | 0 | - |
| 140 | Ramset ✟ | `71PCu3E4JP5RDBoY6wJteqzxkKNXLyE1byg5BTAL9UtQ` | +0.00 | 0 | 0 | - |
| 141 | quant | `Fi2hrxExy6TJnKcbPtQpo6iZzX9SUVbB9mDw6d29NgCn` | +0.00 | 0 | 0 | - |
| 142 | Insentos | `7SDs3PjT2mswKQ7Zo4FTucn9gJdtuW4jaacPA65BseHS` | +0.00 | 0 | 0 | - |
| 143 | zync (锌仔) | `zyncUiCSpP5zExdpvpRgx8twZ1AxTAqaeqtTVZ45ART` | +0.00 | 0 | 0 | - |
| 144 | mog | `EtuuyC1njBScPtYFpuDP6mxdkfTcs9zbUbJGheHzof3t` | +0.00 | 0 | 0 | - |
| 145 | TheDefiApe | `ExKCuoAzJCgCVjU3CvNoL8vVrdESTWkx3ubj6rQXwQM4` | +0.00 | 0 | 0 | - |
| 146 | DJ.Σn | `Cxe1d5zFifK4a4UZoHQaCK7sfqd84XjcKy1qtjnz3bge` | +0.00 | 0 | 0 | - |
| 147 | BagCalls | `4AHgEkTsGqY77qtde4UJn9yZCrbGcM7UM3vjT3qM4G5H` | +0.00 | 0 | 0 | - |
| 148 | el charto | `CCUcjek5p6DLoH2YNtjizxYhAnStXAQAGVxhp1cYJF7w` | +0.00 | 0 | 0 | - |
| 149 | Jack Duval🌊 | `BAr5csYtpWoNpwhUjixX7ZPHXkUciFZzjBp9uNxZXJPh` | +0.00 | 0 | 0 | - |
| 150 | Zeek | `DUTpdjVjZ3XKqeU5WFE3HbkQ77ZSaSi3CseMkr9zkC6T` | +0.00 | 0 | 0 | - |
| 151 | Saif | `BuhkHhM3j4viF71pMTd23ywxPhF35LUnc2QCLAvUxCdW` | +0.00 | 0 | 0 | - |
| 152 | Yokai Ryujin | `2w3zDW2e1KjYtM2pHTkgh78L8DjMrC6fuB9uhwKNigTs` | +0.00 | 0 | 0 | - |
| 153 | yeekidd | `88e2kBDJoN7eQCBj2sxT15etUZ3jPNzD4ijCs1TNySWJ` | +0.00 | 0 | 0 | - |
| 154 | ShockedJS | `6m5sW6EAPAHncxnzapi1ZVJNRb9RZHQ3Bj7FD84X9rAF` | +0.00 | 0 | 0 | - |
| 155 | Oura | `4WPTQA7BB4iRdrPhgNpJihGcxKh8T43gLjMn5PbEVfQw` | +0.00 | 0 | 0 | - |
| 156 | Lynk | `CkPFGv2Wv1vwdWjtXioEgb8jhZQfs3eVZez3QCetu7xD` | +0.00 | 0 | 0 | - |
| 157 | Monarch | `4uTeAz9TmZ1J5bNkgGLvqAELvCHJwLZgo7Hxar2KAiyu` | +0.00 | 0 | 0 | - |
| 158 | Insyder | `G3g1CKqKWSVEVURZDNMazDBv7YAhMNTjhJBVRTiKZygk` | +0.00 | 0 | 0 | - |
| 159 | Zinc | `EBjXstFQBBnXVFEXouqGfUxQFmaEHu6KFbxrZQkGbjru` | +0.00 | 0 | 0 | - |
| 160 | Lyxe | `HLv6yCEpgjQV9PcKsvJpem8ESyULTyh9HjHn9CtqSek1` | +0.00 | 0 | 0 | - |
| 161 | Seee | `9EfTigVxHuNjqzxiv3BQ7wD2v7uFvdRQbrrnDEPr8pTk` | +0.00 | 0 | 0 | - |
| 162 | CC2 | `B3beyovNKBo4wF1uFrfGfpVeyEHjFyJPmEBciz7kpnoS` | +0.00 | 0 | 0 | - |
| 163 | Spuno | `GfXQesPe3Zuwg8JhAt6Cg8euJDTVx751enp9EQQmhzPH` | +0.00 | 0 | 0 | - |
| 164 | 🇩🇴 Jerry | `GmDXqHhXqfzEBErQqPft9xkznvgfkX6bcUT65MxQzNBj` | +0.00 | 0 | 0 | - |
| 165 | Brox | `7VBTpiiEjkwRbRGHJFUz6o5fWuhPFtAmy8JGhNqwHNnn` | +0.00 | 0 | 0 | - |
| 166 | 0xJumpman | `8eioZubsRjFkNEFcSHKDbWa8MkpmXMBvQcfarGsLviuE` | +0.00 | 0 | 0 | - |
| 167 | Chris ☕️ | `CtUzwARj8A13M3hdJAXvsLkqJUfmFKqWzFXJPcq4MiMx` | +0.00 | 0 | 0 | - |
| 168 | Jakey | `B8kdogV1a39GPVpSiPjPdUGfFf8nx6EVexRMvdeiXB64` | +0.00 | 0 | 0 | - |
| 169 | kilo | `kiLogfWUXp7nby7Xi6R9t7u8ERQyRdAzg6wBjvuE49u` | +0.00 | 0 | 0 | - |
| 170 | Pullup 🗡️🧣✨ | `65paNEG8m7mCVoASVF2KbRdU21aKXdASSB9G3NjCSQuE` | +0.00 | 0 | 0 | - |
| 171 | Fawcette | `JBTJAkwqYR471nmeHqLSUaLezNz4Yx2wy9jYotveGnEm` | +0.00 | 0 | 0 | - |
| 172 | para | `uS74rigLoPmKdi169RPUB4VSF6T9PqChTpG5jWzVhVp` | +0.00 | 0 | 0 | - |
| 173 | Little Mustacho 🐕 | `Huk3KuMLsLBZSer2n7MXmMPAJE1eKcr8dJS6DDoM3m8f` | +0.00 | 0 | 0 | - |
| 174 | Bobby | `DBmRHNbSsVX8F6NyVaaaiuGdwo1aYGawiy3jfNcvXYSC` | +0.00 | 0 | 0 | - |
| 175 | GVQ | `GVQtcYiQLy3tKNPGzPa81RsCKycam1zLTQSybdnDjMkF` | +0.00 | 0 | 0 | - |
| 176 | Jordan | `EAnB5151L8ejp3SM6haLgyv3snk6oqc8acKgWEg9T5J` | +0.00 | 0 | 0 | - |
| 177 | Bolivian | `5AyJw1VNDgTho2chipbVmuGqTuX1fCvVkLneChQkQrw8` | +0.00 | 0 | 0 | - |
| 178 | Carti The Menace | `3mPypxb7ViYEdLv4siFmESvY5w5ZKknwgmB4TPcZ77qe` | +0.00 | 0 | 0 | - |
| 179 | Angi | `AGnd5WTHMUbyK3kjjQPdQFM3TbWcuPTtkwBFWVUwiCLu` | +0.00 | 0 | 0 | - |
| 180 | Value & Time | `3nvC8cSrEBqFEXZjUpKfwZMPk7xYdqcnoxmFBjXiizVX` | +0.00 | 0 | 0 | - |
| 181 | Dutch | `9vWutdTBs66hWkeCmxaLFpkKy4q5RSe8DsFjfdxj5yFA` | +0.00 | 0 | 0 | - |
| 182 | Hustler | `HUS9ErdrDqpqQePbmfgJUTnDTE6eZ8ES62a25RihSK9U` | +0.00 | 0 | 0 | - |
| 183 | Rev | `EgzjRCbcdRiPc1bW52tcvGDnKDbQWCzQbUhDBszD2BZm` | +0.00 | 0 | 0 | - |
| 184 | .exe | `42nsEk51owYM3uciuRvFerqK77yhXZyjBLRgkDzJPV2g` | +0.00 | 0 | 0 | - |
| 185 | Jalen | `F72vY99ihQsYwqEDCfz7igKXA5me6vN2zqVsVUTpw6qL` | +0.00 | 0 | 0 | - |
| 186 | Sabby | `9K18MstUaXmSFSBoa9qDTqWTnYhTZqdgEhuKRTVRgh6g` | +0.00 | 0 | 0 | - |
| 187 | Mitch | `4Be9CvxqHW6BYiRAxW9Q3xu1ycTMWaL5z8NX4HR3ha7t` | +0.00 | 0 | 0 | - |
| 188 | Rizz | `BPWsae36tY6oFz7f5MjsfTGqzi3ttM1AsAtjMvUb91tT` | +0.00 | 0 | 0 | - |
| 189 | Collectible | `Ehqd8q5rAN8V7Y7EGxYm3Tp4KPQMTVWQtzjSSPP3Upg3` | +0.00 | 0 | 0 | - |
| 190 | cxltures | `3ZtwP8peTwTfLUF1rgUQgUxwyeHCxfmoELXghQzKqnAJ` | +0.00 | 0 | 0 | - |
| 191 | Michi | `8YYDiCbPd4nM8TxrQEVdPA4aG8jys8R7Z1kKsgPL4pwh` | +0.00 | 0 | 0 | - |
| 192 | evening | `E7gozEiAPNhpJsdS52amhhN2XCAqLZa7WPrhyR6C8o4S` | +0.00 | 0 | 0 | - |
| 193 | Obijai | `5dhKiVtynZVDWGgvAFrz9mPPU1VNKkaMrcbrjKMtoANw` | +0.00 | 0 | 0 | - |
| 194 | shaka | `4S8YBCt6hhi7Nr1NnKF6jF856LLN8JJFzD1a8nF5UuHA` | +0.00 | 0 | 0 | - |
| 195 | aloh | `FGVjsmD76HMcMa6NNzhwxZ2qpx25fGnAZT7zF2A3SWtH` | +0.00 | 0 | 0 | - |
| 196 | Fuzz | `FUZZUhT5qKncddMxLnkeiN7Dh1CmSpWPScp55iexZ85t` | +0.00 | 0 | 0 | - |
| 197 | ִֶָ | `B57ChV7Sa7FToRFsKWRWi5QPJJUn6cv4CuMQCzgw4VY2` | +0.00 | 0 | 0 | - |
| 198 | RUSKY 🪬⚡️ | `J4rYYPEXHwYMvyNzVwRsTyaSVpHv4SXK6kQNGgvBdvc4` | +0.00 | 0 | 0 | - |
| 199 | kyz | `72YiE4crBv2UhxRgRYKs4GaTGT2avbacfL4HNCfQLqsm` | +0.00 | 0 | 0 | - |
| 200 | Noah | `6DwBGYF7JbLUmsMeAGn9ZMCv2sKF6s6UGAQtBkDzJtw4` | +0.00 | 0 | 0 | - |
| 201 | Achi | `FPx2BavA7J2C7Nz6WpoPL9f5kDAKjxLb38PHNZMoxCra` | +0.00 | 0 | 0 | - |
| 202 | asta | `AstaWuJuQiAS3AfqmM3xZxrJhkkZNXtW4VyaGQfqV6JL` | +0.00 | 0 | 0 | - |
| 203 | Al4n | `2YJbcB9G8wePrpVBcT31o8JEed6L3abgyCjt5qkJMymV` | +0.00 | 0 | 0 | - |
| 204 | fomo 🧠 | `9FEHWFjgbYnFCRRHkesJNq6znHjc5Aaq7TiKi1rCVSnH` | +0.00 | 0 | 0 | - |
| 205 | deecayz ⌐◨-◨ | `Dv32u9mvSXGVNshf7xM7afuMoPRifQxzuzEjfmfMysZY` | +0.00 | 0 | 0 | - |
| 206 | 0xBossman | `BjYxVF81MgahqgahDTUEGzxzP7bZrA4p5Dg67Y4e3bXZ` | +0.00 | 0 | 0 | - |
| 207 | iconXBT | `2FbbtmK9MN3Zxkz3AnqoAGnRQNy2SVRaAazq2sFSbftM` | +0.00 | 0 | 0 | - |
| 208 | yassir | `HFx9E1vvWyoMmiHuTMSAQ2GRkJ2N4snCUwhUMr83LLSs` | +0.00 | 0 | 0 | - |
| 209 | woopig🧙🏻‍♂️ | `9Bs2XgZynPdMfbpn3HQX8NKWLToPDwGrMHRbZruwbyPD` | +0.00 | 0 | 0 | - |
| 210 | sarah milady | `AAMnoNo3TpezKcT7ah9puLFZ4D59muEhQHJJqpX16ccg` | +0.00 | 0 | 0 | - |
| 211 | eq | `7w7f4P284zJhv3zotjCUmaNsZSsrHQKtpXGBJFq8gdzq` | +0.00 | 0 | 0 | - |
| 212 | R💫WDY | `DKgvpfttzmJqZXdavDwTxwSVkajibjzJnN2FA99dyciK` | +0.00 | 0 | 0 | - |
| 213 | Maurits | `274vmGgKuYQp8Fxvb8n3cr9ZeY3SYM6LgeaXM6jS2nD6` | +0.00 | 0 | 0 | - |
| 214 | Dolo 🥷 | `EeSx4wehRQhEbmbyFvfqA633v2P4C558bHh2ed7zgZh` | +0.00 | 0 | 0 | - |
| 215 | Fizzwick Bramblewhistle | `3pcmVZ1DwKbqnjbGbeg3FycThT1AkTpGQYB96jGU6oS1` | +0.00 | 0 | 0 | - |
| 216 | Nils😈 | `FkL99xVBParNcPTjxnLdqFFCg3cvcR7NjCGkMgDPFfW3` | +0.00 | 0 | 0 | - |
| 217 | zurh | `HYgRa7NfuNhGZ7hsPix4N7evmmU5t5BTUUEoxwFcTKJD` | +0.00 | 0 | 0 | - |
| 218 | Fwasty | `J15mCwMU8EeSvaiFTTyM8teCoxXf82aLUh6FgtDy5q1g` | +0.00 | 0 | 0 | - |
| 219 | Dedmeow5 | `9THzoX5yGNSgPBAjCF4Lgqc1wLXoFkMQit4XWbhhRnqE` | +0.00 | 0 | 0 | - |
| 220 | Charlie | `14k7D9HA5zff4EmQD6QTPBqM25CRiEA7ZqTjM3fhypgz` | +0.00 | 0 | 0 | - |
| 221 | JinMu | `8tP391aDbKKpQS7eKnCEfnJ8Cmek6jatEe2LFkdJ2PRP` | +0.00 | 0 | 0 | - |
| 222 | Nuotrix | `Aa5LycwALUjaGeLyqe7y2jLZX3QetYnZqyvW2bLpwc2Q` | +0.00 | 0 | 0 | - |
| 223 | Dragon | `6SYhd67FqypKyNqd5iFikRhrmKAKcCwwurSYUAMNSH4r` | +0.00 | 0 | 0 | - |
| 224 | Iced | `DrJ6SnDXkEsPeGdmSs93v5rwWumv5QMvAGSZjAyWSd5o` | +0.00 | 0 | 0 | - |
| 225 | Crypto Chef | `EbSjMKQ4GiAxawit6LuHBjDqhC5gYGQhbH2YpBerJiCJ` | +0.00 | 0 | 0 | - |
| 226 | lucky flash | `2vXMy7EdkvU6SVzex1kfSeVhrBApC8WU4m9RQTTt4Ro4` | +0.00 | 0 | 0 | - |
| 227 | Yugi | `4TCMpxeevymUtCemwcVozhBLWq8Fikc1pVpfcW9zp66B` | +0.00 | 0 | 0 | - |
| 228 | eezzyLIVE 🧸 | `DiDbxfveAcnescZWYjkVJzXiEWjskZKAFVTq2hrfHNjN` | +0.00 | 0 | 0 | - |
| 229 | zhynx | `zhYnXqK3MNSmwS3yxSvPmY5kUa1n2WUaCJgYUDrAHkL` | +0.00 | 0 | 0 | - |
| 230 | nich | `nichQ7m3W37WJ9beNLZfTj27gLrjC7ddq4YguHufYas` | +0.00 | 0 | 0 | - |
| 231 | Frags | `2yoJibiZUGB1gs31gvtynRTyx9vmj8VrWoQvXDDzUFHS` | +0.00 | 0 | 0 | - |
| 232 | ItsVine | `ztRg1PdZbBQzMGbaz5UXqzaKX4frC82USoWiaVfohSv` | +0.00 | 0 | 0 | - |
| 233 | Rice | `CWvdyvKHEu8Z6QqGraJT3sLPyp9bJfFhoXcxUYRKC8ou` | +0.00 | 0 | 0 | - |
| 234 | KennyLoaded | `3BEtHGzhdWPtxSzqVsBorWpbi4jfMvD5cCZy1Qrtac7E` | +0.00 | 0 | 0 | - |
| 235 | Storm | `EYBMFf8mUyvZobqX7bkaCrvZ6bHCYxeVjFHQ9v2bmtAy` | +0.00 | 0 | 0 | - |
| 236 | Baraka | `CUKFKdJw7F91bZBbtAJMrLLxqtVigVSJhx644EFnCnw` | +0.00 | 0 | 0 | - |
| 237 | denzaa | `4X199Pq6etVAdmZf5zfbhAu18biucGip3jFZMj3qvCA8` | +0.00 | 0 | 0 | - |
| 238 | arnz | `2G6CNJqfvGP3KWZXtV8rQHra3kxGK28nvzT6TjyWNtiJ` | +0.00 | 0 | 0 | - |
| 239 | Canis | `AzXDG1LSULfMai1Rpw9uzMtk3osdK2vmeBWFYKjymSAo` | +0.00 | 0 | 0 | - |
| 240 | ⚫️ | `13gj9sYDkj42PsC7koDk2cR9mj2YpVQxWvSBLcJcLkzG` | +0.00 | 0 | 0 | - |
| 241 | Iz | `FH6jdKkoRg8MQKrtAUwiHq53FyCwoeNQ1ok4doFwGMUg` | +0.00 | 0 | 0 | - |
| 242 | milito | `EeXvxkcGqMDZeTaVeawzxm9mbzZwqDUMmfG3bF7uzumH` | +0.00 | 0 | 0 | - |
| 243 | voyage | `BJeWdzF9HVeWHktxwS9u8FbCrdSDRrDoS3S9stLafdQJ` | +0.00 | 0 | 0 | - |
| 244 | GK | `GxifJqkZv6CvgLVpcv5Z8tkqcCyVSWfUyvr2zCCjpEmV` | +0.00 | 0 | 0 | - |
| 245 | neko ≈💧🌸 | `7EQjTHVNHunhQHT7iRQDCR99mjDm2GvHyGKHVGzX8jv2` | +0.00 | 0 | 0 | - |
| 246 | Lunar cipher | `EtVEeqiKcf9Wgp38Z3L8HFi3heT4nPxsoDwe6cxwkqhc` | +0.00 | 0 | 0 | - |
| 247 | Jays | `By5huc2NCHjiA293DvstgNiQEEnmta2fkoyx86hsReTj` | +0.00 | 0 | 0 | - |
| 248 | Niners | `2RyUYqX1VFoGdDSKm3brWV5c2bY4thXx1Wctz22uYS1p` | +0.00 | 0 | 0 | - |
| 249 | Exploitz | `F5Tw3a3sUNXRUVabtKPE9C6mRxAoMnKDd8W2SLFQtAEB` | +0.00 | 0 | 0 | - |
| 250 | Lockiner | `ErhZ8c1DA68BUcxUBcLVrL4w457dU48dxNiqeehSGB5p` | +0.00 | 0 | 0 | - |
| 251 | Sugus | `2octNbV8QTtaFMJtbWhtkqMQt3deBe4D8mYcNworhv3t` | +0.00 | 0 | 0 | - |
| 252 | Basel de’ Medici | `8vPVTTpVamqRJKLhEQdupHTzGEJq23HE1pdC2Lic157t` | +0.00 | 0 | 0 | - |
| 253 | LUKEY ✣ | `DjM7Tu7whh6P3pGVBfDzwXAx2zaw51GJWrJE3PwtuN7s` | +0.00 | 0 | 0 | - |
| 254 | dints | `3PWGw2AmfR641mLLS1GhGSMcfbDft59EUFuvHf7TpDwU` | +0.00 | 0 | 0 | - |
| 255 | jimmy | `HcpsFY1tDhuzEGGwuqyYy6PSi6hHEjGbFKMz4oA5BicY` | +0.00 | 0 | 0 | - |
| 256 | bradjae | `8Dg8J8xSeKqtBvL1nBe9waX348w5FSFjVnQaRLMpf7eV` | +0.00 | 0 | 0 | - |
| 257 | Cesco.Sol | `7wr4Hf1v72q9eYXRYYg4jpfud3QPL3xLQHFYkZqRMdo4` | +0.00 | 0 | 0 | - |
| 258 | AdamJae | `4xUEz1saHSQv1yvo4MhFL3bYM7AVgp7Jq5HhLQwdUeBy` | +0.00 | 0 | 0 | - |
| 259 | Crypto Pirate | `8mp548ZBaSavzpTHVeytQ4XGpVpbVZx9p2UxVyAJvRxV` | +0.00 | 0 | 0 | - |
| 260 | maybe | `Gp9W8Qa2J1RQLvJNkJd8GDgqY16yAQfyzC4DiDZewKb7` | +0.00 | 0 | 0 | - |
| 261 | appie | `7WaL6oKHAKtDtVBNHsSo61XenQFWsbd4KKrS5o1DWAjy` | +0.00 | 0 | 0 | - |
| 262 | ocr | `3MNu91fiPyCefHL88aBYntpwfraf3dBrqJ8VYjJQyaqt` | +0.00 | 0 | 0 | - |
| 263 | Nikolas (aura arc) | `iPUp3qkm39ycMGbywWFMUyvaDhiiPGXeWXaDtmHNe6C` | +0.00 | 0 | 0 | - |
| 264 | Kaaox | `GPryzRs7NshgCoxp382oYoye5PrfUBq8xE1CoEfNayNh` | +0.00 | 0 | 0 | - |
| 265 | 7xNickk | `AmofvGJ59dgf5P85Pofip83pk7nZqrQRmSZvv5rRFVtf` | +0.00 | 0 | 0 | - |
| 266 | Levis | `GwoFJFjUTUSWq2EwTz4P2Sznoq9XYLrf8t4q5kbTgZ1R` | +0.00 | 0 | 0 | - |
| 267 | Pocket Hitlers | `9RrKUhRpbPDNxR7x88ZsCgdtqPHUfwYPjj4JdpV4FBj9` | +0.00 | 0 | 0 | - |
| 268 | Rilsio | `4fZFcK8ms3bFMpo1ACzEUz8bH741fQW4zhAMGd5yZMHu` | +0.00 | 0 | 0 | - |
| 269 | Yami 𓃵 | `7Js5gmq57y9jG2sseKrAeJt3vbncSWSFFHDEsyJDnyVm` | +0.00 | 0 | 0 | - |
| 270 | Ray | `HvNqQBTfoiksyvzGR5rrNAv46DjeNgGNMTB5YZpYh16W` | +0.00 | 0 | 0 | - |
| 271 | Chairman ² | `Be24Gbf5KisDk1LcWWZsBn8dvB816By7YzYF5zWZnRR6` | +0.00 | 0 | 0 | - |
| 272 | Exy | `8hKZKqCgZWxnvRz1XAvmbuzCAfqo5xFjH17vM2J2HTe1` | +0.00 | 0 | 0 | - |
| 273 | dyor ( revenge arc ) | `AVmFMbuehLbCWB6sPdZGComwyrHtxJETZVktdA65j3Gq` | +0.00 | 0 | 0 | - |
| 274 | Unipcs (aka 'Bonk Guy') | `5M8ACGKEXG1ojKDTMH3sMqhTihTgHYMSsZc6W8i7QW3Y` | +0.00 | 0 | 0 | - |
| 275 | Toz | `Fza6jHuaxeJGj3pMtWdTuYs52BHstpnpGawg2SWEra9` | +0.00 | 0 | 0 | - |
| 276 | jazz | `3wDWKhxmvHaMwk2vc3aTgeY5oTqUnGhuDJgJfC9uyRKg` | +0.00 | 0 | 0 | - |
| 277 | Win All Day | `Gtg4qSMkxME783rNdwHYQ11DbQvoXgLodTBLAAa8G5C2` | +0.00 | 0 | 0 | - |
| 278 | Roxo | `AE3tJDEyUdwBM8ZoUb3iCo563gMbq26JtckfvjcVZbSa` | +0.00 | 0 | 0 | - |
| 279 | PRINCESS | `6vZenwrWzCE4aU59CP2SuAotjMHDU9FFcaNNkGXrnPoZ` | +0.00 | 0 | 0 | - |
| 280 | fawi | `A3JBfM4aj2u5g5QdWzA6tVbFzCd8RpfL3jxCDHrM9Qn7` | +0.00 | 0 | 0 | - |
| 281 | Donuttcrypto | `3wjyaSegfV7SZzjv9Ut1p6AcY5ZdoZjmu6i6QPCVvnmz` | +0.00 | 0 | 0 | - |
| 282 | Ron | `8JuRx7WEtgEwP6KqJ8s8FuaMfwbKUwthqFVhRQtP6Ehn` | +0.00 | 0 | 0 | - |
| 283 | Rozer | `4hGiRipRQHS7c1b5fCHVv4fG7eK4XMtfmQZVkpvSkvoK` | +0.00 | 0 | 0 | - |
| 284 | nad | `363sqMFaxZgvCoGzxKjXe1BqMGYkSVoCwmghZUndXuaT` | +0.00 | 0 | 0 | - |
| 285 | Fey | `B6Jx8R9VQDAbwq4rkxsgsWgiJ6GKgWm4ZgCtat2BaHni` | +0.00 | 0 | 0 | - |
| 286 | Boru | `3rwzJNVRrprfTQD3xFgxRK279tVAhNBtGtQk4WdP6Lu2` | +0.00 | 0 | 0 | - |
| 287 | guappy | `3TsRAE3Pdx4eJAcxbiwi9NY8mNYChEkjV5DbAwazFKSq` | +0.00 | 0 | 0 | - |
| 288 | ChartFu | `7i7vHEv87bs135DuoJVKe9c7abentawA5ydfWcWc8iY2` | +0.00 | 0 | 0 | - |
| 289 | buka ᚠ ᛏ ᚲ | `8T1HF5gr2fcULHv3j3nu4koGALCmc8puGGonggmwfg55` | +0.00 | 0 | 0 | - |
| 290 | Mr. Frog | `4DdrfiDHpmx55i4SPssxVzS9ZaKLb8qr45NKY9Er9nNh` | +0.00 | 0 | 0 | - |
| 291 | trav 🎒 | `CXnf4Tt7qFz3KZNwn3Yve5MKaRyxGoAy2eDX3QT8e99m` | +0.00 | 0 | 0 | - |
| 292 | B* | `3wZ6MfB1DRUvtozvcptvV1qAhQ5FKj3qpZR4Db45G6jk` | +0.00 | 0 | 0 | - |
| 293 | boogie | `75oEqXZC569dY1G6UweXviPz4pm8zkhKDSk2FT9Dug5i` | +0.00 | 0 | 0 | - |
| 294 | Thurston (zapped arc) | `ALauG4FwEYDgSXd5Hen6kvuWSCdUi2fYNSNqM1Ci31wE` | +0.00 | 0 | 0 | - |
| 295 | Owl | `A5uxHmjTVyBd1Aj4BFUAekujpPjaWnCrLSRJhjAyvjH4` | +0.00 | 0 | 0 | - |
| 296 | printer | `Bu8iZsGvS5dwuY3GiEDjUSDayEME7LthH4x7TRGTnMXA` | +0.00 | 0 | 0 | - |
| 297 | Bronsi | `4ud45nGBqtBptQPyoVtcLCCCs1Evh1zLsVVLMmDQn2JW` | +0.00 | 0 | 0 | - |
| 298 | staticc | `9pgKiUsNHXMe5p4DoGwzT9i6of7XympnNJ5TgbrZVqk6` | +0.00 | 0 | 0 | - |
| 299 | Sweep | `GP9PyTwGybX3q3tC5dMRKeuq8Dr15uPVvn3Z9fKbempH` | +0.00 | 0 | 0 | - |
| 300 | dingaling | `9X5n5i1mugTjgGPhqf1KJDt8r4kD8TF3s62ttbxKzFHa` | +0.00 | 0 | 0 | - |
| 301 | Don | `winkACDSxstg19HJgX1pwDGpD8f2ZpiqqAjyAbkgXLu` | +0.00 | 0 | 0 | - |
| 302 | Sizeab1e | `AtmeWwb6Y6KNDgu2dPJT5dsar84bFCbNxLiW2DyYfm8p` | +0.00 | 0 | 0 | - |
| 303 | oscar | `AeLb2RpVwrqKZJ87PEiFdReiEXJXACQn17c8APQS1FHx` | +0.00 | 0 | 0 | - |
| 304 | JB | `7dP8DmRka5rmQti4zEEDjdAyaQyvFsPkcXMjEKJucqCu` | +0.00 | 0 | 0 | - |
| 305 | Enjooyer | `Enjoy9BmQgAUD9AKC4HpUbHByVdzwp7jQppKukEvdyWm` | +0.00 | 0 | 0 | - |
| 306 | LilMoonLambo | `GJyhzLoZAxZHZGPvF3V1wsyGUnoGSQ55n6hN6nHv7W8B` | +0.00 | 0 | 0 | - |
| 307 | Solstice | `GrD2umbfEBjQKFPDQvmmYNQ5eyRL9SAdWJj9FFMyeaDN` | +0.00 | 0 | 0 | - |
| 308 | Hail | `HA1L7GhQfypSRdfBi3tCkkCVEdEcBVYqBSQCENCrwPuB` | +0.00 | 0 | 0 | - |
| 309 | Jeets | `D1H83ueSw5Nxy5okxH7VBfV4jRnqAK5Mm1tm3JAj3m5t` | +0.00 | 0 | 0 | - |
| 310 | Daumen | `8MaVa9kdt3NW4Q5HyNAm1X5LbR8PQRVDc1W8NMVK88D5` | -0.07 | 99 | 186 | 34.7% |
| 311 | FINN | `BTeqNydtKyDaSxQNRm8ByaUDPK3cpQ1FsXMtaF1Hfaom` | -0.07 | 4 | 4 | 50.0% |
| 312 | Thesis ✍️ | `5S9qzJhSooakBaA9qZT6vWtoSy8FvyfxJ4t1vXvEK9G7` | -0.16 | 3 | 4 | 42.9% |
| 313 | Eddy 💹🧲 | `DuGezKLZp8UL2aQMHthoUibEC7WSbpNiKFJLTtK1QHjx` | -0.17 | 0 | 1 | 0.0% |
| 314 | Megz 🦉 | `CECN4BW4DKnbyddkd9FhWVR5dotzKhQr5p7DUPhQ55Du` | -0.23 | 1 | 1 | 50.0% |
| 315 | Damian Prosalendis | `AEeJUPCiGR3yCoukTh1G58o4LYsUEyzrXtfmfMc2kJMX` | -0.25 | 0 | 1 | 0.0% |
| 316 | Latuche | `GJA1HEbxGnqBhBifH9uQauzXSB53to5rhDrzmKxhSU65` | -0.31 | 0 | 1 | 0.0% |
| 317 | Inside Calls | `4NtyFqqRzvHWsTmJZoT26H9xtL7asWGTxpcpCxiKax9a` | -0.35 | 1 | 1 | 50.0% |
| 318 | storm | `Dxudj2DQ5odnqgZvUocaeWc1eYC78Q8vfmVtPpvTrRNh` | -0.36 | 30 | 47 | 39.0% |
| 319 | Dusty | `B799XD2RtgkxYRvv5Q9CFnSpVifrsJErWz6MpvBdYFdR` | -0.39 | 0 | 1 | 0.0% |
| 320 | narc | `CxgPWvH2GoEDENELne2XKAR2z2Fr4shG2uaeyqZceGve` | -0.44 | 1 | 1 | 50.0% |
| 321 | Bastille | `3kebnKw7cPdSkLRfiMEALyZJGZ4wdiSRvmoN4rD1yPzV` | -0.45 | 3 | 12 | 20.0% |
| 322 | racks | `CM1dn5LZ21o6PQv3NQpQeEFPGGo9dNpSQ4eWQctmp17g` | -0.51 | 7 | 33 | 17.5% |
| 323 | gr3g | `J23qr98GjGJJqKq9CBEnyRhHbmkaVxtTJNNxKu597wsA` | -0.53 | 1 | 3 | 25.0% |
| 324 | dxrnelljcl | `3jzHjoPKaceZjA6AqAWka7Ghw9F3w9k9cvjGTmybdioT` | -0.56 | 0 | 3 | 0.0% |
| 325 | set | `62N1K57D37AUDGp68tnDYKPjGDsaAAtmo357nBtEtuR` | -0.66 | 0 | 3 | 0.0% |
| 326 | psykø | `FC3nyVqdufVfrgXiRJEqgST1JdJSEBEz6a9KoBfFP7c4` | -0.71 | 0 | 1 | 0.0% |
| 327 | Bluey | `6TAHDM5Tod7dBTZdYQxzgJZKxxPfiNV9udPHMiUNumyK` | -0.72 | 13 | 24 | 35.1% |
| 328 | Junior | `3tnzEgqo6U19ocZbbc49vcGv3mGSoWNFAYjQQk5gF2qP` | -0.74 | 2 | 14 | 12.5% |
| 329 | bruce | `4xHGhy4r41XNEgeHpKSC725aZjy6tR5E92xNjs4odBPR` | -0.81 | 2 | 4 | 33.3% |
| 330 | EvansOfWeb | `5RQEcWJZdhkxRMbwjSq32RaocgYPaWDhi3ztimWUcrwo` | -0.88 | 1 | 2 | 33.3% |
| 331 | mercy | `F5jWYuiDLTiaLYa54D88YbpXgEsA6NKHzWy4SN4bMYjt` | -0.88 | 0 | 2 | 0.0% |
| 332 | Banf | `Fv8byBKV8jK8jxoUtgB1A1dqGcxSoN8x7bUZobP8Xn1d` | -0.91 | 16 | 28 | 36.4% |
| 333 | Mak | `3SU8wjyKGsKZWdxVfak6gkApBqZ8twP613HDGc8Httzr` | -0.97 | 1 | 3 | 25.0% |
| 334 | Jookiaus | `jsjsxPQQ8xoHvQ7ezhKiKWD8FnZe9txuRw3ewKRZUsb` | -1.02 | 1 | 3 | 25.0% |
| 335 | dash | `4ESzFZUWUdr2GsgHBVeQKuzAmBWS5sRSaXw6PZH2EAau` | -1.07 | 5 | 3 | 62.5% |
| 336 | unprofitable | `DYmsQudNqJyyDvq86XmzAvrU9T7xwfQEwh6gPQw9TPNF` | -1.18 | 8 | 15 | 34.8% |
| 337 | Zemrics | `EP5mvfhGv6x1XR33Fd8eioiYjtRXAawafPmkz9xBpDvG` | -1.31 | 3 | 11 | 21.4% |
| 338 | wizard | `DwCp9GZw3ueoXPykHSPUkRZEwcTVbJH2i9Sf1cXYicWf` | -1.42 | 1 | 6 | 14.3% |
| 339 | rambo | `2net6etAtTe3Rbq2gKECmQwnzcKVXRaLcHy2Zy1iCiWz` | -1.45 | 97 | 249 | 28.0% |
| 340 | fl0wjoe | `9v9Xsxxu2pi4cDkTHtyL1Rg417uga48R2VcCP4L1Pe9R` | -1.56 | 1 | 4 | 20.0% |
| 341 | CookDoc | `Dvbv5TdAyPpJk16X9mUxWFVicYtCUxTLhuof8TGuUaRv` | -1.66 | 2 | 4 | 33.3% |
| 342 | Heyitsyolo | `Av3xWHJ5EsoLZag6pr7LKbrGgLRTaykXomDD5kBhL9YQ` | -1.84 | 0 | 1 | 0.0% |
| 343 | Matt | `3bzaJd5yZG73EVDz8xosQb7gfZm2LN5auFGh6wnP1n1f` | -2.04 | 3 | 14 | 17.6% |
| 344 | bilo | `7sA5em1nTKmLvGm8H85cpgA9hM9YvCoPp729mwe6akhh` | -2.10 | 1 | 7 | 12.5% |
| 345 | Coasty | `CATk62cYqDFXTh3rsRbS1ibCyzBeovc2KXpXEaxEg3nB` | -2.13 | 5 | 8 | 38.5% |
| 346 | Hueno | `FWAmTVsmAjxYZe4Nt5ooLDg6AHHUx3ST3nz89oGSGu59` | -2.17 | 0 | 2 | 0.0% |
| 347 | decu | `4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9` | -2.20 | 48 | 78 | 38.1% |
| 348 | Mike | `A8i6J8B1DgVdQaoeyrCmc18473EzYocEtZGavHT4sXzw` | -2.25 | 3 | 5 | 37.5% |
| 349 | OGAntD | `215nhcAHjQQGgwpQSJQ7zR26etbjjtVdW74NLzwEgQjP` | -2.25 | 2 | 2 | 50.0% |
| 350 | Boomer | `4JyenL2p8eQZAQuRS8QAASy7TzEcqAeKGha6bhiJXudh` | -2.57 | 1 | 6 | 14.3% |
| 351 | Beaver | `GM7Hrz2bDq33ezMtL6KGidSWZXMWgZ6qBuugkb5H8NvN` | -2.64 | 0 | 1 | 0.0% |
| 352 | Sebi | `DxwDRWxQXDaVZquH3YvCVBQ75nUf16FttQ4q88okn5mc` | -2.94 | 0 | 2 | 0.0% |
| 353 | Lucas | `6uwzmiSnR2vVwrh6EsQfuwSVk8ScqsfYkJPQQ2eydU2M` | -2.95 | 3 | 12 | 20.0% |
| 354 | S | `ApRnQN2HkbCn7W2WWiT2FEKvuKJp9LugRyAE1a9Hdz1` | -3.02 | 0 | 9 | 0.0% |
| 355 | Rem | `3pfqebV65sHMbF5z86HsPKSiTxwpNhCzjK5X7GUqCbtK` | -3.20 | 0 | 5 | 0.0% |
| 356 | Zoke | `6MrVEEBypwJuakxLQTeEvidCgM6LDLtfMQeWdnrjpobM` | -3.38 | 2 | 19 | 9.5% |
| 357 | King | `69z4qTgQ5DBRTJvnQzx2h8jZhNsv5UgADotEwwKUm2JS` | -3.38 | 7 | 12 | 36.8% |
| 358 | Tally ꨄ︎ | `JAmx4Wsh7cWXRzQuVt3TCKAyDfRm9HA7ztJa4f7RM8h9` | -3.44 | 1 | 9 | 10.0% |
| 359 | Veloce | `2W14ahXD3XBfWJchQ4K5NLXmguWWcTTUTuHDhEzeuvP3` | -3.52 | 14 | 27 | 34.1% |
| 360 | fz7 | `G2mgnzpr59vYjKpwU9q5zVfS9yQ9HezMwjuqF7LACvR4` | -3.53 | 3 | 20 | 13.0% |
| 361 | Dex | `mW4PZB45isHmnjGkLpJvjKBzVS5NXzTJ8UDyug4gTsM` | -3.54 | 3 | 8 | 27.3% |
| 362 | Xanse. | `B9K2wTQcRDLRLhMKFyRh2hPqHrr6VKiCC9yNGpkMUXrh` | -3.62 | 1 | 10 | 9.1% |
| 363 | Advyth | `GEKZWL474tFAyYDUoTgKEgYuMxT3Se7HzKDDptrnXnvS` | -3.65 | 3 | 8 | 27.3% |
| 364 | bihoz | `An68XCxJvfXc9NRWjNXGSFY55dyFVKjfgtpt8AKGJ2dE` | -3.74 | 26 | 63 | 29.2% |
| 365 | marker | `CQervCdE3WAUGRmaTj9NHdbNrNGVsxJb68t3QggcntM2` | -3.78 | 10 | 11 | 47.6% |
| 366 | Solana degen | `9tY7u1HgEt2RDcxym3RJ9sfvT3aZStiiUwXd44X9RUr8` | -4.07 | 0 | 4 | 0.0% |
| 367 | Absol | `BXNiM7pqt9Ld3b2Hc8iT3mA5bSwoe9CRrtkSUs15SLWN` | -4.11 | 1 | 10 | 9.1% |
| 368 | Groovy | `34ZEH778zL8ctkLwxxERLX5ZnUu6MuFyX9CWrs8kucMw` | -4.18 | 1 | 9 | 10.0% |
| 369 | samsrep | `CUHBzSPSaNS3tArEtM3maSV6pNdJhHJFYZpurPPK9P7H` | -4.33 | 2 | 8 | 20.0% |
| 370 | Marcell | `FixmSpsBa7ew26gWdiqpoMAgKRFgbSXFbGAgfMZw67X` | -4.63 | 0 | 3 | 0.0% |
| 371 | crayohla | `GDoG4tdbx8qkpECQKF5MebbEDpFJn6H739psqgoTG3aN` | -4.76 | 5 | 18 | 21.7% |
| 372 | ozark | `DZAa55HwXgv5hStwaTEJGXZz1DhHejvpb7Yr762urXam` | -4.82 | 11 | 32 | 25.6% |
| 373 | Betman | `BoYHJoKntk3pjkaV8qFojEonSPWmWMfQocZTwDd1bcGG` | -5.35 | 5 | 18 | 21.7% |
| 374 | Johnson | `J9TYAsWWidbrcZybmLSfrLzryANf4CgJBLdvwdGuC8MB` | -5.38 | 4 | 6 | 40.0% |
| 375 | k4ye | `5fHJszey2UdB2nETS1y6NS2wSG4ic9byKtbgJzaYzGeV` | -5.66 | 30 | 60 | 33.3% |
| 376 | slingoor | `6mWEJG9LoRdto8TwTdZxmnJpkXpTsEerizcGiCNZvzXd` | -5.68 | 0 | 3 | 0.0% |
| 377 | Grimace | `EA4MXkyF8C2NzY8fw2acJPuarmoU271KRCCAYpLzMBJr` | -5.93 | 5 | 10 | 33.3% |
| 378 | trunoest | `ardinRsN1mNYVeoJWTBsWeYeXvuR9UUDGMsCDKpb6AT` | -6.04 | 3 | 14 | 17.6% |
| 379 | Hugo Fartingale | `Au1GUWfcadx7jMzhsg6gHGUgViYJrnPfL1vbdqnvLK4i` | -6.46 | 0 | 1 | 0.0% |
| 380 | Netti | `8WN7tkp8WcZEYX2cSXJQY8u3q5QHEtykrZqJmFP7NYcf` | -6.84 | 16 | 54 | 22.9% |
| 381 | Joji | `525LueqAyZJueCoiisfWy6nyh4MTvmF4X9jSqi6efXJT` | -7.14 | 1 | 4 | 20.0% |
| 382 | rise_crypt | `AUEQxhkAVz71w2WBa9BYSoZrydhYNJaKmfNomoNs9E4t` | -7.19 | 2 | 6 | 25.0% |
| 383 | Mazino | `9r1BenK1nPvkZyD88q3e6bTKjfqDcLjxnXn9ovreDL52` | -7.43 | 12 | 34 | 26.1% |
| 384 | saale | `SAALE2x3sn51EyahJyqD6913L3GqHZdZo3egUdMayQp` | -7.57 | 0 | 1 | 0.0% |
| 385 | Ban | `8DGbkGgQewL9mx4aXzZCUChr7hBVXvPK9fYqSqc7Ajpn` | -8.10 | 40 | 133 | 23.1% |
| 386 | Roshi 風と | `5JrDgnED5QFiaE8Znny2S9GwCeDK2pLYjMfWmjKogs3w` | -8.11 | 3 | 14 | 17.6% |
| 387 | JB | `JBrYniqfp9ZVWdrkhMEX2LNGBpYJ673Tzh2m3XsS14p7` | -8.30 | 5 | 13 | 27.8% |
| 388 | Dali | `CvNiezB8hofusHCKqu8irJ6t2FKY7VjzpSckofMzk5mB` | -8.49 | 2 | 18 | 10.0% |
| 389 | peacefuldestroy | `8AtQ4ka3dgtrH1z4Uq3Tm4YdMN3cK5RRj1eKuGNnvenm` | -8.70 | 1 | 5 | 16.7% |
| 390 | Putrick | `AVjEtg2ECYKXYeqdRQXvaaAZBjfTjYuSMTR4WLhKoeQN` | -8.78 | 6 | 23 | 20.7% |
| 391 | CoCo | `FqojC24nUn3x6oMQC2ypBHmtH7rFAnKS6DvwsJoCMaiv` | -8.91 | 10 | 15 | 40.0% |
| 392 | rez | `FkRN9yF3Gysw3BVhUqAXJJMEGfKiJNaPQAWYWBErgDuN` | -9.15 | 7 | 22 | 24.1% |
| 393 | juicyfruity | `Cv4JVc25RZ7JV8HhEXrnxJjzebMBCqN5prB5ec43aJSz` | -9.24 | 137 | 362 | 27.5% |
| 394 | Sanity | `5ruP877fu8sBshx9inDeHsVLjnJtgVBTbjnbupeDHYHH` | -9.27 | 6 | 30 | 16.7% |
| 395 | matsu | `9f5ywdCDA4QhSktBomozpHmZfSLqS6J9VqCrRehYWh1p` | -9.31 | 53 | 176 | 23.1% |
| 396 | Kimba | `7mHqL9GzGnbsYLoHLDzB7FiHAZbND2CZCJYFvU9PU1d3` | -9.52 | 5 | 10 | 33.3% |
| 397 | bust | `FzVQSzj8JJr6WMGqbUHzx2XH1KkrfxRrRPv6WcbbZmND` | -9.90 | 13 | 33 | 28.3% |
| 398 | Gasp | `xyzfhxfy8NhfeNG3Um3WaUvFXzNuHkrhrZMD8dsStB6` | -10.12 | 14 | 47 | 23.0% |
| 399 | Felix | `3uz65G8e463MA5FxcSu1rTUyWRtrRLRZYskKtEHHj7qn` | -10.80 | 1 | 13 | 7.1% |
| 400 | ^1s1mple | `AeLaMjzxErZt4drbWVWvcxpVyo8p94xu5vrg41eZPFe3` | -10.91 | 72 | 254 | 22.1% |
| 401 | Megga | `H31vEBxSJk1nQdUN11qZgZyhScyShhscKhvhZZU3dQoU` | -11.00 | 7 | 23 | 23.3% |
| 402 | kreo | `BCnqsPEtA1TkgednYEebRpkmwFRJDCjMQcKZMMtEdArc` | -11.13 | 5 | 25 | 16.7% |
| 403 | EustazZ | `FqamE7xrahg7FEWoByrx1o8SeyHt44rpmE6ZQfT7zrve` | -11.13 | 7 | 28 | 20.0% |
| 404 | Sebastian | `3BLjRcxWGtR7WRshJ3hL25U3RjWr5Ud98wMcczQqk4Ei` | -11.14 | 6 | 26 | 18.8% |
| 405 | Jidn | `3h65MmPZksoKKyEpEjnWU2Yk2iYT5oZDNitGy5cTaxoE` | -11.57 | 2 | 15 | 11.8% |
| 406 | jakey | `B3JyPD3t9ufZWfL3namyvoc258KH74JojSxxurUg9jCT` | -12.26 | 4 | 15 | 21.1% |
| 407 | chester | `PMJA8UQDyWTFw2Smhyp9jGA6aTaP7jKHR7BPudrgyYN` | -12.69 | 34 | 117 | 22.5% |
| 408 | Ataberk 🧙‍♂️ | `6hcX7fVMzeRpW3d7XhFsxYw2CuePfgSMmouZxSiNLj1U` | -13.06 | 0 | 5 | 0.0% |
| 409 | Reljoo | `FsG3BaPmRTdSrPaivbgJsFNCCa8cPfkUtk8VLWXkHpHP` | -13.29 | 1 | 13 | 7.1% |
| 410 | dv | `BCagckXeMChUKrHEd6fKFA1uiWDtcmCXMsqaheLiUPJd` | -13.80 | 31 | 87 | 26.3% |
| 411 | Giann | `GNrmKZCxYyNiSUsjduwwPJzhed3LATjciiKVuSGrsHEC` | -14.44 | 239 | 445 | 34.9% |
| 412 | Orange | `2X4H5Y9C4Fy6Pf3wpq8Q4gMvLcWvfrrwDv2bdR8AAwQv` | -15.03 | 10 | 44 | 18.5% |
| 413 | Ducky | `ADC1QV9raLnGGDbnWdnsxazeZ4Tsiho4vrWadYswA2ph` | -15.05 | 2 | 16 | 11.1% |
| 414 | King Solomon | `DEdEW3SMPU2dCfXEcgj2YppmX9H3bnMDJaU4ctn2BQDQ` | -15.17 | 56 | 168 | 25.0% |
| 415 | TIL | `EHg5YkU2SZBTvuT87rUsvxArGp3HLeye1fXaSDfuMyaf` | -15.79 | 2 | 13 | 13.3% |
| 416 | CameXBT | `67SNjkjV2MEyhDZcDjvMQSqFtjkh6TjCq6KDLmCgUxx6` | -18.47 | 15 | 66 | 18.5% |
| 417 | Exotic | `Dwo2kj88YYhwcFJiybTjXezR9a6QjkMASz5xXD7kujXC` | -18.51 | 37 | 117 | 24.0% |
| 418 | Otta | `As7HjL7dzzvbRbaD3WCun47robib2kmAKRXMvjHkSMB5` | -18.56 | 7 | 36 | 16.3% |
| 419 | Smokez | `5t9xBNuDdGTGpjaPTx6hKd7sdRJbvtKS8Mhq6qVbo8Qz` | -19.59 | 6 | 10 | 37.5% |
| 420 | tech | `5d3jQcuUvsuHyZkhdp78FFqc7WogrzZpTtec1X9VNkuE` | -20.31 | 1 | 3 | 25.0% |
| 421 | shah | `7xwDKXNG9dxMsBSCmiAThp7PyDaUXbm23irLr7iPeh7w` | -20.36 | 1 | 16 | 5.9% |
| 422 | Leens | `LeenseyyUU3ccdBPCFCrrZ8oKU2B3T2uToGGZ7eVABY` | -20.49 | 5 | 21 | 19.2% |
| 423 | Kev | `BTf4A2exGK9BCVDNzy65b9dUzXgMqB4weVkvTMFQsadd` | -20.86 | 29 | 63 | 31.5% |
| 424 | Hesi | `FpD6n8gfoZNxyAN6QqNH4TFQdV9vZEgcv5W4H2YL8k4X` | -22.19 | 69 | 201 | 25.6% |
| 425 | Fashr | `719sfKUjiMThumTt2u39VMGn612BZyCcwbM5Pe8SqFYz` | -23.31 | 15 | 65 | 18.8% |
| 426 | noob mini | `AGqjivJr1dSv73TVUvdtqAwogzmThzvYMVXjGWg2FYLm` | -24.16 | 11 | 46 | 19.3% |
| 427 | West | `JDd3hy3gQn2V982mi1zqhNqUw1GfV2UL6g76STojCJPN` | -24.55 | 4 | 26 | 13.3% |
| 428 | Red | `7ABz8qEFZTHPkovMDsmQkm64DZWN5wRtU7LEtD2ShkQ6` | -24.94 | 7 | 17 | 29.2% |
| 429 | Monki | `53BnNc49Ajgstciq3CRoyxuBpkkW1r8pgPyvr7JGYnsh` | -25.64 | 3 | 20 | 13.0% |
| 430 | cryptovillain26 | `5sNnKuWKUtZkdC1eFNyqz3XHpNoCRQ1D1DfHcNHMV7gn` | -25.94 | 34 | 178 | 16.0% |
| 431 | WaiterG | `4cXnf2z85UiZ5cyKsPMEULq1yufAtpkatmX4j4DBZqj2` | -26.08 | 10 | 32 | 23.8% |
| 432 | Flames | `6aXFYXbFob1ZKAEDCcqZnX2vooA3TgEqDoy5dAQbeWoV` | -26.73 | 33 | 109 | 23.2% |
| 433 | Nilla | `j38fhfqWsJyt8hzym48P8QMsXWx1FfLUxQwuor7Ti4o` | -26.83 | 63 | 156 | 28.8% |
| 434 | Zuki | `922VvmmYDHV9KMTJJ71Y5Yd3Vn7cfJuFasLNSsZPygrG` | -26.86 | 6 | 41 | 12.8% |
| 435 | Scharo | `4sAUSQFdvWRBxR8UoLBYbw8CcXuwXWxnN8pXa4mtm5nU` | -27.27 | 4 | 17 | 19.0% |
| 436 | Publix | `86AEJExyjeNNgcp7GrAvCXTDicf5aGWgoERbXFiG1EdD` | -27.42 | 4 | 26 | 13.3% |
| 437 | M A M B A 🧲 | `4nvNc7dDEqKKLM4Sr9Kgk3t1of6f8G66kT64VoC95LYh` | -28.93 | 19 | 60 | 24.1% |
| 438 | Silver | `67Nwfi9hgwqhxGoovT2JGLU67uxfomLwQAWncjXXzU6U` | -31.13 | 16 | 58 | 21.6% |
| 439 | Kadenox | `B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC` | -32.74 | 76 | 195 | 28.0% |
| 440 | Art | `CgaA9a1JwAXJyfHuvZ7VW8YfTVRkdiT5mjBBSKcg7Rz5` | -33.68 | 29 | 97 | 23.0% |
| 441 | Tom | `CEUA7zVoDRqRYoeHTP58UHU6TR8yvtVbeLrX1dppqoXJ` | -34.24 | 7 | 25 | 21.9% |
| 442 | Henn | `FRbUNvGxYNC1eFngpn7AD3f14aKKTJVC6zSMtvj2dyCS` | -34.37 | 4 | 36 | 10.0% |
| 443 | Padre | `4Ff9dbi9L93qMvevpESY4YLHtdqTd8Yj8jXj3VwCNY4g` | -35.07 | 7 | 29 | 19.4% |
| 444 | Cooker | `8deJ9xeUvXSJwicYptA9mHsU2rN2pDx37KWzkDkEXhU6` | -36.67 | 4 | 4 | 50.0% |
| 445 | Files | `DtjYbZntc2mEm1UrZHNcKguak6h6QM4S5xobnwFgg92Y` | -38.16 | 8 | 36 | 18.2% |
| 446 | Clown | `EDXHdSFdadFbYFFjxPXBqMe1kCEDFqpPu552uvp48HR8` | -38.64 | 12 | 60 | 16.7% |
| 447 | Earl | `F2SuErm4MviWJ2HzKXk2nuzBC6xe883CFWUDCPz6cyWm` | -45.75 | 8 | 54 | 12.9% |
| 448 | dov 7 | `8nqtxpFpuXwfXG4pBLsDkkuMMPK9FjSkBMCn542HiM3v` | -45.77 | 187 | 315 | 37.3% |
| 449 | Letterbomb | `BtMBMPkoNbnLF9Xn552guQq528KKXcsNBNNBre3oaQtr` | -46.36 | 5 | 43 | 10.4% |
| 450 | Dani | `AuPp4YTMTyqxYXQnHc5KUc6pUuCSsHQpBJhgnD45yqrf` | -47.77 | 14 | 26 | 35.0% |
| 451 | AlxCooks | `89HbgWduLwoxcofWpmn1EiF9wEdpgkNDEyPjzZ72mkDi` | -49.33 | 11 | 37 | 22.9% |
| 452 | Tuults | `5T229oePmJGE5Cefys8jE9Jq8C7qfGNNWy3RVA7SmwEP` | -50.55 | 7 | 31 | 18.4% |
| 453 | Zyaf | `F5TjPySiUJMdvqMZHnPP85Rc1vErDGV5FR5P2vdVm429` | -53.40 | 46 | 90 | 33.8% |
| 454 | Cupsey | `2fg5QD1eD7rzNNCsvnhmXFm5hqNgwTTG8p7kQ6f3rx6f` | -55.17 | 314 | 599 | 34.4% |
| 455 | Casino | `8rvAsDKeAcEjEkiZMug9k8v1y8mW6gQQiMobd89Uy7qR` | -55.37 | 14 | 34 | 29.2% |
| 456 | Mayhem Bot | `BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s` | -56.15 | 49109 | 24555 | 66.7% |
| 457 | Sheep | `78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2` | -57.60 | 45 | 42 | 51.7% |
| 458 | Limfork.eth | `BQVz7fQ1WsQmSTMY3umdPEPPTm1sdcBcX9sP7o6kPRmB` | -57.72 | 90 | 258 | 25.9% |
| 459 | xunle | `4YzpSZpxDdjNf3unjkCtdWEsz2FL5mok7e5XQaDNqry8` | -59.60 | 16 | 60 | 21.1% |
| 460 | xander | `B3wagQZiZU2hKa5pUCj6rrdhWsX3Q6WfTTnki9PjwzMh` | -61.03 | 6 | 34 | 15.0% |
| 461 | h14 | `BJXjRq566xt66pcxCmCMLPSuNxyUpPNBdJGP56S7fMda` | -62.57 | 319 | 994 | 24.3% |
| 462 | prettyover | `2e1w3Xo441Ytvwn54wCn8itAXwCKbiizc9ynGEv14Vis` | -66.67 | 11 | 54 | 16.9% |
| 463 | danny | `EaVboaPxFCYanjoNWdkxTbPvt57nhXGu5i6m9m6ZS2kK` | -73.44 | 11 | 30 | 26.8% |
| 464 | Setsu | `2k7Mnf2K3GhpB7hEVN1CFFeV4oNzzuCS5Q6SmcfAoLHd` | -83.96 | 49 | 103 | 32.2% |
| 465 | Ethan Prosper | `sAdNbe1cKNMDqDsa4npB3TfL62T14uAo2MsUQfLvzLT` | -95.45 | 35 | 101 | 25.7% |
| 466 | Trey | `831yhv67QpKqLBJjbmw2xoDUeeFHGUx8RnuRj9imeoEs` | -112.12 | 74 | 162 | 31.4% |
| 467 | Leck | `98T65wcMEjoNLDTJszBHGZEX75QRe8QaANXokv4yw3Mp` | -112.97 | 24 | 118 | 16.9% |
| 468 | Loopierr | `9yYya3F5EJoLnBNKW6z4bZvyQytMXzDcpU5D6yYr4jqL` | -123.79 | 69 | 251 | 21.6% |
| 469 | Domy | `3LUfv2u5yzsDtUzPdsSJ7ygPBuqwfycMkjpNreRR2Yww` | -137.49 | 46 | 236 | 16.3% |
| 470 | omar | `Dgehc8YMv6dHsiPJVoumvq4pSBkMVvrTgTUg7wdcYJPJ` | -143.04 | 20 | 81 | 19.8% |
| 471 | cap | `CAPn1yH4oSywsxGU456jfgTrSSUidf9jgeAnHceNUJdw` | -154.11 | 76 | 181 | 29.6% |
| 472 | bandit | `5B79fMkcFeRTiwm7ehsZsFiKsC7m7n1Bgv9yLxPp9q2X` | -203.69 | 106 | 274 | 27.9% |
