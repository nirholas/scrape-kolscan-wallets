import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  username: varchar("username", { length: 20 }).unique(),
  displayUsername: varchar("display_username", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// --- API Keys ---

export const apiKey = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull().unique(),
    name: text("name"),
    tier: text("tier").notNull().default("free"), // 'free', 'pro'
    rateLimit: integer("rate_limit").notNull().default(60),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => {
    return {
      userIdx: index("api_key_user_idx").on(table.userId),
    };
  },
);

export const apiUsage = pgTable(
  "api_usage",
  {
    id: text("id").primaryKey(),
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKey.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    source: text("source").notNull(),
    cached: boolean("cached").notNull().default(false),
    latency: integer("latency"),
    status: integer("status"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      apiKeyIdx: index("api_usage_api_key_idx").on(table.apiKeyId),
      endpointIdx: index("api_usage_endpoint_idx").on(table.endpoint),
      sourceIdx: index("api_usage_source_idx").on(table.source),
      createdAtIdx: index("api_usage_created_at_idx").on(table.createdAt),
    };
  },
);

export const apiUsageDaily = pgTable(
  "api_usage_daily",
  {
    apiKeyId: text("api_key_id")
      .notNull()
      .references(() => apiKey.id, { onDelete: "cascade" }),
    date: timestamp("date", { mode: "date" }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    cacheHits: integer("cache_hits").notNull().default(0),
    errors: integer("errors").notNull().default(0),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.apiKeyId, table.date] }),
    };
  },
);

// --- API Proxy ---
export const walletSubmission = pgTable(
  "wallet_submission",
  {
    id: text("id").primaryKey(),
    walletAddress: varchar("wallet_address", { length: 96 }).notNull(),
    chain: text("chain").notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    notes: text("notes"),
    twitter: text("twitter"),
    telegram: text("telegram"),
    status: text("status").notNull().default("pending"),
    submittedBy: text("submitted_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      statusIdx: index("wallet_submission_status_idx").on(table.status),
      chainIdx: index("wallet_submission_chain_idx").on(table.chain),
      walletIdx: index("wallet_submission_wallet_idx").on(table.walletAddress),
    };
  },
);

export const walletVouch = pgTable(
  "wallet_vouch",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => walletSubmission.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.submissionId] }),
    };
  },
);

export const walletAddress = pgTable("wallet_address", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  chainId: integer("chain_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Trade Feed ---

export const trade = pgTable(
  "trade",
  {
    id: text("id").primaryKey(), // ulid or uuid
    walletAddress: varchar("wallet_address", { length: 96 }).notNull(),
    chain: text("chain").notNull(), // "sol" | "bsc"
    type: text("type").notNull(), // "buy" | "sell"
    tokenAddress: varchar("token_address", { length: 96 }).notNull(),
    tokenSymbol: varchar("token_symbol", { length: 32 }),
    tokenName: varchar("token_name", { length: 120 }),
    tokenLogo: text("token_logo"),
    tokenLaunchpad: varchar("token_launchpad", { length: 60 }),
    amountUsd: doublePrecision("amount_usd"),
    amountToken: doublePrecision("amount_token"),
    priceUsd: doublePrecision("price_usd"),
    realizedProfit: doublePrecision("realized_profit"),
    realizedProfitPnl: doublePrecision("realized_profit_pnl"),
    fee: doublePrecision("fee"),
    txHash: varchar("tx_hash", { length: 128 }),
    source: text("source").notNull().default("gmgn"), // "gmgn" | "onchain"
    walletLabel: varchar("wallet_label", { length: 120 }),
    walletAvatar: text("wallet_avatar"),
    walletTags: text("wallet_tags"), // JSON array as string
    tradedAt: timestamp("traded_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      walletIdx: index("trade_wallet_idx").on(table.walletAddress),
      chainIdx: index("trade_chain_idx").on(table.chain),
      tradedAtIdx: index("trade_traded_at_idx").on(table.tradedAt),
      tokenIdx: index("trade_token_idx").on(table.tokenAddress),
      // Composite index for the main trades feed query
      feedIdx: index("trade_feed_idx").on(table.chain, table.walletAddress, table.type, table.tradedAt),
      // Composite index for trending query (tokens by time + chain)
      trendingIdx: index("trade_trending_idx").on(table.tradedAt, table.chain, table.tokenAddress),
      // Composite index for wallet trade history
      walletHistoryIdx: index("trade_wallet_history_idx").on(table.walletAddress, table.tradedAt),
    };
  },
);

export const feedback = pgTable("feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  type: text("type").notNull().default("feedback"), // "feedback" | "removal_request"
  message: text("message").notNull(),
  walletAddress: varchar("wallet_address", { length: 96 }),
  status: text("status").notNull().default("open"), // "open" | "resolved" | "dismissed"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const watchlist = pgTable(
  "watchlist",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 96 }).notNull(),
    chain: text("chain").notNull(),
    label: varchar("label", { length: 120 }),
    groupName: varchar("group_name", { length: 60 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.walletAddress] }),
      userIdx: index("watchlist_user_idx").on(table.userId),
    };
  },
);

