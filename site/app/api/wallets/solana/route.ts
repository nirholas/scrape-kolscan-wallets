import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEnrichedSolanaWallets, filterSolanaWallets, enrichWallet, fetchWalletExpandData } from "@/lib/data";
import type { EnrichedSolanaWallet, EnrichedSortField, SortDir } from "@/lib/types";

const GetWalletsQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sort: z.string().default("portfolio_value"),
  order: z.enum(["asc", "desc"]).default("desc"),
  minPortfolioValue: z.coerce.number().min(0).optional(),
  minWinrate: z.coerce.number().min(0).max(1).optional(),
  activeWithin: z.enum(["24h", "7d", "30d", "all"]).optional(),
  category: z.string().optional(),
  hasTwitter: z.enum(["true", "false"]).optional().transform(v => v === "true"),
  smartMoneyTag: z.string().optional(),
  search: z.string().optional(),
  // For single-wallet live enrichment
  enrichAddress: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const query = GetWalletsQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));

  if (!query.success) {
    return NextResponse.json({ error: "Invalid query params", details: query.error.format() }, { status: 400 });
  }
  
  const params = query.data;

  // Handle single-wallet real-time enrichment request
  if (params.enrichAddress) {
    try {
      const data = await fetchWalletExpandData(params.enrichAddress);
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ error: "Failed to enrich wallet", details: (e as Error).message }, { status: 500 });
    }
  }

  // Load base data
  const baseWallets = await getEnrichedSolanaWallets();

  // Apply filters
  const filtered = filterSolanaWallets(baseWallets, {
    minPortfolioValue: params.minPortfolioValue,
    minWinrate: params.minWinrate,
    activeWithin: params.activeWithin,
    category: params.category,
    hasTwitter: params.hasTwitter,
    smartMoneyTag: params.smartMoneyTag,
    search: params.search,
  });
  
  // Enrich visible results
  const page = params.page;
  const limit = params.limit;
  const start = (page - 1) * limit;
  const end = start + limit;
  const pageSlice = filtered.slice(start, end);

  const enrichedPage = await Promise.all(pageSlice.map(w => enrichWallet(w)));

  // Combine back with non-enriched results for correct sorting
  const fullEnrichedList = [
    ...filtered.slice(0, start),
    ...enrichedPage,
    ...filtered.slice(end),
  ];

  // Sort
  const sortField = params.sort as EnrichedSortField;
  const order = params.order as SortDir;
  
  fullEnrichedList.sort((a, b) => {
    const av = (a as any)[sortField] ?? 0;
    const bv = (b as any)[sortField] ?? 0;
    
    if (typeof av === "string" && typeof bv === "string") {
      return order === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    
    // Fallback for null/undefined values
    const aVal = typeof av === "number" ? av : (order === "desc" ? -Infinity : Infinity);
    const bVal = typeof bv === "number" ? bv : (order === "desc" ? -Infinity : Infinity);
    
    return order === "asc" ? aVal - bVal : bVal - aVal;
  });

  // Paginate final sorted list
  const finalPageData = fullEnrichedList.slice(start, end);
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);

  // Discover all available categories and tags from the full filtered set
  const categories = [...new Set(filtered.map(w => w.category).filter(Boolean))].sort();
  const smartMoneyTags = [...new Set(filtered.flatMap(w => w.smart_money_tags || w.tags).filter(Boolean))].sort();

  return NextResponse.json({
    wallets: finalPageData,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
    sources: { // These are now dynamic per-wallet, but we can indicate which are possible
      kolscan: true,
      gmgn: true,
      helius: !!process.env.HELIUS_API_KEY,
      birdeye: !!process.env.BIRDEYE_API_KEY,
    },
    categories,
    smartMoneyTags,
  });
}
