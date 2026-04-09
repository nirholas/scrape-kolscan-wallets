"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, signOut, useSession, authClient } from "@/lib/auth-client";

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="max-w-xl mx-auto px-6 py-14">
        <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-card">
          <p className="text-zinc-500 text-sm">Loading...</p>
        </div>
      </main>
    }>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const { data, isPending, refetch } = useSession();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/submit";
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const user = data?.user;
  const displayName = useMemo(() => {
    const u = user as Record<string, unknown> | undefined;
    return (u?.username as string) || (u?.name as string) || "";
  }, [user]);
  const isAdmin = Boolean((user as unknown as { role?: string } | undefined)?.role === "admin");

  async function tryBootstrapAdmin() {
    try {
      const res = await fetch("/api/admin/bootstrap-role", { method: "POST" });
      if (res.ok) await refetch();
    } catch {
      // not admin — ignore
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (tab === "signin") {
        const result = await signIn.username({ username, password });
        if (result?.error) throw new Error(result.error.message || "Sign in failed");
        await tryBootstrapAdmin();
        setMessage("Signed in — redirecting...");
        window.location.href = redirectTo;
        return;
      } else {
        const result = await signUp.email({
          email: `${username}@wallet.local`,
          password,
          name: username,
          username,
        } as Parameters<typeof signUp.email>[0]);
        if (result?.error) throw new Error(result.error.message || "Sign up failed");
        await tryBootstrapAdmin();
        setMessage("Account created — redirecting...");
        window.location.href = redirectTo;
        return;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    }

    setLoading(false);
  }

  async function onWalletLogin() {
    setLoading(true);
    setMessage("");

    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean } }).ethereum;
      if (!ethereum) {
        throw new Error("No Ethereum wallet detected. Install MetaMask.");
      }

      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.[0]) throw new Error("No account selected");
      const walletAddress = accounts[0];

      const nonceRes = await authClient.$fetch("/siwe/nonce", {
        method: "POST",
        body: { walletAddress, chainId: 1 },
      });
      const nonceData = nonceRes.data as { nonce?: string } | null;
      if (!nonceData?.nonce) throw new Error("Failed to get nonce");

      const domain = window.location.host;
      const uri = window.location.origin;
      const nonce = nonceData.nonce;
      const issuedAt = new Date().toISOString();
      const message = [
        `${domain} wants you to sign in with your Ethereum account:`,
        walletAddress,
        "",
        "Sign in to KolQuest",
        "",
        `URI: ${uri}`,
        `Version: 1`,
        `Chain ID: 1`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
      ].join("\n");

      const signature = (await ethereum.request({
        method: "personal_sign",
        params: [message, walletAddress],
      })) as string;

      const verifyRes = await authClient.$fetch("/siwe/verify", {
        method: "POST",
        body: { message, signature, walletAddress, chainId: 1 },
      });

      if (!verifyRes.data?.success) throw new Error("Wallet verification failed");

      await tryBootstrapAdmin();
      setMessage("Wallet connected — redirecting...");
      window.location.href = redirectTo;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet login failed");
      setLoading(false);
    }
  }

  async function onPhantomLogin() {
    setLoading(true);
    setMessage("");

    try {
      const phantom = (window as unknown as { phantom?: { solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string; toBytes: () => Uint8Array } }>; signMessage: (msg: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }> } } }).phantom;
      const solana = phantom?.solana;
      if (!solana?.isPhantom) {
        throw new Error("Phantom wallet not found. Install Phantom.");
      }

      const resp = await solana.connect();
      const walletAddress = resp.publicKey.toString();

      const nonceRes = await authClient.$fetch("/solana/nonce", {
        method: "POST",
        body: { walletAddress },
      });
      if (!nonceRes.data?.nonce) throw new Error("Failed to get nonce");

      const message = `Sign in to KolQuest\n\nWallet: ${walletAddress}\nNonce: ${nonceRes.data.nonce}`;
      const encodedMessage = new TextEncoder().encode(message);
      const { signature } = await solana.signMessage(encodedMessage, "utf8");

      // Send signature as base64
      const signatureBase64 = btoa(String.fromCharCode(...signature));

      const verifyRes = await authClient.$fetch("/solana/verify", {
        method: "POST",
        body: { message, signature: signatureBase64, walletAddress },
      });

      if (!verifyRes.data?.success) throw new Error("Wallet verification failed");

      await tryBootstrapAdmin();
      setMessage("Phantom connected — redirecting...");
      window.location.href = redirectTo;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Phantom login failed");
      setLoading(false);
    }
  }

  async function onSignOut() {
    await signOut();
    await refetch();
    setMessage("Signed out");
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
              Signed in as <span className="text-white font-medium">{displayName}</span>
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
              <input
                className="w-full bg-black border border-border rounded-lg px-3 py-2 text-sm text-white"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]{3,20}"
                title="3-20 alphanumeric characters or underscores"
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
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-zinc-500">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={onWalletLogin}
                disabled={loading}
                className="w-full px-3 py-2 rounded-lg border border-border text-zinc-300 text-sm hover:text-white hover:bg-bg-hover disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M32.96 1L19.64 10.89l2.46-5.81L32.96 1z" fill="#E17726"/>
                  <path d="M2.04 1l13.17 9.98-2.33-5.9L2.04 1zM28.23 23.53l-3.54 5.42 7.58 2.08 2.17-7.38-6.21-.12zM.58 23.65l2.16 7.38 7.57-2.08-3.53-5.42-6.2.12z" fill="#E27625"/>
                  <path d="M9.92 14.45l-2.12 3.2 7.55.34-.26-8.12-5.17 4.58zM25.08 14.45l-5.24-4.67-.17 8.21 7.53-.34-2.12-3.2zM10.31 28.95l4.55-2.2-3.93-3.07-.62 5.27zM20.14 26.75l4.54 2.2-.61-5.27-3.93 3.07z" fill="#E27625"/>
                </svg>
                Connect with MetaMask
              </button>
              <button
                type="button"
                onClick={onPhantomLogin}
                disabled={loading}
                className="w-full px-3 py-2 rounded-lg border border-border text-zinc-300 text-sm hover:text-white hover:bg-bg-hover disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="128" height="128" rx="26" fill="#AB9FF2"/>
                  <path d="M110.584 64.914H99.142c0-24.503-19.882-44.385-44.385-44.385-24.083 0-43.702 19.218-44.36 43.137-.68 24.728 19.675 45.635 44.404 45.635h2.627c22.86 0 45.262-17.718 52.568-39.293.798-2.358-1.08-4.813-3.544-4.813h-.106c-1.58 0-3.003.942-3.598 2.426-6.168 15.384-22.09 28.32-38.788 28.32h-2.627c-17.27 0-31.62-13.36-32.335-30.62-.74-17.886 13.6-32.84 31.43-32.84 17.413 0 31.546 14.132 31.546 31.546v1.508c0 2.448 1.984 4.432 4.432 4.432h14.78c2.243 0 4.06-1.818 4.06-4.06v-1.88c-.001-.162-.05-.337-.161-.513zM43.396 67.122a5.59 5.59 0 01-5.59 5.59 5.59 5.59 0 01-5.59-5.59 5.59 5.59 0 015.59-5.59 5.59 5.59 0 015.59 5.59zm25.336 0a5.59 5.59 0 01-5.59 5.59 5.59 5.59 0 01-5.59-5.59 5.59 5.59 0 015.59-5.59 5.59 5.59 0 015.59 5.59z" fill="#FFFDF8"/>
                </svg>
                Connect with Phantom
              </button>
            </div>
          </>
        )}

        {message && <p className="text-sm text-zinc-400">{message}</p>}
      </div>
    </main>
  );
}