// --- Leaderboard Cache ---
export const leaderboardCache = pgTable("leaderboard_cache", {
  key: varchar("key", { length: 255 }).primaryKey(), // e.g., "all_7d_kol"
  data: text("data").notNull(), // JSON blob of LeaderboardEntry[]
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

// --- Smart Money Tracker ---

export const smartMoneyActivity = pgTable(
  "smart_money_activity",
  {
    id: text("id").primaryKey(),
    walletAddress: varchar("wallet_address", { length: 96 }).notNull(),
    walletLabel: varchar("wallet_label", { length: 120 }),
    walletAvatar: text("wallet_avatar"),
    walletCategory: varchar("wallet_category", { length: 60 }), // 'kol', 'whale', 'sniper', 'smart_degen'
    chain: text("chain").notNull(), // 'sol', 'eth', 'bsc', 'base'
    txHash: varchar("tx_hash", { length: 128 }).notNull(),
    action: text("action").notNull(), // 'buy', 'sell', 'transfer'
    tokenAddress: varchar("token_address", { length: 96 }),
    tokenSymbol: varchar("token_symbol", { length: 32 }),
    tokenName: varchar("token_name", { length: 120 }),
    tokenLogo: text("token_logo"),
    amount: doublePrecision("amount"),
    usdValue: doublePrecision("usd_value"),
    priceUsd: doublePrecision("price_usd"),
    realizedPnl: doublePrecision("realized_pnl"),
    realizedPnlPercent: doublePrecision("realized_pnl_percent"),
    source: text("source").notNull().default("gmgn"), // 'gmgn', 'helius', 'birdeye', 'cielo'
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      walletIdx: index("sma_wallet_idx").on(table.walletAddress),
      chainIdx: index("sma_chain_idx").on(table.chain),
      timestampIdx: index("sma_timestamp_idx").on(table.timestamp),
      tokenIdx: index("sma_token_idx").on(table.tokenAddress),
      actionIdx: index("sma_action_idx").on(table.action),
      // Composite for feed queries
      feedIdx: index("sma_feed_idx").on(table.timestamp, table.chain, table.action),
      // Composite for token accumulation
      tokenAccumIdx: index("sma_token_accum_idx").on(table.tokenAddress, table.chain, table.timestamp),
    };
  },
);

export const smartMoneySignal = pgTable(
  "smart_money_signal",
  {
    id: text("id").primaryKey(),
    tokenAddress: varchar("token_address", { length: 96 }).notNull(),
    tokenSymbol: varchar("token_symbol", { length: 32 }),
    tokenName: varchar("token_name", { length: 120 }),
    tokenLogo: text("token_logo"),
    chain: text("chain").notNull(),
    signalType: text("signal_type").notNull(), // 'accumulation', 'distribution', 'new_position', 'exit'
    walletCount: integer("wallet_count").notNull().default(0),
    totalBuyUsd: doublePrecision("total_buy_usd").default(0),
    totalSellUsd: doublePrecision("total_sell_usd").default(0),
    netFlowUsd: doublePrecision("net_flow_usd").default(0),
    period: text("period").notNull(), // '1h', '24h', '7d'
    topWallets: text("top_wallets"), // JSON array of wallet addresses
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      tokenChainIdx: index("sms_token_chain_idx").on(table.tokenAddress, table.chain),
      signalTypeIdx: index("sms_signal_type_idx").on(table.signalType),
      periodIdx: index("sms_period_idx").on(table.period),
      createdAtIdx: index("sms_created_at_idx").on(table.createdAt),
      // For leaderboard queries
      netFlowIdx: index("sms_net_flow_idx").on(table.period, table.netFlowUsd),
    };
  },
);

export const smartMoneyAlert = pgTable(
  "smart_money_alert",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    alertType: text("alert_type").notNull(), // 'wallet_trade', 'token_accumulation', 'whale_move'
    // Filter conditions (JSON)
    conditions: text("conditions").notNull(), // JSON: { walletAddress?, minUsd?, tokenAddress?, chain? }
    // Notification channels
    notifyInApp: boolean("notify_in_app").notNull().default(true),
    notifyEmail: boolean("notify_email").notNull().default(false),
    notifyPush: boolean("notify_push").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      userIdx: index("smart_alert_user_idx").on(table.userId),
      activeIdx: index("smart_alert_active_idx").on(table.active),
    };
  },
);
