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
    };
  },
);

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
