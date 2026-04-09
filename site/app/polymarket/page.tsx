import { getPolymarketTraders, getPolymarketMarkets } from "@/lib/data";
import PolymarketLeaderboard from "./PolymarketLeaderboard";

export const revalidate = 3600;

export const metadata = {
  title: "Polymarket Leaderboard | KolQuest",
  description: "Top Polymarket prediction market traders by PnL, volume, and win rate",
};

export default async function PolymarketPage() {
  const [traders, markets] = await Promise.all([
    getPolymarketTraders(),
    getPolymarketMarkets(),
  ]);

  return (
    <PolymarketLeaderboard
      traders={traders}
      markets={markets}
    />
  );
}
