import { desc, eq, InferSelectModel } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { walletSubmission } from "@/drizzle/db/schema";

type WalletSubmission = InferSelectModel<typeof walletSubmission>;

export const metadata = {
  title: "Community Wallets",
  description: "Community-submitted wallets vetted by the KolQuest community — discover new alpha from crowd-sourced wallet intelligence.",
};

export default async function CommunityPage() {
  let submissions: WalletSubmission[] = [];
  try {
    submissions = await db
      .select()
      .from(walletSubmission)
      .where(eq(walletSubmission.status, "approved"))
      .orderBy(desc(walletSubmission.createdAt))
      .limit(500);
  } catch {
    // DB not available
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Community Wallets</h1>
          <p className="text-zinc-500 text-sm mt-1">Crowdsourced wallet list submitted by users and approved by moderators.</p>
        </div>
        <a href="/submit" className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium">Submit wallet</a>
      </div>

      <section className="rounded-2xl border border-border bg-bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500 bg-black/30">
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4">Label</th>
                <th className="text-left py-3 px-4">Wallet</th>
                <th className="text-left py-3 px-4">Chain</th>
                <th className="text-left py-3 px-4">Socials</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-bg-hover/40">
                  <td className="py-3 px-4 text-zinc-200">{s.label}</td>
                  <td className="py-3 px-4 text-zinc-400 font-mono">{s.walletAddress}</td>
                  <td className="py-3 px-4 text-zinc-400 uppercase">{s.chain}</td>
                  <td className="py-3 px-4 text-zinc-400">
                    <div className="flex gap-3">
                      {s.twitter && s.twitter.startsWith("https://") ? <a className="hover:text-accent" href={s.twitter} target="_blank" rel="noopener noreferrer">X</a> : <span>-</span>}
                      {s.telegram && s.telegram.startsWith("https://") ? <a className="hover:text-accent" href={s.telegram} target="_blank" rel="noopener noreferrer">TG</a> : <span>-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.length === 0 && (
            <div className="p-5 text-zinc-500 text-sm">No approved submissions yet.</div>
          )}
        </div>
      </section>
    </main>
  );
}
