// KolScan leaderboard entry (original format)
export interface KolEntry {
  wallet_address: string;
  name: string;
  telegram: string | null;
  twitter: string | null;
  avatar?: string | null;
  profit: number;
  wins: number;
  losses: number;
  timeframe: number;
}

// GMGN wallet entry (normalized from GMGN scrape)
export interface GmgnWallet {
  wallet_address: string;
  name: string;
  sns_id?: string | null;
  ens_name?: string | null;
  twitter_username: string | null;
  twitter_name: string | null;
  avatar: string | null;
  tags: string[];
  category: string; // smart_degen, kol, snipe_bot, etc.
  chain: "sol" | "bsc";
  realized_profit_1d: number;
  realized_profit_7d: number;
  realized_profit_30d: number;
  buy_1d: number;
  buy_7d: number;
  buy_30d: number;
  sell_1d: number;
  sell_7d: number;
  sell_30d: number;
  winrate_7d: number;
  winrate_30d: number;
  balance: number;
  last_active: number;
  follow_count: number;
  // PnL ratios (ROI)
  pnl_1d: number;
  pnl_7d: number;
  pnl_30d: number;
  // Transaction counts
  txs_1d: number;
  txs_7d: number;
  txs_30d: number;
  // Win rate 1d
  winrate_1d: number;
  // Volume
  volume_1d: number;
  volume_7d: number;
  volume_30d: number;
  // Average cost basis
  avg_cost_1d: number;
  avg_cost_7d: number;
  avg_cost_30d: number;
  // Average holding period (seconds)
  avg_holding_period_1d: number;
  avg_holding_period_7d: number;
  avg_holding_period_30d: number;
  // Net inflow/outflow
  net_inflow_1d: number;
  net_inflow_7d: number;
  net_inflow_30d: number;
  // PnL distribution (7d trade outcome buckets)
  pnl_lt_minus_dot5_num_7d: number; // trades at < -50%
  pnl_minus_dot5_0x_num_7d: number; // trades at -50% to 0x
  pnl_lt_2x_num_7d: number;         // trades at 0-2x
  pnl_2x_5x_num_7d: number;         // trades at 2-5x
  pnl_gt_5x_num_7d: number;         // trades at >5x
  // Daily profit sparkline
  daily_profit_7d: { timestamp: number; profit: number }[];
}

// Unified wallet for combined leaderboard views
export interface UnifiedWallet {
  wallet_address: string;
  name: string;
  sns_id?: string | null;
  ens_name?: string | null;
  twitter: string | null;
  chain: "sol" | "bsc";
  source: "kolscan" | "gmgn";
  category: string;
  tags: string[];
  profit_1d: number;
  profit_7d: number;
  profit_30d: number;
  buys_1d: number;
  buys_7d: number;
  buys_30d: number;
  sells_1d: number;
  sells_7d: number;
  sells_30d: number;
  winrate_1d: number;
  winrate_7d: number;
  winrate_30d: number;
  avatar: string | null;
  sparkline?: number[]; // 7-day daily profit values (GMGN wallets only)
}

// X/Twitter profile data (scraped via xactions)
export interface XProfile {
  id: string | null;
  username: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar: string | null;
  header: string | null;
  followers: number;
  following: number;
  tweets: number;
  likes: number;
  media: number;
  verified: boolean;
  protected: boolean;
  joinDate: string | null;
  pinnedTweetId: string | null;
  scrapedAt: string;
  error?: string;
}

export type SortField = "name" | "profit" | "wins" | "losses" | "winrate";

// GMGN X Tracker account
export interface XTrackerAccount {
  handle: string;
  name: string | null;
  avatar: string | null;
  subscribers: number;
  followers: number;
  tag: string | null;
  verified: boolean;
  bio: string | null;
}

export interface XTrackerData {
  meta: {
    scrapedAt: string;
    source: string;
    totalAccounts: number;
  };
  accounts: XTrackerAccount[];
}
export type GmgnSortField = "name" | "profit_1d" | "profit_7d" | "profit_30d" | "winrate_7d" | "buys_7d" | "sells_7d";
export type SortDir = "asc" | "desc";
export type Timeframe = 1 | 7 | 30;
export type WalletSource = "kolscan" | "gmgn" | "all";
export type Chain = "sol" | "bsc";
