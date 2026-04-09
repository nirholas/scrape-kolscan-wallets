import Link from "next/link";

export const metadata = {
  title: "Docs | KolQuest — API, MCP & Technical Writeup",
  description:
    "KolQuest documentation — REST API reference, MCP server setup, and technical writeup on reverse-engineering KolScan.",
};

/* ── Shared Components ─────────────────────────────── */

function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mb-10">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-card border border-border text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
  params,
}: {
  method: string;
  path: string;
  desc: string;
  params?: { name: string; type: string; desc: string; default?: string }[];
}) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20 uppercase tracking-wider">
          {method}
        </span>
        <code className="text-sm text-white font-mono">{path}</code>
      </div>
      <p className="text-zinc-400 text-sm mb-3">{desc}</p>
      {params && params.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="pb-2 pr-4 text-zinc-500 font-medium">Param</th>
                <th className="pb-2 pr-4 text-zinc-500 font-medium">Type</th>
                <th className="pb-2 pr-4 text-zinc-500 font-medium">Description</th>
                <th className="pb-2 text-zinc-500 font-medium">Default</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {params.map((p) => (
                <tr key={p.name}>
                  <td className="py-2 pr-4 text-buy font-mono">{p.name}</td>
                  <td className="py-2 pr-4 text-zinc-500 font-mono">{p.type}</td>
                  <td className="py-2 pr-4 text-zinc-400">{p.desc}</td>
                  <td className="py-2 text-zinc-500 font-mono">{p.default || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function McpTool({
  name,
  desc,
  params,
}: {
  name: string;
  desc: string;
  params?: { name: string; type: string; desc: string; required?: boolean }[];
}) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-400 ring-1 ring-inset ring-violet-500/20 uppercase tracking-wider">
          Tool
        </span>
        <code className="text-sm text-white font-mono">{name}</code>
      </div>
      <p className="text-zinc-400 text-sm mb-3">{desc}</p>
      {params && params.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="pb-2 pr-4 text-zinc-500 font-medium">Param</th>
                <th className="pb-2 pr-4 text-zinc-500 font-medium">Type</th>
                <th className="pb-2 pr-4 text-zinc-500 font-medium">Description</th>
                <th className="pb-2 text-zinc-500 font-medium">Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {params.map((p) => (
                <tr key={p.name}>
                  <td className="py-2 pr-4 text-violet-400 font-mono">{p.name}</td>
                  <td className="py-2 pr-4 text-zinc-500 font-mono">{p.type}</td>
                  <td className="py-2 pr-4 text-zinc-400">{p.desc}</td>
                  <td className="py-2 text-zinc-500">{p.required ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="text-xs overflow-x-auto !bg-bg-secondary rounded-lg p-3">
      <code className="text-emerald-400">{children}</code>
    </pre>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-10 pb-10 border-l border-border last:border-l-0 last:pb-0 group">
      <div className="absolute -left-[13px] top-0 w-[26px] h-[26px] rounded-full bg-bg-card border-2 border-buy/60 text-buy text-[11px] font-bold flex items-center justify-center group-last:border-buy">
        {n}
      </div>
      <h3 className="text-white font-semibold text-[15px] mb-2 leading-snug">{title}</h3>
      <div className="text-zinc-400 text-sm space-y-3 leading-relaxed">{children}</div>
    </div>
  );
}

function Pill({ children, variant = "green" }: { children: React.ReactNode; variant?: "green" | "red" | "yellow" | "zinc" }) {
  const styles = {
    green: "bg-emerald-500/8 text-emerald-400 ring-emerald-500/20",
    red: "bg-red-500/8 text-red-400 ring-red-500/20",
    yellow: "bg-amber-500/8 text-amber-400 ring-amber-500/20",
    zinc: "bg-zinc-500/8 text-zinc-400 ring-zinc-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${styles[variant]}`}>
      {children}
    </span>
  );
}

/* ── Page ───────────────────────────────────────────── */

export default function DocsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 animate-fade-in">
      {/* Hero */}
      <div className="mb-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to home
        </Link>
        <div className="inline-flex items-center gap-2 bg-bg-card border border-border rounded-full px-4 py-1.5 mb-6 block">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-zinc-400 font-medium">Documentation</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight leading-[1.1]">
          KolQuest <span className="gradient-text">Docs</span>
        </h1>
        <p className="text-zinc-400 text-base max-w-2xl leading-relaxed">
          REST API reference, MCP server integration, and the technical writeup
          on how we reverse-engineered KolScan.
        </p>
      </div>

      <SectionNav
        items={[
          { id: "api", label: "REST API" },
          { id: "mcp", label: "MCP Server" },
          { id: "writeup", label: "Technical Writeup" },
        ]}
      />

      {/* ═══════════════════════════════════════════════ */}
      {/*  REST API                                      */}
      {/* ═══════════════════════════════════════════════ */}
      <section id="api" className="mb-20 scroll-mt-24">
        <h2 className="text-2xl font-bold text-white mb-2">REST API</h2>
        <p className="text-zinc-400 text-sm mb-3">
          Standalone Bun server. All endpoints are <code className="text-buy">GET</code> requests with JSON responses and CORS enabled.
        </p>
        <Code>{`# Start the API server
bun api/index.ts          # default port 3002
API_PORT=8080 bun api/index.ts`}</Code>

        <div className="mt-8 space-y-8">
          {/* KolScan */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">KolScan Endpoints</h3>
            <p className="text-zinc-500 text-xs mb-4">Scraped KOL wallet data — profit, wins, losses across daily / weekly / monthly timeframes.</p>
            <div className="space-y-4">
              <Endpoint
                method="GET"
                path="/health"
                desc="Health check with data counts."
              />
              <Endpoint
                method="GET"
                path="/api/leaderboard"
                desc="Paginated KOL leaderboard with search, sorting, and timeframe filtering."
                params={[
                  { name: "timeframe", type: "number", desc: "1 = daily, 7 = weekly, 30 = monthly", default: "all" },
                  { name: "sort", type: "string", desc: "Sort field: profit, wins, losses, winrate, name", default: "profit" },
                  { name: "order", type: "string", desc: "asc or desc", default: "desc" },
                  { name: "page", type: "number", desc: "Page number (1-indexed)", default: "1" },
                  { name: "limit", type: "number", desc: "Results per page (max 500)", default: "50" },
                  { name: "search", type: "string", desc: "Filter by name or wallet address" },
                ]}
              />
              <Endpoint method="GET" path="/api/wallets" desc="List all unique wallet addresses." />
              <Endpoint
                method="GET"
                path="/api/wallet/:address"
                desc="Detailed stats for a specific wallet — profit, rankings, and per-timeframe data."
              />
              <Endpoint
                method="GET"
                path="/api/top"
                desc="Top KOLs for a given timeframe."
                params={[
                  { name: "timeframe", type: "number", desc: "1 = daily, 7 = weekly, 30 = monthly", default: "1" },
                  { name: "sort", type: "string", desc: "Sort field", default: "profit" },
                  { name: "limit", type: "number", desc: "Max results (1-100)", default: "10" },
                ]}
              />
              <Endpoint method="GET" path="/api/stats" desc="Aggregate statistics — entry counts, top daily performer, timeframes." />
              <Endpoint method="GET" path="/api/export/gmgn" desc="All wallets formatted for GMGN bulk import." />
            </div>
          </div>

          {/* GMGN */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">GMGN Endpoints</h3>
            <p className="text-zinc-500 text-xs mb-4">Smart money wallet data from GMGN — Solana and BSC chains.</p>
            <div className="space-y-4">
              <Endpoint
                method="GET"
                path="/api/gmgn/sol"
                desc="Solana smart money wallets with category filtering."
                params={[
                  { name: "sort", type: "string", desc: "Sort field", default: "realized_profit_7d" },
                  { name: "order", type: "string", desc: "asc or desc", default: "desc" },
                  { name: "page", type: "number", desc: "Page number", default: "1" },
                  { name: "limit", type: "number", desc: "Results per page (max 500)", default: "50" },
                  { name: "category", type: "string", desc: "smart_degen, kol, snipe_bot, launchpad_smart, fresh_wallet, etc." },
                  { name: "search", type: "string", desc: "Search by name, address, or twitter" },
                ]}
              />
              <Endpoint
                method="GET"
                path="/api/gmgn/bsc"
                desc="BSC smart money wallets. Same params as /api/gmgn/sol."
              />
              <Endpoint method="GET" path="/api/gmgn/wallet/:address" desc="Detailed GMGN data for a specific wallet." />
              <Endpoint
                method="GET"
                path="/api/gmgn/categories"
                desc="List categories and wallet counts."
                params={[{ name: "chain", type: "string", desc: "sol or bsc", default: "sol" }]}
              />
              <Endpoint method="GET" path="/api/gmgn/stats" desc="GMGN aggregate stats with top performers per chain." />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/*  MCP Server                                    */}
      {/* ═══════════════════════════════════════════════ */}
      <section id="mcp" className="mb-20 scroll-mt-24">
        <h2 className="text-2xl font-bold text-white mb-2">MCP Server</h2>
        <p className="text-zinc-400 text-sm mb-3">
          Expose wallet intelligence via the{" "}
          <a href="https://modelcontextprotocol.io" target="_blank" className="text-accent hover:underline">
            Model Context Protocol
          </a>{" "}
          for use in AI assistants (Claude, Copilot, Cursor, etc.). Communicates over JSON-RPC via stdio.
        </p>
        <Code>{`# Run the MCP server
bun mcp/index.ts

# Claude Desktop config (~/.config/claude/claude_desktop_config.json)
{
  "mcpServers": {
    "kolquest": {
      "command": "bun",
      "args": ["mcp/index.ts"],
      "cwd": "/path/to/kol-quest"
    }
  }
}`}</Code>

        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-1">Available Tools</h3>
          <p className="text-zinc-500 text-xs mb-4">Each tool is callable by the AI assistant through the MCP protocol.</p>

          <McpTool
            name="kolscan_leaderboard"
            desc="Get KolScan KOL leaderboard. Returns wallets ranked by profit, win rate, or other metrics."
            params={[
              { name: "timeframe", type: "number", desc: "1 (daily), 7 (weekly), 30 (monthly)" },
              { name: "sort", type: "string", desc: "profit, wins, losses, winrate, name" },
              { name: "order", type: "string", desc: "asc or desc" },
              { name: "limit", type: "number", desc: "Max results (1-100)" },
              { name: "search", type: "string", desc: "Search by name or wallet address" },
            ]}
          />
          <McpTool
            name="kolscan_wallet"
            desc="Get detailed KolScan data for a specific wallet — stats, rankings, and PnL across all timeframes."
            params={[
              { name: "address", type: "string", desc: "Wallet address to look up", required: true },
            ]}
          />
          <McpTool
            name="gmgn_wallets"
            desc="Get GMGN smart money wallets. Supports Solana and BSC with category filtering."
            params={[
              { name: "chain", type: "string", desc: "sol or bsc" },
              { name: "category", type: "string", desc: "smart_degen, kol, snipe_bot, launchpad_smart, fresh_wallet, etc." },
              { name: "sort", type: "string", desc: "Sort field" },
              { name: "order", type: "string", desc: "asc or desc" },
              { name: "limit", type: "number", desc: "Max results (1-100)" },
              { name: "search", type: "string", desc: "Search by name, address, or twitter" },
            ]}
          />
          <McpTool
            name="gmgn_wallet_detail"
            desc="Get detailed GMGN data for a specific wallet — profit, trades, win rates, tags, and category."
            params={[
              { name: "address", type: "string", desc: "Wallet address to look up", required: true },
            ]}
          />
          <McpTool
            name="wallet_stats"
            desc="Aggregate statistics across all data sources — total wallets, top performers, category breakdowns."
          />
          <McpTool
            name="search_wallets"
            desc="Search across all data sources (KolScan + GMGN Solana + GMGN BSC) by name, address, or twitter."
            params={[
              { name: "query", type: "string", desc: "Search query", required: true },
              { name: "limit", type: "number", desc: "Max results" },
            ]}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/*  Technical Writeup                             */}
      {/* ═══════════════════════════════════════════════ */}
      <section id="writeup" className="scroll-mt-24">
        <h2 className="text-2xl font-bold text-white mb-2">Technical Writeup</h2>
        <p className="text-zinc-400 text-sm mb-2">
          How we scraped 472 Solana KOL wallets from kolscan.io by reverse-engineering their Next.js app,
          discovering a hidden POST API, and using Playwright to bypass session protection.
        </p>
        <div className="flex items-center gap-2 flex-wrap mb-10">
          <Pill>1,304 entries</Pill>
          <Pill>472 wallets</Pill>
          <Pill>3 timeframes</Pill>
          <Pill variant="yellow">Next.js</Pill>
          <Pill variant="yellow">POST API</Pill>
          <Pill variant="yellow">Playwright</Pill>
        </div>

        {/* Schema */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold text-white mb-1">Data Schema</h3>
          <p className="text-zinc-500 text-sm mb-5">Each entry in the scraped dataset contains these fields.</p>
          <div className="bg-bg-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wider">Field</th>
                  <th className="px-5 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["wallet_address", "string", "Solana wallet address"],
                  ["name", "string", "KOL display name"],
                  ["twitter", "string|null", "Twitter/X profile URL"],
                  ["telegram", "string|null", "Telegram channel URL"],
                  ["profit", "number", "Profit in SOL"],
                  ["wins", "number", "Winning trades"],
                  ["losses", "number", "Losing trades"],
                  ["timeframe", "number", "1 = Daily, 7 = Weekly, 30 = Monthly"],
                ].map(([field, type, desc]) => (
                  <tr key={field} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="px-5 py-3 text-buy font-mono text-xs">{field}</td>
                    <td className="px-5 py-3 text-zinc-500 font-mono text-xs">{type}</td>
                    <td className="px-5 py-3 text-zinc-400 hidden sm:table-cell text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* GMGN Import */}
        <div className="relative bg-bg-card rounded-2xl p-6 sm:p-8 mb-12 border border-border overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📦</span>
              <h3 className="text-lg font-bold text-white">GMGN.ai Import Ready</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-5">
              All 472 wallets are pre-formatted for{" "}
              <a href="https://gmgn.ai/r/nichxbt" target="_blank" className="text-buy hover:text-buy-light underline underline-offset-2 decoration-buy/30">
                GMGN bulk import
              </a>
              . Paste the JSON from{" "}
              <code className="text-buy bg-bg-hover px-1.5 py-0.5 rounded text-xs font-mono">output/gmgn-import.json</code>.
            </p>
            <Code>{`[
  { "address": "CyaE1Vxv...", "name": "Cented", "emoji": "🐋" },
  { "address": "Bi4rd5FH...", "name": "theo",   "emoji": "💰" },
  ...
]`}</Code>
            <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
              <span>🐋 100+ SOL</span>
              <span>🔥 50+</span>
              <span>💰 20+</span>
              <span>✅ positive</span>
              <span>📉 negative</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-1">The Process</h3>
          <p className="text-zinc-500 text-sm mb-8">Step-by-step reverse engineering, from initial recon to full data extraction.</p>
        </div>

        <div className="space-y-0">
          <Step n={1} title="Initial Recon — What framework is this?">
            <p>First step: fetch the raw HTML and identify the tech stack.</p>
            <Code>{`curl -s 'https://kolscan.io/leaderboard' -o page.html
head -100 page.html`}</Code>
            <p>
              Found <code>/_next/static/chunks/</code> script tags — confirming it&apos;s a{" "}
              <strong className="text-white">Next.js</strong> application with App Router.
            </p>
          </Step>

          <Step n={2} title="Hunting for API Endpoints">
            <p>Tried common REST patterns with GET requests:</p>
            <Code>{`curl -s -o /dev/null -w "%{http_code}" 'https://kolscan.io/api/leaderboard'  → 400
curl -s -o /dev/null -w "%{http_code}" 'https://kolscan.io/api/kols'          → 400
curl -s -o /dev/null -w "%{http_code}" 'https://api.kolscan.io/'              → 401`}</Code>
            <p>
              <Pill variant="zinc">400</Pill> means the endpoints <em>exist</em> but reject GET requests.{" "}
              <Pill variant="yellow">401</Pill> on the API subdomain means auth required.
            </p>
          </Step>

          <Step n={3} title="Identifying JavaScript Bundles">
            <p>Extracted all script chunk URLs from the page source:</p>
            <Code>{`curl -s 'https://kolscan.io/leaderboard' \\
  | grep -oE '"[^"]*/_next/static/chunks/[^"]*"'`}</Code>
            <p>Found key chunks including:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li><code>app/leaderboard/page-939ad755c42d8b9d.js</code> — the leaderboard page</li>
              <li><code>184-3d6ce3be6906820b.js</code> — shared API helper chunk</li>
            </ul>
          </Step>

          <Step n={4} title="Finding the API Call in Source Code">
            <p>Searched each JS chunk for <code>/api/</code> paths:</p>
            <Code>{`for chunk in 341-*.js 184-*.js 255-*.js; do
  curl -s "https://kolscan.io/_next/static/chunks/\${chunk}" \\
    | grep -oP '"/api/[^"]*"'
done`}</Code>
            <p>
              <strong className="text-white">Chunk 184</strong> contained the gold:{" "}
              <code>/api/trades</code>, <code>/api/tokens</code>,{" "}
              <code>/api/leaderboard</code>, <code>/api/data</code>
            </p>
          </Step>

          <Step n={5} title="Extracting the Exact Fetch Signature">
            <p>Pulled the surrounding code context to see the full fetch call:</p>
            <Code>{`curl -s '.../184-*.js' | grep -oP '.{0,200}/api/leaderboard.{0,200}'`}</Code>
            <p>Revealed the <strong className="text-white">exact implementation</strong>:</p>
            <Code>{`fetch("/api/leaderboard", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ timeframe: e, page: t, pageSize: n })
})`}</Code>
            <p>
              Key discovery: <Pill variant="yellow">POST not GET</Pill>. Parameters:{" "}
              <code>timeframe</code> (1/7/30), <code>page</code> (0-indexed),{" "}
              <code>pageSize</code> (50).
            </p>
          </Step>

          <Step n={6} title="Direct POST Attempt — Blocked">
            <Code>{`curl -s -X POST 'https://kolscan.io/api/leaderboard' \\
  -H 'Content-Type: application/json' \\
  -d '{"timeframe":1,"page":0,"pageSize":50}'
→ Forbidden`}</Code>
            <p>
              <Pill variant="red">Forbidden</Pill> — The API requires a valid browser
              session. Cookie/session-based protection prevents direct curl access.
            </p>
          </Step>

          <Step n={7} title="SSR Data Extraction — Partial Success">
            <p>
              Discovered the page server-renders initial data via the{" "}
              <code>initLeaderboard</code> React prop:
            </p>
            <Code>{`curl -s 'https://kolscan.io/leaderboard' \\
  | grep -oP '\\{[^}]*wallet_address[^}]*\\}' | head -5`}</Code>
            <p>
              Extracted <Pill>616 entries</Pill> from the HTML — but only the first
              page per timeframe, and many had missing fields due to regex limits.
            </p>
          </Step>

          <Step n={8} title="Understanding the Scroll Mechanism">
            <p>By reading the full page chunk (~14KB), we found:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Uses <code>react-infinite-scroll-component</code></li>
              <li>Scroll target: <code>scrollableTarget: &quot;mainScroll&quot;</code> (not window!)</li>
              <li>Page size hardcoded at 50</li>
              <li>Timeframes: <code>[1, 7, 30]</code> → Daily / Weekly / Monthly</li>
            </ul>
          </Step>

          <Step n={9} title="Playwright Headless Browser — First Fail">
            <p>
              Installed Playwright to get a real browser session. First attempt
              scrolled <code>window</code> — captured <strong className="text-sell">0 results</strong>.
            </p>
            <Code>{`// ❌ Wrong — infinite scroll listens on #mainScroll, not window
window.scrollTo(0, document.body.scrollHeight);`}</Code>
            <p>The infinite scroll component <em>only</em> triggers when <code>#mainScroll</code> is scrolled.</p>
          </Step>

          <Step n={10} title="The Fix — Scroll the Right Container">
            <Code>{`// ✅ Correct — scroll the actual container
const el = document.getElementById('mainScroll');
if (el) el.scrollTop = el.scrollHeight;`}</Code>
            <p>
              Combined with intercepting POST responses and clicking between
              Daily/Weekly/Monthly tabs, this captured{" "}
              <strong className="text-buy glow-green">all 1,304 entries</strong> across{" "}
              <strong className="text-buy glow-green">472 unique wallets</strong>.
            </p>
          </Step>

          <Step n={11} title="Final Result">
            <Code>{`Daily:   434 entries (9 pages × 50 + 34)
Weekly:  435 entries (8 pages × 50 + 35)
Monthly: 435 entries (8 pages × 50 + 35)
─────────────────────────────────────────
Total:   1,304 entries
Unique:  472 wallets`}</Code>
            <p>Full data saved to JSON with GMGN-compatible import format generated automatically.</p>
          </Step>
        </div>

        {/* Key Lessons */}
        <div className="mt-16 bg-bg-card rounded-2xl border border-border p-6 sm:p-8">
          <h3 className="text-lg font-bold text-white mb-5">Key Takeaways</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            {[
              ["Check the HTTP method", "This API only accepts POST, not GET"],
              ["Read the JS source", "Minified code still reveals exact API signatures"],
              ["Protected APIs need browsers", "Headless browsers bypass cookie/session protection"],
              ["Scroll containers matter", "Infinite scroll often binds to a specific element"],
              ["SSR data is free", "Next.js embeds initial page data in HTML as React props"],
              ["Shared chunks hold API helpers", "Look in numbered chunks (184-*.js) for fetch calls"],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-3 bg-bg-hover/50 rounded-xl p-3">
                <div className="w-1.5 h-1.5 rounded-full bg-buy mt-2 shrink-0" />
                <div>
                  <span className="text-white font-medium text-[13px]">{title}</span>
                  <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
