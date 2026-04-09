import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Developer API",
  description:
    "Generate API keys and access KolQuest proxy endpoints for Solana, EVM, and market data.",
};

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
