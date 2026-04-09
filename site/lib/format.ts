export function timeAgo(date: string | Date | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function shortAddr(addr: string): string {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

export function formatUsd(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

export function explorerUrl(chain: string, txHash: string): string {
  if (chain === "bsc") return `https://bscscan.com/tx/${txHash}`;
  return `https://solscan.io/tx/${txHash}`;
}
