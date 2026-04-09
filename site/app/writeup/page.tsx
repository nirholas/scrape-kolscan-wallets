import Link from "next/link";

export const metadata = {
  title: "Writeup | KolQuest — How We Reverse-Engineered KolScan",
  description:
    "Step-by-step writeup of how we scraped 472 Solana KOL wallets from kolscan.io by reverse-engineering their Next.js app.",
};

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

function Code({ children }: { children: string }) {
  return (
    <pre className="text-xs overflow-x-auto !bg-bg-secondary">
      <code className="text-emerald-400">{children}</code>
    </pre>
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

export default function WriteupPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 animate-fade-in">
      {/* Hero */}
      <div className="mb-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to home
        </Link>
        <div className="inline-flex items-center gap-2 bg-bg-card border border-border rounded-full px-4 py-1.5 mb-6 block">
          <div className="w-1.5 h-1.5 rounded-full bg-buy animate-pulse" />
          <span className="text-xs text-zinc-400 font-medium">Technical Writeup</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight leading-[1.1]">
          Reverse-Engineering{" "}
          <span className="gradient-text">KolScan.io</span>
        </h1>
        <p className="text-zinc-400 text-base max-w-2xl mb-6 leading-relaxed">
          How we scraped 472 Solana KOL wallets from kolscan.io&apos;s leaderboard
          by reverse-engineering their Next.js app, discovering a hidden POST API,
          and using Playwright to bypass session protection.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Pill>1,304 entries</Pill>
          <Pill>472 wallets</Pill>
          <Pill>3 timeframes</Pill>
          <Pill variant="yellow">Next.js</Pill>
          <Pill variant="yellow">POST API</Pill>
          <Pill variant="yellow">Playwright</Pill>
        </div>
      </div>

      {/* Schema */}
      <div className="mb-16">
        <h2 className="text-xl font-bold text-white mb-1">Data Schema</h2>
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
      <div className="relative bg-bg-card rounded-2xl p-6 sm:p-8 mb-16 border border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📦</span>
            <h2 className="text-lg font-bold text-white">GMGN.ai Import Ready</h2>
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
        <h2 className="text-xl font-bold text-white mb-1">The Process</h2>
        <p className="text-zinc-500 text-sm mb-8">Step-by-step reverse engineering, from initial recon to full data extraction.</p>
      </div>

      <div className="space-y-0">
        <Step n={1} title="Initial Recon — What framework is this?">
          <p>
            First step: fetch the raw HTML and identify the tech stack.
          </p>
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
          <p>
            Full data saved to JSON with GMGN-compatible import format generated automatically.
          </p>
        </Step>
      </div>

      {/* Key Lessons */}
      <div className="mt-16 bg-bg-card rounded-2xl border border-border p-6 sm:p-8">
        <h2 className="text-lg font-bold text-white mb-5">Key Takeaways</h2>
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
    </main>
  );
}
