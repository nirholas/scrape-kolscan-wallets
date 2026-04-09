/**
 * The Graph fetcher — free public subgraphs (no key needed for hosted service)
 * Docs: https://thegraph.com/docs/en/querying/querying-the-graph/
 *
 * Uses The Graph's decentralized network and hosted service.
 * Subgraphs queried:
 * - Uniswap V2 (Ethereum)
 * - Uniswap V3 (Ethereum)
 * - Uniswap V3 (Base, Arbitrum, Polygon)
 * - PancakeSwap V3 (BSC)
 * - Aave V3
 * - Compound V3
 * - Curve Finance
 * - Balancer
 *
 * Data fetched:
 * - Top pools by volume
 * - Top traders
 * - Token data
 * - Liquidity provider positions
 */

import { fetchJSON, saveArchive, log, sleep, env } from "../lib/utils.ts";

const SRC = "thegraph";

const SUBGRAPHS: {
  name: string;
  url: string;
  queries: { name: string; query: string }[];
}[] = [
  {
    name: "uniswap-v3-eth",
    url: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    queries: [
      {
        name: "top-pools-volume",
        query: `{
          pools(first: 100, orderBy: volumeUSD, orderDirection: desc) {
            id token0 { id symbol name } token1 { id symbol name }
            feeTier volumeUSD txCount liquidity
            token0Price token1Price
          }
        }`,
      },
      {
        name: "top-tokens",
        query: `{
          tokens(first: 100, orderBy: volumeUSD, orderDirection: desc) {
            id symbol name decimals volumeUSD totalValueLocked txCount
          }
        }`,
      },
      {
        name: "recent-swaps",
        query: `{
          swaps(first: 200, orderBy: timestamp, orderDirection: desc) {
            id timestamp sender recipient token0 { symbol } token1 { symbol }
            amount0 amount1 amountUSD
          }
        }`,
      },
    ],
  },
  {
    name: "uniswap-v2-eth",
    url: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
    queries: [
      {
        name: "top-pairs",
        query: `{
          pairs(first: 100, orderBy: volumeUSD, orderDirection: desc) {
            id token0 { id symbol } token1 { id symbol }
            volumeUSD txCount reserveUSD
          }
        }`,
      },
    ],
  },
  {
    name: "pancakeswap-v3-bsc",
    url: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
    queries: [
      {
        name: "top-pools",
        query: `{
          pools(first: 100, orderBy: volumeUSD, orderDirection: desc) {
            id token0 { id symbol } token1 { id symbol }
            feeTier volumeUSD txCount
          }
        }`,
      },
    ],
  },
  {
    name: "aave-v3-eth",
    url: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3",
    queries: [
      {
        name: "market-data",
        query: `{
          reserves(first: 50) {
            id underlyingAsset { id symbol decimals }
            totalLiquidity utilizationRate liquidityRate
            variableBorrowRate stableBorrowRate totalATokenSupply
          }
        }`,
      },
    ],
  },
  {
    name: "balancer-v2-eth",
    url: "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2",
    queries: [
      {
        name: "top-pools",
        query: `{
          pools(first: 50, orderBy: totalLiquidity, orderDirection: desc) {
            id name totalLiquidity totalSwapVolume totalSwapFee swapEnabled
            tokens { address symbol balance weight }
          }
        }`,
      },
    ],
  },
];

async function querySubgraph(url: string, query: string): Promise<any> {
  return fetchJSON(url, {
    method: "POST",
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
    source: SRC,
    delayMs: 300,
  });
}

export async function runTheGraph() {
  log(SRC, "Starting The Graph fetch...");

  for (const subgraph of SUBGRAPHS) {
    log(SRC, `Fetching subgraph: ${subgraph.name}`);

    for (const q of subgraph.queries) {
      const result = await querySubgraph(subgraph.url, q.query);
      if (result?.data) {
        saveArchive(SRC, `${subgraph.name}-${q.name}`, result.data);
        log(SRC, `Saved ${subgraph.name}/${q.name}`);
      } else if (result?.errors) {
        log(SRC, `GraphQL error for ${subgraph.name}/${q.name}: ${JSON.stringify(result.errors[0]?.message)}`);
      }
      await sleep(500);
    }

    await sleep(1000);
  }

  log(SRC, "The Graph fetch complete.");
}
