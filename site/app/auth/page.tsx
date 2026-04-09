"use client";

import { useMemo, useState } from "react";
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";

export default function AuthPage() {
  const { data, isPending, refetch } = useSession();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const user = data?.user;
  const username = useMemo(() => user?.email?.split("@")[0] || "", [user?.email]);
  const isAdmin = Boolean((user as unknown as { role?: string } | undefined)?.role === "admin");

  async function bootstrapAdminRole() {
    try {
      await fetch("/api/admin/bootstrap-role", { method: "POST" });
      await refetch();
    } catch {
      // no-op
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (tab === "signin") {
        const result = await signIn.email({ email, password });
        if (result?.error) throw new Error(result.error.message || "Sign in failed");
        await bootstrapAdminRole();
        setMessage("Signed in");
      } else {
        const result = await signUp.email({ email, password, name });
        if (result?.error) throw new Error(result.error.message || "Sign up failed");
        await bootstrapAdminRole();
        setMessage("Account created");
      }
      setPassword("");
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    }

    setLoading(false);
  }

  async function onSignOut() {
    await signOut();
    await refetch();
    setMessage("Signed out");
  }

  async function onSocial(provider: "google" | "github") {
    setLoading(true);
    setMessage("");
    try {
      const result = await signIn.social({ provider, callbackURL: "/auth" });
      if (result?.error) throw new Error(result.error.message || `Sign in with ${provider} failed`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Social sign in failed");
    }
    setLoading(false);
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-14">
      <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-card space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Account</h1>

        {isPending ? (
          <p className="text-zinc-500 text-sm">Loading session...</p>
        ) : user ? (
          <div className="space-y-3">
            <p className="text-zinc-300">
              Signed in as <span className="text-white font-medium">{user.email}</span>
            </p>
            <div className="flex gap-2">
              <a href="/submit" className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium">
                Submit wallet
              </a>
              <a href="/community" className="px-3 py-2 rounded-lg border border-border text-zinc-300 text-sm">
                Community
              </a>
              {isAdmin && (
                <a href="/admin/submissions" className="px-3 py-2 rounded-lg border border-border text-zinc-300 text-sm">
                  Admin
                </a>
              )}
              <button onClick={onSignOut} className="px-3 py-2 rounded-lg border border-border text-zinc-300 text-sm">
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setTab("signin")}
                className={`px-3 py-1.5 rounded-lg border ${tab === "signin" ? "border-white text-white" : "border-border text-zinc-500"}`}
              >
                Sign in
              </button>
              <button
                onClick={() => setTab("signup")}
                className={`px-3 py-1.5 rounded-lg border ${tab === "signup" ? "border-white text-white" : "border-border text-zinc-500"}`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {tab === "signup" && (
                <input
                  className="w-full bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="Display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
              <input
                className="w-full bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="w-full bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                disabled={loading}
                className="w-full px-3 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Please wait..." : tab === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Or continue with</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSocial("google")}
                  className="px-3 py-2 rounded-lg border border-border text-zinc-300 text-sm hover:text-white hover:bg-bg-hover"
                >
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => onSocial("github")}
                  className="px-3 py-2 rounded-lg border border-border text-zinc-300 text-sm hover:text-white hover:bg-bg-hover"
                >
                  GitHub
                </button>
              </div>
            </div>
          </>
        )}

        {message && <p className="text-sm text-zinc-400">{message}</p>}
      </div>
    </main>
  );
}
