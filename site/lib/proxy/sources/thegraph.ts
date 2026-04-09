export const SUBGRAPHS: Record<string, string> = {
  "uniswap-v3": "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
  "uniswap-v2": "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
  "pancakeswap-v3": "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
  "aave-v3": "https://api.thegraph.com/subgraphs/name/aave/protocol-v3",
  "balancer-v2": "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2",
};

export const GRAPH_QUERIES: Record<string, string> = {
  "uniswap-v3-top-pools": `{
    pools(first: 100, orderBy: volumeUSD, orderDirection: desc) {
      id token0 { symbol } token1 { symbol } volumeUSD liquidity
    }
  }`,

  "uniswap-v3-recent-swaps": `{
    swaps(first: 100, orderBy: timestamp, orderDirection: desc) {
      id timestamp sender amountUSD token0 { symbol } token1 { symbol }
    }
  }`,
};

export async function executeGraphQuery(subgraph: string, query: string, variables?: any) {
  const url = SUBGRAPHS[subgraph];
  if (!url) throw new Error(`Unknown subgraph: ${subgraph}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 120 }, // The Graph: 2m
  });
  if (!res.ok) throw new Error(`The Graph error: ${res.statusText}`);
  return res.json();
}
