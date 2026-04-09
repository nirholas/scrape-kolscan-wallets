"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";



type Submission = {
  id: string;
  walletAddress: string;
  chain: "sol" | "bsc";
  label: string;
  notes: string | null;
  twitter: string | null;
  telegram: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export default function SubmitWalletPage() {
  const { data, isPending, refetch } = useSession();
  const [walletAddress, setWalletAddress] = useState("");
  const [chain, setChain] = useState<"sol" | "bsc">("sol");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [message, setMessage] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadMine() {
    const mineRes = await fetch("/api/submissions/mine", { cache: "no-store" });
    if (mineRes.ok) {
      const mineJson = await mineRes.json();
      setSubmissions(mineJson.submissions || []);
    }
  }

  useEffect(() => {
    if (data?.user) {
      loadMine();
    }
  }, [data?.user?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        chain,
        label,
        notes: notes || null,
        twitter: twitter || null,
        telegram: telegram || null,
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setMessage(json.error || "Submission failed");
      setLoading(false);
      return;
    }

    setMessage("Submitted. Community wallets are moderated.");
    setWalletAddress("");
    setLabel("");
    setNotes("");
    setTwitter("");
    setTelegram("");
    await refetch();
    await loadMine();
    setLoading(false);
  }

  if (isPending) {
    return (
      <main className="max-w-xl mx-auto px-6 py-14">
        <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-card">
          <p className="text-zinc-500 text-sm">Loading session...</p>
        </div>
      </main>
    );
  }

  if (!data?.user) {
    return (
      <main className="max-w-xl mx-auto px-6 py-14">
        <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-card space-y-4">
          <h1 className="text-2xl font-semibold text-white">Submit Wallet</h1>
          <p className="text-zinc-400 text-sm">You need an account to submit wallets to the crowdsourced list.</p>
          <a href="/auth" className="inline-flex px-3 py-2 rounded-lg bg-white text-black text-sm font-medium">Go to sign in</a>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-14 space-y-8">
      <section className="rounded-2xl border border-border bg-bg-card p-6 shadow-card">
        <h1 className="text-2xl font-semibold text-white">Submit Wallet</h1>
        <p className="text-zinc-500 text-sm mt-1">Submissions by users are pending approval unless submitted by admin.</p>

        <form onSubmit={submit} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="md:col-span-2 bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Wallet address"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            required
          />
          <select
            className="bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
            value={chain}
            onChange={(e) => setChain(e.target.value as "sol" | "bsc")}
          >
            <option value="sol">Solana</option>
            <option value="bsc">BSC</option>
          </select>
          <input
            className="bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
          <input
            className="bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Twitter URL (optional)"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
          />
          <input
            className="bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
            placeholder="Telegram URL (optional)"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
          />
          <textarea
            className="md:col-span-2 bg-black border border-border rounded-lg px-3 py-2 text-sm text-white min-h-[100px]"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button className="md:col-span-2 px-3 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-60" disabled={loading}>
            {loading ? "Submitting..." : "Submit wallet"}
          </button>
        </form>

        {message && <p className="text-sm text-zinc-400 mt-3">{message}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-bg-card p-6 shadow-card">
        <h2 className="text-lg font-semibold text-white">My Submissions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500">
              <tr className="border-b border-border">
                <th className="text-left py-2">Label</th>
                <th className="text-left py-2">Address</th>
                <th className="text-left py-2">Chain</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-2 text-zinc-200">{s.label}</td>
                  <td className="py-2 text-zinc-400 font-mono">{s.walletAddress}</td>
                  <td className="py-2 text-zinc-400 uppercase">{s.chain}</td>
                  <td className="py-2 text-zinc-300">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.length === 0 && <p className="text-zinc-500 text-sm py-3">No submissions yet.</p>}
        </div>
      </section>
    </main>
  );
}
