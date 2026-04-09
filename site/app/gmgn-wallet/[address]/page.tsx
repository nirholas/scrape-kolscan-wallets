import { getSolGmgnData, getBscGmgnData, getXProfiles, getXProfile, getData } from "@/lib/data";
import GmgnDashboard from "@/app/components/GmgnDashboard";
import Link from "next/link";

export async function generateStaticParams() {
  const [sol, bsc] = await Promise.all([getSolGmgnData(), getBscGmgnData()]);
  return [...sol, ...bsc].map((w) => ({ address: w.wallet_address }));
}

export async function generateMetadata({ params }: { params: { address: string } }) {
  const [sol, bsc] = await Promise.all([getSolGmgnData(), getBscGmgnData()]);
  const w = [...sol, ...bsc].find((e) => e.wallet_address === params.address);
  const name = w?.name || params.address.slice(0, 8);
  const title = `${name} Wallet`;
  const description = `GMGN smart money profile for ${name} — realized profit, win rate, and token trades.`;
  return {
    title,
    description,
    openGraph: { title: `${title} | KolQuest`, description },
  };
}

export default async function GmgnWalletPage({ params }: { params: { address: string } }) {
  const [sol, bsc, xProfiles, kolscanData] = await Promise.all([
    getSolGmgnData(),
    getBscGmgnData(),
    getXProfiles(),
    getData(),
  ]);

  const wallet = [...sol, ...bsc].find((w) => w.wallet_address === params.address);

  if (!wallet) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-20 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-2">Wallet Not Found</h1>
        <p className="text-zinc-500">No GMGN data found for this address.</p>
      </main>
    );
  }

  const xProfile = getXProfile(xProfiles, wallet.twitter_username);
  const chain = wallet.chain;
  const nativeSymbol = chain === "bsc" ? "BNB" : "SOL";
  const explorer = chain === "bsc" ? "https://bscscan.com/address" : "https://solscan.io/account";

  const kolscanExists = kolscanData.some((e) => e.wallet_address === params.address);

  const quickLinks = [
    { href: `https://gmgn.ai/${chain === "bsc" ? "bsc" : "sol"}/address/${params.address}?ref=nichxbt`, label: "GMGN" },
    { href: `https://trade.padre.gg/rk/nich?wallet=${params.address}`, label: "Padre" },
    { href: `${explorer}/${params.address}`, label: chain === "bsc" ? "BscScan" : "Solscan" },
    ...(chain === "sol" ? [{ href: `https://birdeye.so/profile/${params.address}?chain=solana`, label: "Birdeye" }] : []),
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Back link */}
      <Link href="/all-solana" className="inline-flex items-center gap-1 text-zinc-500 hover:text-white text-xs mb-4 transition-colors">
        ← Leaderboard
      </Link>

      <GmgnDashboard
        wallet={wallet}
        nativeSymbol={nativeSymbol}
        explorerUrl={`${explorer}/${params.address}`}
        quickLinks={quickLinks}
        xProfileFollowers={xProfile?.followers}
        xProfileAvatar={xProfile?.avatar ?? undefined}
        xProfileBio={xProfile?.bio ?? undefined}
        kolscanExists={kolscanExists}
      />

      {/* X Profile detail (if available) */}
      {xProfile && (
        <div className="bg-bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-start gap-4">
            {xProfile.header && (
              <div className="flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden">
                <img src={xProfile.header} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {xProfile.bio && <p className="text-zinc-400 text-xs mb-2 line-clamp-2">{xProfile.bio}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {[
                  { label: "Followers", value: xProfile.followers.toLocaleString() },
                  { label: "Following", value: xProfile.following.toLocaleString() },
                  { label: "Tweets", value: xProfile.tweets.toLocaleString() },
                ].map((s) => (
                  <div key={s.label}>
                    <span className="text-white font-bold tabular-nums">{s.value}</span>
                    <span className="text-zinc-600 ml-1">{s.label}</span>
                  </div>
                ))}
                {xProfile.location && <span className="text-zinc-500">📍 {xProfile.location}</span>}
                {xProfile.website && (
                  <a href={xProfile.website} target="_blank" rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-white transition-colors truncate max-w-xs">
                    🔗 {xProfile.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {xProfile.joinDate && (
                  <span className="text-zinc-500">
                    Joined {new Date(xProfile.joinDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Address */}
      <div className="border border-border/50 rounded-xl p-3 text-center">
        <span className="text-zinc-600 text-[11px] uppercase tracking-wider">Full Address · </span>
        <a href={`${explorer}/${params.address}`} target="_blank" rel="noopener noreferrer"
          className="font-mono text-xs text-buy hover:underline break-all">{params.address}</a>
      </div>
    </main>
  );
}
