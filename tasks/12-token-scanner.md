# Task: New Page - Token Security Scanner

## Context
Create a `/scanner` page where users can input any token and get comprehensive security + analytics analysis.

## Requirements

### 1. Data Sources for Security

**Solana:**
- Birdeye: `/defi/token_security` - mint/freeze authority, holder concentration
- Helius: Token metadata, creator info
- RugCheck API: If available

**EVM:**
- GoPlus: Security API (honeypot, malicious code)
- Token Sniffer: Contract analysis
- De.Fi: Security scanner

### 2. Page Sections

#### Token Input
- Paste any token address
- Auto-detect chain
- Recent scans saved
- "Scan" button

#### Quick Verdict
```
┌───────────────────────────────────────────────────┐
│  🟢 LOW RISK  |  🟡 MEDIUM RISK  |  🔴 HIGH RISK  │
│                                                   │
│  Overall Score: 85/100                           │
│                                                   │
│  Quick Checks:                                   │
│  ✅ Liquidity locked                             │
│  ✅ No mint function                             │
│  ✅ No honeypot detected                         │
│  ⚠️ High holder concentration (45%)              │
│  ❌ Social links not verified                    │
└───────────────────────────────────────────────────┘
```

#### Detailed Security Analysis

**Contract Analysis:**
- Mint authority status
- Freeze authority status
- Proxy/upgradeable contract
- Hidden functions
- Tax/fee detection
- Blacklist functions

**Holder Analysis:**
- Top 10 holder %
- Creator holding %
- Team wallet holdings
- Whale distribution
- Smart money holdings (cross-ref with our DB)

**Liquidity Analysis:**
- LP locked %
- LP burn %
- Time until unlock
- Multiple pools?
- DEX distribution

**Social Verification:**
- Twitter linked & active?
- Website exists?
- Telegram active?
- CoinGecko/CMC listed?

#### Trading Analysis
- Volume trend (increasing/decreasing)
- Buy/sell ratio
- Unique traders
- Average trade size
- Whale activity

#### KOL Check
- Which KOLs hold this token?
- Their entry price vs current
- Total KOL holdings %
- Recent KOL buys/sells

### 3. Risk Scoring Algorithm

```typescript
interface RiskScore {
  overall: number; // 0-100, higher = safer
  
  components: {
    contract: number;    // 0-25
    holders: number;     // 0-25
    liquidity: number;   // 0-25
    social: number;      // 0-25
  };
  
  flags: {
    critical: string[];  // Red flags
    warning: string[];   // Yellow flags
    positive: string[];  // Green flags
  };
}
```

### 4. API Routes

```
GET /api/scanner/[address]?chain=solana
GET /api/scanner/[address]/security?chain=solana
GET /api/scanner/[address]/holders?chain=solana
GET /api/scanner/[address]/liquidity?chain=solana
GET /api/scanner/[address]/kol-check?chain=solana
```

### 5. Comparison Mode

Compare two tokens side by side:
- Security scores
- Holder distribution
- Liquidity comparison
- KOL overlap

### 6. Watchlist Integration

- Add scanned tokens to watchlist
- Alert when security score changes
- Alert when LP unlocks

## Files to Create

```
site/app/scanner/
├── page.tsx
├── [address]/
│   └── page.tsx
└── components/
    ├── TokenInput.tsx
    ├── RiskVerdict.tsx
    ├── SecurityDetails.tsx
    ├── HolderAnalysis.tsx
    ├── LiquidityAnalysis.tsx
    ├── KolCheck.tsx
    └── CompareMode.tsx

site/app/api/scanner/
├── [address]/route.ts
├── [address]/security/route.ts
├── [address]/holders/route.ts
└── [address]/kol-check/route.ts

site/lib/
└── security-scorer.ts
```

## Acceptance Criteria
- [ ] Token input accepts any address
- [ ] Security score calculated
- [ ] All risk factors displayed
- [ ] KOL holdings shown
- [ ] Compare mode works
- [ ] Share scan result
- [ ] Mobile responsive
