// KolScan leaderboard entry (original format)
export interface KolEntry {
  wallet_address: string;
  name: string;
  telegram: string | null;
  twitter: string | null;
  profit: number;
  wins: number;
  losses: number;
  timeframe: number;
}

// GMGN wallet entry (normalized from GMGN scrape)
export interface GmgnWallet {
  wallet_address: string;
  name: string;
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
}

// Unified wallet for combined leaderboard views
export interface UnifiedWallet {
  wallet_address: string;
  name: string;
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
  winrate_7d: number;
  winrate_30d: number;
  avatar: string | null;
}

// X/Twitter profile data (scraped via xactions)
export interface XProfile {
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
  verified: boolean;
  joinDate: string | null;
  scrapedAt: string;
  error?: string;
}

export type SortField = "name" | "profit" | "wins" | "losses" | "winrate";
export type GmgnSortField = "name" | "profit_1d" | "profit_7d" | "profit_30d" | "winrate_7d" | "buys_7d" | "sells_7d";
export type SortDir = "asc" | "desc";
export type Timeframe = 1 | 7 | 30;
export type WalletSource = "kolscan" | "gmgn" | "all";
export type Chain = "sol" | "bsc";
