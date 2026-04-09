"use client";

import { Suspense, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import LeaderboardTable from "./components/LeaderboardTable";
import Filters from "./components/Filters";
import ShareButtons from "../components/ShareButtons";
import type { LeaderboardResponse, LeaderboardQuery } from "@/lib/types";

function EnhancedLeaderboardInner({
  initialData,
}: {
  initialData: LeaderboardResponse;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sort = (searchParams.get("sort") ?? "composite") as NonNullable<LeaderboardQuery["sort"]>;
  const order = (searchParams.get("order") ?? "desc") as "asc" | "desc";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "") params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleSort(field: NonNullable<LeaderboardQuery["sort"]>) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === field) {
      params.set("order", order === "desc" ? "asc" : "desc");
    } else {
      params.set("sort", field);
      params.set("order", "desc");
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handlePage(p: number) {
    setParam("page", String(p));
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            KOL Leaderboard
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Multi-source rankings from KolScan &amp; GMGN · sorted by composite score
          </p>
        </div>
        <ShareButtons title="KolQuest Leaderboard" />
      </div>

      {/* Filters */}
      <Filters
        total={initialData.pagination.total}
        lastUpdated={initialData.lastUpdated}
        sources={initialData.sources}
      />

      {/* Table */}
      <LeaderboardTable
        response={initialData}
        sort={sort}
        order={order}
        page={page}
        onSort={handleSort}
        onPage={handlePage}
      />
    </div>
  );
}

export default function EnhancedLeaderboardClient({
  initialData,
}: {
  initialData: LeaderboardResponse;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1400px] mx-auto px-6 py-10 space-y-6">
          <div className="h-8 w-64 bg-zinc-900 rounded animate-pulse" />
          <div className="h-10 w-full max-w-2xl bg-zinc-900 rounded animate-pulse" />
          <div className="h-96 bg-bg-card rounded border border-border animate-pulse" />
        </div>
      }
    >
      <EnhancedLeaderboardInner initialData={initialData} />
    </Suspense>
  );
}
