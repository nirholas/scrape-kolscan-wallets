"use client";

import { useState, useMemo } from "react";
import type { KolEntry } from "@/lib/types";
import { formatProfit } from "@/lib/format";

interface CalendarProps {
  entries: KolEntry[];
  walletAddress: string;
  walletName: string;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();
  return { startDayOfWeek, daysInMonth };
}

function profitColor(v: number) {
  return v > 0 ? "text-buy" : v < 0 ? "text-sell" : "text-zinc-600";
}

function profitBg(v: number) {
  if (v > 2) return "bg-buy/20 border-buy/30";
  if (v > 0) return "bg-buy/10 border-buy/20";
  if (v < -2) return "bg-sell/20 border-sell/30";
  if (v < 0) return "bg-sell/10 border-sell/20";
  return "bg-bg-card border-border";
}

type TimeframeView = 1 | 7 | 30;

export default function PnlCalendar({ entries, walletAddress }: CalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeView>(1);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const { startDayOfWeek, daysInMonth } = getMonthDays(year, month);

  // Map timeframe data
  const dailyEntry = entries.find((e) => e.timeframe === 1);
  const weeklyEntry = entries.find((e) => e.timeframe === 7);
  const monthlyEntry = entries.find((e) => e.timeframe === 30);

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();

  // Determine which days fall in each timeframe range
  const getDayData = (day: number) => {
    if (!isCurrentMonth) return null;
    const todayDate = today.getDate();

    // Today = 1d data
    if (day === todayDate && dailyEntry) {
      return { ...dailyEntry, label: "Daily" };
    }

    // Last 7 days (not today) = weekly data distributed
    if (day > todayDate - 7 && day < todayDate && weeklyEntry) {
      return {
        ...weeklyEntry,
        profit: weeklyEntry.profit / 7,
        wins: Math.round(weeklyEntry.wins / 7),
        losses: Math.round(weeklyEntry.losses / 7),
        label: "Weekly avg",
      };
    }

    // Last 30 days (not in weekly range) = monthly data distributed  
    if (day > todayDate - 30 && day <= todayDate - 7 && monthlyEntry) {
      return {
        ...monthlyEntry,
        profit: monthlyEntry.profit / 30,
        wins: Math.round(monthlyEntry.wins / 30),
        losses: Math.round(monthlyEntry.losses / 30),
        label: "Monthly avg",
      };
    }

    return null;
  };

  // Data for selected timeframe detail panel
  const selectedData = useMemo(() => {
    if (selectedTimeframe === 1) return dailyEntry || null;
    if (selectedTimeframe === 7) return weeklyEntry || null;
    return monthlyEntry || null;
  }, [selectedTimeframe, dailyEntry, weeklyEntry, monthlyEntry]);

  const timeframeLabel = (tf: number) =>
    tf === 1 ? "Daily" : tf === 7 ? "Weekly" : "Monthly";

  // Total stats
  const totalProfit = entries.reduce((s, e) => s + e.profit, 0);

  // Navigate months
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  // Detail for clicked day
  const clickedDayData = selectedDay ? getDayData(selectedDay) : null;

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="bg-bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        {/* Month Nav */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-bg-hover transition-colors"
          >
            &lt;
          </button>
          <h3 className="text-white font-semibold text-sm tracking-tight">
            {monthNames[month]} {year}
          </h3>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-bg-hover transition-colors"
          >
            &gt;
          </button>
        </div>

        {/* Total PnL bar */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className={`text-lg font-bold tabular-nums ${profitColor(totalProfit)}`}>
            {formatProfit(totalProfit)} SOL
          </span>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-500">
              Win Streak: <span className="text-white font-medium">
                {dailyEntry && dailyEntry.wins > 0 ? `${Math.min(dailyEntry.wins, 5)}d` : "0d"}
              </span>
            </span>
          </div>
        </div>

        {/* PnL sparkline */}
        <div className="px-5 py-2 border-b border-border">
          <div className="flex items-end gap-0.5 h-8">
            {entries.map((e, i) => {
              const maxProfit = Math.max(...entries.map((x) => Math.abs(x.profit)), 1);
              const height = Math.max((Math.abs(e.profit) / maxProfit) * 100, 8);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${e.profit >= 0 ? "bg-buy/60" : "bg-sell/60"}`}
                  style={{ height: `${height}%` }}
                  title={`${timeframeLabel(e.timeframe)}: ${formatProfit(e.profit)} SOL`}
                />
              );
            })}
          </div>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 px-5 pt-3 pb-1">
          {dayNames.map((d) => (
            <div key={d} className="text-center text-[11px] font-medium text-zinc-600 uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 px-5 pb-5 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: startDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dayData = getDayData(day);
            const isTodayCell = isToday(day);
            const isSelected = selectedDay === day;
            const isFuture = isCurrentMonth && day > today.getDate();

            return (
              <button
                key={day}
                onClick={() => dayData && setSelectedDay(isSelected ? null : day)}
                disabled={!dayData || isFuture}
                className={`
                  aspect-square rounded-lg border text-center flex flex-col items-center justify-center gap-0.5
                  transition-all duration-150 relative
                  ${isFuture ? "opacity-30 cursor-default border-transparent" : ""}
                  ${isSelected ? "ring-1 ring-accent border-accent/50" : ""}
                  ${isTodayCell ? "ring-1 ring-zinc-500" : ""}
                  ${dayData && !isFuture
                    ? `${profitBg(dayData.profit)} cursor-pointer hover:brightness-125`
                    : "bg-transparent border-border/30 cursor-default"
                  }
                `}
              >
                <span className={`text-xs tabular-nums ${isTodayCell ? "text-white font-bold" : dayData ? "text-zinc-300" : "text-zinc-600"}`}>
                  {day}
                </span>
                {dayData && !isFuture && (
                  <span className={`text-[9px] font-medium tabular-nums ${profitColor(dayData.profit)}`}>
                    {dayData.profit > 0 ? "+" : ""}{dayData.profit.toFixed(1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Detail Panel */}
      {clickedDayData && selectedDay && (
        <div className="bg-bg-card rounded-2xl border border-border shadow-card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-white font-semibold text-sm">
                {monthNames[month]} {selectedDay}, {year}
              </h4>
              <span className="text-zinc-500 text-xs">{clickedDayData.label} data</span>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-zinc-600 hover:text-white transition-colors text-lg"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-bg-elevated/50 rounded-xl p-3">
              <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">Profit</div>
              <div className={`text-sm font-bold tabular-nums ${profitColor(clickedDayData.profit)}`}>
                {formatProfit(clickedDayData.profit)} SOL
              </div>
            </div>
            <div className="bg-bg-elevated/50 rounded-xl p-3">
              <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">Wins</div>
              <div className="text-sm font-bold text-buy tabular-nums">{clickedDayData.wins}</div>
            </div>
            <div className="bg-bg-elevated/50 rounded-xl p-3">
              <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">Losses</div>
              <div className="text-sm font-bold text-sell tabular-nums">{clickedDayData.losses}</div>
            </div>
            <div className="bg-bg-elevated/50 rounded-xl p-3">
              <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">Win Rate</div>
              {(() => {
                const total = clickedDayData.wins + clickedDayData.losses;
                const wr = total > 0 ? ((clickedDayData.wins / total) * 100).toFixed(1) : "N/A";
                return (
                  <div className={`text-sm font-bold tabular-nums ${wr !== "N/A" && parseFloat(wr) >= 50 ? "text-buy" : wr !== "N/A" ? "text-sell" : "text-zinc-600"}`}>
                    {wr === "N/A" ? "N/A" : `${wr}%`}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-4 flex gap-2">
            <a
              href={`https://gmgn.ai/sol/address/${walletAddress}?ref=nichxbt`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-yellow-400 bg-bg-elevated/50 border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              View on GMGN →
            </a>
            <a
              href={`https://trade.padre.gg/rk/nich?wallet=${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-purple-400 bg-bg-elevated/50 border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              Copy Trade →
            </a>
            <a
              href={`https://solscan.io/account/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-blue-400 bg-bg-elevated/50 border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              Solscan →
            </a>
          </div>
        </div>
      )}

      {/* Timeframe Detail Tables */}
      <div className="bg-bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        {/* Timeframe tabs */}
        <div className="flex border-b border-border">
          {([1, 7, 30] as TimeframeView[]).map((tf) => {
            const entry = entries.find((e) => e.timeframe === tf);
            return (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  selectedTimeframe === tf
                    ? "text-white border-b-2 border-buy bg-bg-hover/30"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {timeframeLabel(tf)}
                {entry && (
                  <span className={`ml-2 text-xs tabular-nums ${profitColor(entry.profit)}`}>
                    {formatProfit(entry.profit)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected timeframe detail */}
        {selectedData ? (
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {[
                { label: "Profit", value: `${formatProfit(selectedData.profit)} SOL`, color: profitColor(selectedData.profit), bold: true },
                { label: "Wins", value: selectedData.wins.toString(), color: "text-buy" },
                { label: "Losses", value: selectedData.losses.toString(), color: "text-sell" },
                { label: "Total Trades", value: (selectedData.wins + selectedData.losses).toString(), color: "text-white" },
                {
                  label: "Win Rate",
                  value: (selectedData.wins + selectedData.losses) > 0
                    ? `${((selectedData.wins / (selectedData.wins + selectedData.losses)) * 100).toFixed(1)}%`
                    : "N/A",
                  color: (selectedData.wins + selectedData.losses) > 0 && (selectedData.wins / (selectedData.wins + selectedData.losses)) >= 0.5
                    ? "text-buy" : "text-sell",
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-bg-elevated/50 rounded-xl p-3">
                  <div className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className={`text-sm tabular-nums font-bold ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Win/Loss breakdown bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                <span>Win/Loss Distribution</span>
                <span className="tabular-nums">
                  <span className="text-buy">{selectedData.wins}W</span>
                  {" / "}
                  <span className="text-sell">{selectedData.losses}L</span>
                </span>
              </div>
              <div className="h-2 bg-bg-elevated rounded-full overflow-hidden flex">
                {(() => {
                  const total = selectedData.wins + selectedData.losses;
                  const winPct = total > 0 ? (selectedData.wins / total) * 100 : 50;
                  return (
                    <>
                      <div className="bg-buy h-full rounded-l-full transition-all" style={{ width: `${winPct}%` }} />
                      <div className="bg-sell h-full rounded-r-full transition-all" style={{ width: `${100 - winPct}%` }} />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Action links */}
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://kolscan.io/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-buy bg-bg-elevated/50 border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                View Trades on KolScan →
              </a>
              <a
                href={`https://gmgn.ai/sol/address/${walletAddress}?ref=nichxbt`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-yellow-400 bg-bg-elevated/50 border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                Track on GMGN →
              </a>
              <a
                href={`https://trade.padre.gg/rk/nich?wallet=${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-purple-400 bg-bg-elevated/50 border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                Copy Trade on Padre →
              </a>
            </div>
          </div>
        ) : (
          <div className="p-5 text-center text-zinc-600 text-sm">
            No data available for this timeframe
          </div>
        )}
      </div>
    </div>
  );
}
