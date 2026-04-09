# Task Prompts

Copy-paste these prompts into chat sessions to implement specific features.

## 📋 Quick Start

1. Read [00-what-youre-missing.md](00-what-youre-missing.md) first for architecture decisions
2. Start with **Phase 1** (Proxy Architecture)
3. Each task is self-contained with requirements, acceptance criteria, and file lists

---

## Task Categories

### 📖 Overview
- [00-what-youre-missing.md](00-what-youre-missing.md) - **Read first!** Architecture decisions, considerations, recommendations

### 🔧 Integration Tasks (Enhance Existing Pages)
| Task | Description | Complexity |
|------|-------------|------------|
| [01-enhance-all-solana.md](01-enhance-all-solana.md) | Add multi-source data to unified Solana view | Medium |
| [02-enhance-wallet-detail.md](02-enhance-wallet-detail.md) | Rich wallet profiles with all API data | High |
| [03-enhance-token-page.md](03-enhance-token-page.md) | Complete token analytics + security | High |
| [04-enhance-leaderboard.md](04-enhance-leaderboard.md) | Multi-source leaderboard rankings | Medium |
| [05-enhance-trending.md](05-enhance-trending.md) | Cross-platform trending aggregation | Medium |

### 🆕 New Page Tasks
| Task | Description | Complexity |
|------|-------------|------------|
| [10-smart-money-tracker.md](10-smart-money-tracker.md) | Real-time whale/smart money feed | High |
| [11-multi-chain-portfolio.md](11-multi-chain-portfolio.md) | Cross-chain portfolio analyzer | High |
| [12-token-scanner.md](12-token-scanner.md) | Security + analytics scanner | Medium |
| 13-whale-alerts.md | Large transaction feed | Medium |
| 14-kol-performance.md | KOL trading performance dashboard | Medium |
| 15-defi-positions.md | DeFi position tracker | Medium |
| 16-compare-wallets.md | Side-by-side wallet comparison | Low |
| 17-token-holders.md | Top holder analysis | Low |
| 18-narrative-tracker.md | Trending narratives/categories | Low |

### 🔌 Proxy API Tasks
| Task | Description | Complexity |
|------|-------------|------------|
| [20-proxy-architecture.md](20-proxy-architecture.md) | **Core proxy system design** | High |
| [21-proxy-solana.md](21-proxy-solana.md) | Solana proxies (Helius, Birdeye, Solscan, Jupiter) | Medium |
| [22-proxy-evm.md](22-proxy-evm.md) | EVM proxies (Moralis, Alchemy, DeBank, Etherscan, Covalent) | Medium |
| [23-proxy-market.md](23-proxy-market.md) | Market proxies (DexScreener, CoinGecko, GeckoTerminal, GMGN) | Medium |
| [24-proxy-analytics.md](24-proxy-analytics.md) | Analytics proxies (Dune, Flipside, Bitquery, The Graph) | Medium |
| [25-api-docs.md](25-api-docs.md) | Interactive API documentation page | Medium |

### 🏗️ Infrastructure Tasks
| Task | Description | Complexity |
|------|-------------|------------|
| [30-caching-layer.md](30-caching-layer.md) | Redis + memory caching with stale-while-revalidate | High |
| [31-rate-limiting.md](31-rate-limiting.md) | Per-user rate limiting with tiered plans | Medium |
| 32-webhooks.md | Real-time webhook subscriptions | Medium |
| 33-sdk-client.md | TypeScript SDK for our API | Low |

---

## 🚀 Recommended Priority

### Phase 1 — Core Proxy (Do First)
1. `20-proxy-architecture.md` — Core system design
2. `30-caching-layer.md` — Caching infrastructure
3. `31-rate-limiting.md` — Rate limiting
4. `21-proxy-solana.md` — Solana endpoints
5. `22-proxy-evm.md` — EVM endpoints

### Phase 2 — Enhanced Pages
1. `01-enhance-all-solana.md` — Main page improvement
2. `02-enhance-wallet-detail.md` — Wallet deep dive
3. `04-enhance-leaderboard.md` — Rankings

### Phase 3 — New Features
1. `10-smart-money-tracker.md` — High value feature
2. `12-token-scanner.md` — Security focus
3. `11-multi-chain-portfolio.md` — Portfolio view

### Phase 4 — Polish
1. `25-api-docs.md` — Documentation
2. `23-proxy-market.md` — Market data
3. `24-proxy-analytics.md` — Analytics

---

## 📁 Files Created

After completing all tasks, your structure will include:

```
site/
├── app/
│   ├── api/proxy/           # All proxy routes
│   │   ├── solana/
│   │   ├── evm/
│   │   ├── market/
│   │   └── analytics/
│   ├── smart-money/         # New page
│   ├── portfolio/           # New page
│   ├── scanner/             # New page
│   └── docs/api/           # API docs
├── lib/
│   ├── proxy/              # Proxy handler, sources
│   ├── cache/              # Caching layer
│   └── rate-limit/         # Rate limiting
└── ...
```

---

## 🔑 APIs Utilized

| Provider | Endpoints | Used In |
|----------|-----------|---------|
| Helius | transactions, balances, PnL, DAS | Solana proxy, wallet pages |
| Birdeye | prices, security, holdings | Solana proxy, token scanner |
| Solscan | accounts, transactions | Solana proxy |
| Jupiter | prices, quotes, top tokens | Solana proxy |
| Moralis | wallets, tokens, NFTs, DeFi | EVM proxy |
| DeBank | portfolios, protocols, history | EVM proxy, portfolio page |
| Alchemy | balances, transfers, NFTs | EVM proxy |
| Etherscan V2 | transactions, tokens, gas | EVM proxy |
| Covalent | 200+ chains, balances | EVM proxy |
| DexScreener | pairs, trending, boosts | Market proxy |
| CoinGecko | markets, trending, coins | Market proxy |
| GeckoTerminal | pools, networks | Market proxy |
| GMGN | smart money, trending | Market proxy, leaderboard |
| Dune | SQL queries, Echo API | Analytics proxy |
| Flipside | SQL queries | Analytics proxy |
| Bitquery | GraphQL | Analytics proxy |
| The Graph | Subgraphs | Analytics proxy |
