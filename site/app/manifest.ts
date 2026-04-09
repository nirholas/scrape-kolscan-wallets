import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KolQuest — Smart Wallet Intelligence",
    short_name: "KolQuest",
    description:
      "Track the smartest crypto wallets — KolScan KOLs, GMGN smart money, Solana & BSC.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
