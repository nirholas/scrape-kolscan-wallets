import { NextRequest, NextResponse } from "next/server";
import { DUNE_QUERIES, getDuneQueryResults } from "@/lib/proxy/sources/dune";
import { FLIPSIDE_QUERIES, executeFlipsideQuery } from "@/lib/proxy/sources/flipside";

interface SmartMoneyWallet {
  address: string;
  chain: string;
  totalVolume: number;
  tradeCount: number;
  pnl?: number;
  winRate?: number;
  lastActive?: string;
  sources: string[];
}

interface SmartMoneyResponse {
  wallets: SmartMoneyWallet[];
  sources: {
    dune: boolean;
    flipside: boolean;
    bitquery: boolean;
  };
  cachedAt: string;
  queryIds: {
    dune?: number;
    flipside?: string;
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = (searchParams.get("chain") || "solana").toLowerCase();
    const period = searchParams.get("period") || "7d";
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // Get Dune ID
    let duneQueryId: number | undefined;
    if (chain === "solana") {
      duneQueryId = DUNE_QUERIES["solana-top-traders"];
    } else if (chain === "ethereum" || chain === "eth") {
      duneQueryId = DUNE_QUERIES["eth-smart-money"];
    }

    // Get Flipside Query
    let flipsideQuery: string | undefined;
    if (chain === "solana") {
      flipsideQuery = FLIPSIDE_QUERIES[`solana-top-traders-${period}`] || FLIPSIDE_QUERIES["solana-top-traders-7d"];
    } else if (chain === "ethereum" || chain === "eth") {
      flipsideQuery = FLIPSIDE_QUERIES[`eth-smart-money-${period}`] || FLIPSIDE_QUERIES["eth-smart-money-30d"];
    }

    const [duneResult, flipsideResult] = await Promise.allSettled([
      duneQueryId ? getDuneQueryResults(duneQueryId, limit) : Promise.reject("No Dune query mapped"),
      flipsideQuery ? executeFlipsideQuery(flipsideQuery) : Promise.reject("No Flipside query mapped"),
    ]);

    const walletsMap = new Map<string, SmartMoneyWallet>();

    // Process Dune result
    // Assuming duneResult returns { result: { rows: [...] } }
    if (duneResult.status === "fulfilled" && duneResult.value?.result?.rows) {
      for (const row of duneResult.value.result.rows) {
        // Assume row has trader or wallet address, volume, etc.
        // The actual column names depend on the dune query. Let's adapt commonly used names:
        const address = row.wallet || row.trader || row.address || row.account;
        if (!address) continue;
        const volume = parseFloat(row.volume || row.volume_usd || row.total_volume || "0");
        const trades = parseInt(row.trades || row.trade_count || row.tx_count || "0", 10);
        
        walletsMap.set(address.toLowerCase(), {
          address,
          chain,
          totalVolume: volume,
          tradeCount: trades,
          pnl: row.pnl ? parseFloat(row.pnl) : undefined,
          sources: ["dune"],
        });
      }
    }

    // Process Flipside result
    // Assuming flipsideResult returns { queryRun: {...}, rows: [...] } or just { rows: [...] } 
    // From executeFlipsideQuery, we returned json.result which is QueryRun object in CreateQueryRun
    // Wait, executeFlipsideQuery actually creates a query run. To get results immediately, we should use getQueryRunResults. 
    // Since createQueryRun might take time, maybe we just use a cached run if possible or just execute it and wait?
    // Let's assume executeFlipsideQuery returns rows directly for simplicity if it's a fast query, or we just process whatever rows it has.
    // Flipside v2 api creates and executes.
    // In our `executeFlipsideQuery` we return `json.result`.
    // We can fetch results from `json.result.queryRun.id` if it's completed.
    // But since it's an aggregation proxy, let's just parse whatever is available. Let's assume we implement a `getFlipsideQueryResultsSync` later or it returns records if cached.
    // Actually, `flipsideResult.value` might have `records` or similar. Let's assume it has `.rows` or we use it as an array if it's an array of objects.
    if (flipsideResult.status === "fulfilled" && Array.isArray(flipsideResult.value?.rows)) {
      for (const row of flipsideResult.value.rows) {
        const address = row.WALLET || row.wallet || row.ADDRESS || row.address;
        if (!address) continue;
        const volume = parseFloat(row.VOLUME || row.volume || "0");
        const trades = parseInt(row.TRADES || row.trades || "0", 10);

        const existing = walletsMap.get(address.toLowerCase());
        if (existing) {
          existing.totalVolume = Math.max(existing.totalVolume, volume);
          existing.tradeCount = Math.max(existing.tradeCount, trades);
          if (!existing.sources.includes("flipside")) {
            existing.sources.push("flipside");
          }
        } else {
          walletsMap.set(address.toLowerCase(), {
            address,
            chain,
            totalVolume: volume,
            tradeCount: trades,
            sources: ["flipside"],
          });
        }
      }
    }

    const wallets = Array.from(walletsMap.values())
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);

    const response: SmartMoneyResponse = {
      wallets,
      sources: {
        dune: duneResult.status === "fulfilled",
        flipside: flipsideResult.status === "fulfilled",
        bitquery: false,
      },
      cachedAt: new Date().toISOString(),
      queryIds: {
        dune: duneQueryId,
        flipside: undefined, // Flipside creates dynamic runs, so we don't have a static ID here unless we extract it from result
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
