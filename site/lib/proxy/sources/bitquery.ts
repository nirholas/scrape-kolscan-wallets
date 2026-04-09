export const BITQUERY_QUERIES: Record<string, string> = {
  "solana-top-dex-traders": `
    query($since: ISO8601DateTime!) {
      Solana {
        DEXTradeByTokens(
          where: {Block: {Time: {since: $since}}}
          orderBy: {descendingByField: "volume_usd"}
          limit: {count: 100}
        ) {
          Trade { Account { Address } }
          volume_usd: sum(of: Trade__AmountInUSD)
          trades: count
        }
      }
    }`,

  "solana-whale-transfers": `
    query {
      Solana {
        Transfers(
          where: {Transfer: {AmountInUSD: {gt: "10000"}}}
          limit: {count: 100}
        ) {
          Transfer { Amount AmountInUSD Sender Receiver }
          Block { Time }
        }
      }
    }`,
};

export async function executeBitquery(query: string, variables?: any) {
  const apiKey = process.env.BITQUERY_API_KEY;
  const res = await fetch("https://graphql.bitquery.io", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 }, // Bitquery: 5m
  });
  if (!res.ok) throw new Error(`Bitquery error: ${res.statusText}`);
  return res.json();
}
