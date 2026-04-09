import { desc, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { trade, walletSubmission, walletVouch } from "@/drizzle/db/schema";
import { getAllSolanaWallets, getBscWallets, getXProfile, getXProfiles, getSolGmgnData, getBscGmgnData } from "@/lib/data";
import type { UnifiedWallet, GmgnWallet } from "@/lib/types";

export type WalletChain = "sol" | "bsc" | "evm" | "unknown";

export interface WalletDetailResult {
  address: string;
  chain: WalletChain;
  isValidAddress: boolean;
  hasTrackedData: boolean;
  wallet: UnifiedWallet | null;
  gmgnWallet: GmgnWallet | null;
  xProfile: {
    username: string;
    name: string | null;
    bio: string | null;
    avatar: string | null;
    header: string | null;
    followers: number;
    following: number;
    tweets: number;
    likes: number;
    media: number;
    location: string | null;
    website: string | null;
    verified: boolean;
    joinDate: string | null;
  } | null;
  tradeStats: {
    totalTrades: number;
    totalBuys: number;
    totalSells: number;
    totalBuyUsd: number;
    totalSellUsd: number;
    totalRealizedProfit: number;
    firstTrade: string | null;
    lastTrade: string | null;
    uniqueTokens: number;
  };
  recentTrades: Array<{
    id: string;
    chain: string;
    type: string;
    tokenAddress: string;
    tokenSymbol: string | null;
    tokenName: string | null;
    amountUsd: number | null;
    priceUsd: number | null;
    realizedProfit: number | null;
    txHash: string | null;
    tradedAt: string;
  }>;
  topTokens: Array<{
    tokenAddress: string;
    tokenSymbol: string | null;
    tokenName: string | null;
    chain: string;
    tokenLaunchpad: string | null;
    totalVolume: number;
    trades: number;
    realizedProfit: number;
  }>;
  community: {
    id: string;
    label: string;
    notes: string | null;
    twitter: string | null;
    telegram: string | null;
    status: string;
    vouches: number;
    chain: string;
    createdAt: string;
  } | null;
}

const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function inferChainFromAddress(address: string): WalletChain {
  if (SOL_ADDRESS_RE.test(address)) return "sol";
  if (EVM_ADDRESS_RE.test(address)) return "evm";
  return "unknown";
}

function normalizeAddress(address: string): string {
  return EVM_ADDRESS_RE.test(address) ? address.toLowerCase() : address;
}

function buildTradeWhere(address: string) {
  return sql`lower(${trade.walletAddress}) = lower(${address})`;
}

function buildSubmissionWhere(address: string) {
  return sql`lower(${walletSubmission.walletAddress}) = lower(${address})`;
}

export async function getWalletDetail(addressRaw: string): Promise<WalletDetailResult> {
  const address = normalizeAddress(addressRaw.trim());
  const inferredChain = inferChainFromAddress(address);

  const [sol, bsc, xProfiles, solGmgn, bscGmgn] = await Promise.all([
    getAllSolanaWallets(),
    getBscWallets(),
    getXProfiles(),
    getSolGmgnData(),
    getBscGmgnData(),
  ]);

  const wallet = [...sol, ...bsc].find(
    (w) => w.wallet_address.toLowerCase() === address.toLowerCase(),
  ) || null;

  const gmgnWallet = [...solGmgn, ...bscGmgn].find(
    (w) => w.wallet_address.toLowerCase() === address.toLowerCase(),
  ) || null;

  const tradeWhere = buildTradeWhere(address);
  const submissionWhere = buildSubmissionWhere(address);

  const [tradeStatsRow] = await db
    .select({
      totalTrades: sql<number>`count(*)`,
      totalBuys: sql<number>`count(*) filter (where ${trade.type} = 'buy')`,
      totalSells: sql<number>`count(*) filter (where ${trade.type} = 'sell')`,
      totalBuyUsd: sql<number>`coalesce(sum(${trade.amountUsd}) filter (where ${trade.type} = 'buy'), 0)`,
      totalSellUsd: sql<number>`coalesce(sum(${trade.amountUsd}) filter (where ${trade.type} = 'sell'), 0)`,
      totalRealizedProfit: sql<number>`coalesce(sum(${trade.realizedProfit}), 0)`,
      firstTrade: sql<string | null>`min(${trade.tradedAt})`,
      lastTrade: sql<string | null>`max(${trade.tradedAt})`,
      uniqueTokens: sql<number>`count(distinct ${trade.tokenAddress})`,
    })
    .from(trade)
    .where(tradeWhere);

  const [recentTradesRows, topTokensRows, submission] = await Promise.all([
    db
      .select()
      .from(trade)
      .where(tradeWhere)
      .orderBy(desc(trade.tradedAt))
      .limit(20),
    db
      .select({
        tokenAddress: trade.tokenAddress,
        tokenSymbol: trade.tokenSymbol,
        tokenName: trade.tokenName,
        chain: trade.chain,
        totalVolume: sql<number>`coalesce(sum(${trade.amountUsd}), 0)`,
        trades: sql<number>`count(*)`,
        realizedProfit: sql<number>`coalesce(sum(${trade.realizedProfit}), 0)`,
      })
      .from(trade)
      .where(tradeWhere)
      .groupBy(trade.tokenAddress, trade.tokenSymbol, trade.tokenName, trade.chain)
      .orderBy(sql`sum(${trade.amountUsd}) desc`)
      .limit(10),
    db
      .select()
      .from(walletSubmission)
      .where(submissionWhere)
      .limit(1)
      .then((rows) => rows[0] || null),
  ]);

  let vouchCount = 0;
  if (submission) {
    const [vouchRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(walletVouch)
      .where(sql`${walletVouch.submissionId} = ${submission.id}`);
    vouchCount = Number(vouchRow?.count || 0);
  }

  const xProfileSource = wallet?.twitter ? getXProfile(xProfiles, wallet.twitter) : null;

  const tradeStats = {
    totalTrades: Number(tradeStatsRow?.totalTrades || 0),
    totalBuys: Number(tradeStatsRow?.totalBuys || 0),
    totalSells: Number(tradeStatsRow?.totalSells || 0),
    totalBuyUsd: Number(tradeStatsRow?.totalBuyUsd || 0),
    totalSellUsd: Number(tradeStatsRow?.totalSellUsd || 0),
    totalRealizedProfit: Number(tradeStatsRow?.totalRealizedProfit || 0),
    firstTrade: tradeStatsRow?.firstTrade || null,
    lastTrade: tradeStatsRow?.lastTrade || null,
    uniqueTokens: Number(tradeStatsRow?.uniqueTokens || 0),
  };

  const chain: WalletChain =
    wallet?.chain ||
    (recentTradesRows[0]?.chain as WalletChain | undefined) ||
    (submission?.chain as WalletChain | undefined) ||
    inferredChain;

  const hasTrackedData = Boolean(wallet) || tradeStats.totalTrades > 0 || Boolean(submission);

  return {
    address,
    chain,
    isValidAddress: inferredChain !== "unknown",
    hasTrackedData,
    wallet,
    gmgnWallet: gmgnWallet ?? null,
    xProfile: xProfileSource
      ? {
          username: xProfileSource.username,
          name: xProfileSource.name,
          bio: xProfileSource.bio,
          avatar: xProfileSource.avatar,
          header: xProfileSource.header,
          followers: xProfileSource.followers,
          following: xProfileSource.following,
          tweets: xProfileSource.tweets,
          likes: xProfileSource.likes,
          media: xProfileSource.media,
          location: xProfileSource.location,
          website: xProfileSource.website,
          verified: xProfileSource.verified,
          joinDate: xProfileSource.joinDate,
        }
      : null,
    tradeStats,
    recentTrades: recentTradesRows.map((t) => ({
      id: t.id,
      chain: t.chain,
      type: t.type,
      tokenAddress: t.tokenAddress,
      tokenSymbol: t.tokenSymbol,
      tokenName: t.tokenName,
      amountUsd: t.amountUsd,
      priceUsd: t.priceUsd,
      realizedProfit: t.realizedProfit,
      txHash: t.txHash,
      tradedAt: t.tradedAt.toISOString(),
    })),
    topTokens: topTokensRows.map((t) => ({
      tokenAddress: t.tokenAddress,
      tokenSymbol: t.tokenSymbol,
      tokenName: t.tokenName,
      chain: t.chain,
      totalVolume: Number(t.totalVolume),
      trades: Number(t.trades),
      realizedProfit: Number(t.realizedProfit),
    })),
    community: submission
      ? {
          id: submission.id,
          label: submission.label,
          notes: submission.notes,
          twitter: submission.twitter,
          telegram: submission.telegram,
          status: submission.status,
          vouches: vouchCount,
          chain: submission.chain,
          createdAt: submission.createdAt.toISOString(),
        }
      : null,
  };
}
