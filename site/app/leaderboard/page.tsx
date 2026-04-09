import { Suspense } from "react";
import EnhancedLeaderboardClient from "./EnhancedLeaderboardClient";
import { getLeaderboard } from "@/lib/leaderboard-aggregator";
import type { LeaderboardChain, LeaderboardQuery } from "@/lib/types";

export const revalidate = 60;

export const metadata = {
  title: "Leaderboard | KolQuest",
  description:
    "Multi-source KOL wallet leaderboard — ranked by composite score across KolScan and GMGN",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  function sp(key: string): string | undefined {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  }

  const query: LeaderboardQuery = {
    chain: (sp("chain") ?? "all") as LeaderboardChain | "all",
    timeframe: (sp("timeframe") ?? "7d") as LeaderboardQuery["timeframe"],
    category: (sp("category") ?? "overall") as LeaderboardQuery["category"],
    sort: (sp("sort") ?? "composite") as LeaderboardQuery["sort"],
    order: (sp("order") ?? "desc") as "asc" | "desc",
    page: Math.max(1, Number(sp("page") ?? 1)),
    limit: 50,
    search: sp("search"),
    minPnl: sp("minPnl") ? Number(sp("minPnl")) : undefined,
    minWinRate: sp("minWinRate") ? Number(sp("minWinRate")) : undefined,
    activeInDays: sp("activeInDays") ? Number(sp("activeInDays")) : undefined,
    verifiedOnly: sp("verifiedOnly") === "true",
  };

  const data = await getLeaderboard(query);

  return (
    <Suspense>
      <EnhancedLeaderboardClient initialData={data} />
    </Suspense>
  );
}
