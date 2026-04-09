import { NextRequest, NextResponse } from "next/server";
import { moralisProxy } from "@/lib/proxy/sources/moralis";
import { debankProxy } from "@/lib/proxy/sources/debank";
import { alchemyProxy } from "@/lib/proxy/sources/alchemy";
import { etherscanProxy } from "@/lib/proxy/sources/etherscan";
import { covalentProxy } from "@/lib/proxy/sources/covalent";
import {
  getCacheHeaders,
  CACHE_TTL,
  CACHE_STALE,
  MORALIS_CHAIN_NAMES,
  COVALENT_CHAIN_NAMES,
  CHAIN_IDS,
  type UnifiedEvmWallet,
} from "@/lib/proxy/types";

// GET /api/proxy/evm/wallet/[address]?chains=eth,bsc,polygon
export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;
  const chainsParam = request.nextUrl.searchParams.get("chains") || "eth";
  const chains = chainsParam.split(",").map((c) => c.trim()).filter(Boolean);

  const sources = {
    moralis: false,
    debank: false,
    alchemy: false,
    etherscan: false,
    covalent: false,
  };

  const balanceByChain: UnifiedEvmWallet["balanceByChain"] = {};
  let netWorth = 0;
  let profitability = { realized: 0, unrealized: 0 };
  let defiPositions: UnifiedEvmWallet["defiPositions"] = [];

  // Fetch from DeBank (cross-chain in one call — most efficient)
  const debankResults = await Promise.allSettled([
    debankProxy.getWalletBalance(address.toLowerCase()),
    debankProxy.getWalletTokens(address.toLowerCase()),
    debankProxy.getWalletProtocols(address.toLowerCase()),
  ]);

  if (debankResults[0].status === "fulfilled") {
    sources.debank = true;
    const totalBalanceData = debankResults[0].value as { total_usd_value?: number };
    netWorth = totalBalanceData?.total_usd_value ?? 0;
  }

  if (debankResults[2].status === "fulfilled" && Array.isArray(debankResults[2].value)) {
    sources.debank = true;
    defiPositions = (debankResults[2].value as any[]).map((p: any) => ({
      protocol: p.name ?? p.id ?? "Unknown",
      protocolLogo: p.logo_url,
      chain: p.chain ?? "unknown",
      type: p.portfolio_item_list?.[0]?.name ?? "Position",
      tvl: p.portfolio_item_list?.reduce((sum: number, i: any) => sum + (i.stats?.net_usd_value ?? 0), 0) ?? 0,
      tokens: (p.portfolio_item_list?.[0]?.detail?.supply_token_list ?? []).map((t: any) => ({
        symbol: t.symbol,
        amount: String(t.amount),
        usdValue: t.price * t.amount,
      })),
    }));
  }

  // Per-chain data from Moralis and Alchemy in parallel
  const chainFetches = chains.map(async (chain) => {
    const moralisChain = MORALIS_CHAIN_NAMES[chain] || chain;
    const covalentChain = COVALENT_CHAIN_NAMES[chain] || `${chain}-mainnet`;
    const chainId = CHAIN_IDS[chain] ?? 1;

    const [
      moralisNetWorthResult,
      moralisTokensResult,
      alchemyBalancesResult,
      alchemyNftsResult,
      etherscanBalResult,
    ] = await Promise.allSettled([
      moralisProxy.getWalletNetWorth(address, moralisChain),
      moralisProxy.getWalletTokens(address, moralisChain),
      alchemyProxy.getWalletBalances(address, chain).catch(() => null),
      alchemyProxy.getWalletNfts(address, chain).catch(() => null),
      etherscanProxy.getAccountBalance(address, chainId),
    ]);

    let nativeBalance = "0";
    let nativeUsd = 0;
    let tokens: any[] = [];
    let nftCount = 0;
    let defiProtocols = 0;
    let defiTotalValue = 0;

    if (moralisNetWorthResult.status === "fulfilled") {
      sources.moralis = true;
      const nw = moralisNetWorthResult.value as any;
      const chainData = Array.isArray(nw?.chains) 
        ? nw.chains.find((c: any) => c.chain === moralisChain)
        : null;
      if (chainData) {
        nativeUsd = parseFloat(chainData.native_balance_usd ?? "0");
        defiTotalValue = parseFloat(chainData.defi_usd_value ?? "0");
        defiProtocols = chainData.defi_protocols ?? 0;
      }
    }

    if (moralisTokensResult.status === "fulfilled") {
      sources.moralis = true;
      const tokensData = moralisTokensResult.value as any;
      tokens = (tokensData?.result ?? []).map((t: any) => ({
        address: t.token_address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        balance: t.balance,
        balanceFormatted: t.balance_formatted,
        usdValue: parseFloat(t.usd_value ?? "0"),
        price: parseFloat(t.usd_price ?? "0"),
        logo: t.logo,
        verified: t.verified_contract,
      }));
    }

    if (alchemyNftsResult.status === "fulfilled" && alchemyNftsResult.value) {
      sources.alchemy = true;
      const nftsData = alchemyNftsResult.value as any;
      nftCount = nftsData?.totalCount ?? 0;
    }

    if (etherscanBalResult.status === "fulfilled") {
      sources.etherscan = true;
      const balData = etherscanBalResult.value as any;
      nativeBalance = balData?.result ?? "0";
    }

    balanceByChain[chain] = {
      native: { balance: nativeBalance, usd: nativeUsd },
      tokens,
      nfts: nftCount,
      defi: { protocols: defiProtocols, totalValue: defiTotalValue },
    };
  });

  await Promise.allSettled(chainFetches);

  // Moralis net worth and profitability for primary chain
  const primaryChain = chains[0] || "eth";
  const moralisNetWorthFull = await moralisProxy.getWalletNetWorth(address, MORALIS_CHAIN_NAMES[primaryChain] || primaryChain).catch(() => null);
  if (moralisNetWorthFull) {
    sources.moralis = true;
    const nwData = moralisNetWorthFull as any;
    if (typeof nwData?.total_networth_usd === "string") {
      netWorth = Math.max(netWorth, parseFloat(nwData.total_networth_usd));
    }
  }

  const totalBalance = Object.values(balanceByChain).reduce((sum, c) => {
    const tokenUsd = c.tokens.reduce((s, t) => s + (t.usdValue ?? 0), 0);
    return sum + c.native.usd + tokenUsd + c.defi.totalValue;
  }, 0);

  const unified: UnifiedEvmWallet = {
    address,
    chains,
    totalBalance,
    balanceByChain,
    defiPositions,
    netWorth,
    profitability,
    sources,
    timestamp: Date.now(),
  };

  return NextResponse.json(unified, {
    headers: getCacheHeaders(CACHE_TTL.walletBalances, CACHE_STALE.walletBalances),
  });
}
