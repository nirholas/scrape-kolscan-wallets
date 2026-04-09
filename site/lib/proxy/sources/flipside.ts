export const FLIPSIDE_QUERIES: Record<string, string> = {
  "solana-top-traders-7d": `
    SELECT tx_from AS wallet, COUNT(*) AS trades, SUM(swap_to_amount_usd) AS volume
    FROM solana.defi.ez_dex_swaps
    WHERE block_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    GROUP BY 1 HAVING volume > 50000
    ORDER BY volume DESC LIMIT 500`,

  "eth-smart-money-30d": `
    SELECT from_address AS wallet, COUNT(*) AS trades, SUM(amount_usd) AS volume
    FROM ethereum.defi.ez_dex_swaps
    WHERE block_timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    GROUP BY 1 HAVING volume > 100000
    ORDER BY volume DESC LIMIT 500`,
};

function getHeaders() {
  const apiKey = process.env.FLIPSIDE_API_KEY;
  return {
    "x-api-key": apiKey || "",
    "Content-Type": "application/json",
  };
}

export async function executeFlipsideQuery(sql: string) {
  const res = await fetch("https://api-v2.flipsidecrypto.xyz/json-rpc", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "createQueryRun",
      params: [
        {
          resultTTLHours: 1,
          maxAgeMinutes: 15,
          sql: sql,
        },
      ],
      id: 1,
    }),
    next: { revalidate: 900 }, // 15m
  });
  if (!res.ok) throw new Error(`Flipside query error: ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export async function getFlipsideQueryResults(queryRunId: string) {
  const res = await fetch("https://api-v2.flipsidecrypto.xyz/json-rpc", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getQueryRunResults",
      params: [
        {
          queryRunId: queryRunId,
          format: "json",
          page: { number: 1, size: 1000 },
        },
      ],
      id: 1,
    }),
    next: { revalidate: 900 }, // 15m
  });
  if (!res.ok) throw new Error(`Flipside results error: ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
