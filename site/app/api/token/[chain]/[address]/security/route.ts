import { NextRequest, NextResponse } from "next/server";

const BIRDEYE_BASE = "https://public-api.birdeye.so";
const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";

interface SecurityData {
  mintAuthority: { revoked: boolean; address: string | null };
  freezeAuthority: { revoked: boolean; address: string | null };
  lpBurned: { burned: boolean; percentage: number | null };
  topHolders: { percentage: number; count: number };
  honeypotRisk: "low" | "medium" | "high" | "unknown";
  tokenStandard: "SPL" | "Token2022" | "ERC20" | "BEP20" | "unknown";
  isToken2022: boolean;
  totalSupply: number | null;
  holders: number | null;
  creator: string | null;
  isOpenSource: boolean | null;
  isMintable: boolean | null;
  canTakeBackOwnership: boolean | null;
  ownerChangeBalance: boolean | null;
  hiddenOwner: boolean | null;
  sellfeeModifiable: boolean | null;
  isHoneypot: boolean | null;
  buyTax: number | null;
  sellTax: number | null;
  source: string;
}

function birdeyeHeaders(): Record<string, string> {
  const key = process.env.BIRDEYE_API_KEY;
  return key ? { "X-API-KEY": key, "x-chain": "solana" } : { "x-chain": "solana" };
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Birdeye token security (Solana)
async function fetchBirdeyeSecurity(address: string): Promise<Partial<SecurityData> | null> {
  try {
    const res = await fetchWithTimeout(
      `${BIRDEYE_BASE}/defi/token_security?address=${address}`,
      { headers: birdeyeHeaders() }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data) return null;

    return {
      mintAuthority: {
        revoked: data.mutableMetadata === false || data.mintAuthority === null,
        address: data.mintAuthority || null,
      },
      freezeAuthority: {
        revoked: data.freezeAuthority === null,
        address: data.freezeAuthority || null,
      },
      topHolders: {
        percentage: data.top10HolderPercent ? data.top10HolderPercent * 100 : 0,
        count: data.holderCount || 0,
      },
      isToken2022: data.isToken2022 === true,
      tokenStandard: data.isToken2022 === true ? "Token2022" : "SPL",
      totalSupply: data.totalSupply || null,
      holders: data.holderCount || null,
      creator: data.creator || null,
      source: "birdeye",
    };
  } catch {
    return null;
  }
}

// GoPlus security (EVM chains)
async function fetchGoPlusSecurity(chain: "bsc" | "eth", address: string): Promise<Partial<SecurityData> | null> {
  try {
    const chainId = chain === "bsc" ? "56" : "1";
    const res = await fetchWithTimeout(`${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${address}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.result?.[address.toLowerCase()];
    if (!data) return null;

    const honeypot = data.is_honeypot === "1";
    const buyTax = data.buy_tax ? parseFloat(data.buy_tax) * 100 : null;
    const sellTax = data.sell_tax ? parseFloat(data.sell_tax) * 100 : null;

    let honeypotRisk: SecurityData["honeypotRisk"] = "low";
    if (honeypot) honeypotRisk = "high";
    else if ((sellTax && sellTax > 10) || (buyTax && buyTax > 10)) honeypotRisk = "medium";

    return {
      mintAuthority: {
        revoked: data.can_take_back_ownership !== "1",
        address: data.owner_address || null,
      },
      freezeAuthority: {
        revoked: data.owner_change_balance !== "1",
        address: null,
      },
      isOpenSource: data.is_open_source === "1",
      isMintable: data.is_mintable === "1",
      canTakeBackOwnership: data.can_take_back_ownership === "1",
      ownerChangeBalance: data.owner_change_balance === "1",
      hiddenOwner: data.hidden_owner === "1",
      sellfeeModifiable: data.sellfee_modifiable === "1",
      isHoneypot: honeypot,
      buyTax,
      sellTax,
      honeypotRisk,
      tokenStandard: chain === "bsc" ? "BEP20" : "ERC20",
      totalSupply: data.total_supply ? parseFloat(data.total_supply) : null,
      holders: data.holder_count ? parseInt(data.holder_count) : null,
      creator: data.creator_address || null,
      source: "goplus",
    };
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ chain: string; address: string }> }
) {
  const params = await context.params;
  const chain = params.chain as "sol" | "bsc";
  const address = params.address;

  if (chain !== "sol" && chain !== "bsc") {
    return NextResponse.json({ error: "Invalid chain" }, { status: 400 });
  }

  if (!address || address.length < 20) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  let security: Partial<SecurityData> | null = null;

  if (chain === "sol") {
    security = await fetchBirdeyeSecurity(address);
  } else {
    security = await fetchGoPlusSecurity("bsc", address);
  }

  if (!security) {
    return NextResponse.json({
      data: null,
      error: "Security data unavailable",
    });
  }

  // Calculate overall score
  let score = 100;
  let warnings: string[] = [];
  let dangers: string[] = [];

  if (security.mintAuthority && !security.mintAuthority.revoked) {
    score -= 20;
    warnings.push("Mint authority active");
  }
  if (security.freezeAuthority && !security.freezeAuthority.revoked) {
    score -= 15;
    warnings.push("Freeze authority active");
  }
  if (security.topHolders && security.topHolders.percentage > 50) {
    score -= 15;
    warnings.push(`Top 10 holders own ${security.topHolders.percentage.toFixed(1)}%`);
  }
  if (security.isHoneypot) {
    score -= 50;
    dangers.push("Detected as honeypot");
  }
  if (security.sellTax && security.sellTax > 10) {
    score -= 20;
    warnings.push(`High sell tax: ${security.sellTax.toFixed(1)}%`);
  }
  if (security.buyTax && security.buyTax > 10) {
    score -= 10;
    warnings.push(`High buy tax: ${security.buyTax.toFixed(1)}%`);
  }
  if (security.hiddenOwner) {
    score -= 15;
    warnings.push("Hidden owner detected");
  }
  if (security.canTakeBackOwnership) {
    score -= 20;
    dangers.push("Owner can take back ownership");
  }

  score = Math.max(0, score);

  const status: "safe" | "caution" | "danger" =
    score >= 80 ? "safe" : score >= 50 ? "caution" : "danger";

  return NextResponse.json({
    data: {
      ...security,
      score,
      status,
      warnings,
      dangers,
    },
  });
}
