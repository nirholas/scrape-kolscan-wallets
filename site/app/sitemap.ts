import type { MetadataRoute } from "next";
import { getData, getSolGmgnData, getBscGmgnData } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://kol.quest";

  const staticPages = [
    "",
    "/leaderboard",
    "/top-performers",
    "/most-profitable",
    "/all-solana",
    "/gmgn-sol",
    "/bsc",
    "/feed",
    "/docs",
    "/community",
    "/calendar",
    "/submit",
  ];

  const entries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8,
  }));

  // Dynamic wallet pages
  try {
    const [kolscan, solGmgn, bscGmgn] = await Promise.all([
      getData(),
      getSolGmgnData(),
      getBscGmgnData(),
    ]);

    const kolscanAddresses = [...new Set(kolscan.map((e) => e.wallet_address))];
    for (const addr of kolscanAddresses) {
      entries.push({
        url: `${baseUrl}/wallet/${addr}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    const gmgnAddresses = [
      ...new Set([...solGmgn, ...bscGmgn].map((w) => w.wallet_address)),
    ];
    for (const addr of gmgnAddresses) {
      entries.push({
        url: `${baseUrl}/gmgn-wallet/${addr}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // Data unavailable — return static pages only
  }

  return entries;
}
