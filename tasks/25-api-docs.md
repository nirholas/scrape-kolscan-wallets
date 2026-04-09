# Task: API Documentation Page

## Context
Create a comprehensive API documentation page at `/docs/api` or enhance the existing `/docs` page.

## Requirements

### 1. Documentation Structure

```
/docs
├── /api (or /docs page with tabs)
│   ├── Getting Started
│   ├── Authentication
│   ├── Rate Limits
│   ├── Endpoints
│   │   ├── Solana
│   │   ├── EVM
│   │   ├── Market
│   │   ├── Analytics
│   │   └── Unified
│   ├── Response Format
│   ├── Error Codes
│   ├── Examples
│   └── SDKs
```

### 2. Interactive Playground

Embed an API playground where users can:
- Select endpoint from dropdown
- Fill in parameters
- See request preview
- Execute request
- View response

```typescript
// Component: ApiPlayground.tsx
interface PlaygroundState {
  endpoint: string;
  method: 'GET' | 'POST';
  params: Record<string, string>;
  headers: Record<string, string>;
  body?: string;
  response?: any;
  loading: boolean;
  error?: string;
}
```

### 3. OpenAPI/Swagger Spec

Generate OpenAPI 3.0 spec from our routes:

```yaml
openapi: 3.0.0
info:
  title: KolQuest API
  version: 1.0.0
  description: Unified crypto wallet & token data API
  
servers:
  - url: https://kolquest.com/api/proxy
  
security:
  - ApiKeyAuth: []
  
paths:
  /solana/wallet/{address}:
    get:
      summary: Get unified Solana wallet data
      parameters:
        - name: address
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Wallet data from all Solana sources
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UnifiedSolanaWallet'
```

### 4. Endpoint Documentation Format

For each endpoint, document:

```markdown
## GET /api/proxy/solana/wallet/{address}

Get comprehensive wallet data aggregated from Helius, Birdeye, and Solscan.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Solana wallet address |
| includeNfts | boolean | No | Include NFT holdings (default: false) |
| includePnl | boolean | No | Include PnL data (default: true) |

### Headers

| Name | Required | Description |
|------|----------|-------------|
| X-API-Key | Yes | Your KolQuest API key |

### Response

```json
{
  "success": true,
  "data": {
    "address": "ABC123...",
    "solBalance": 10.5,
    "portfolioValue": 15000,
    "holdings": [...],
    "recentTransactions": [...],
    "pnl": {
      "realized": 5000,
      "unrealized": 2000
    }
  },
  "meta": {
    "sources": ["helius", "birdeye", "solscan"],
    "cached": false,
    "latency": 450
  }
}
```

### Example

```bash
curl "https://kolquest.com/api/proxy/solana/wallet/ABC123" \
  -H "X-API-Key: your-api-key"
```

### Rate Limits

- Free tier: 60 requests/minute
- Pro tier: 600 requests/minute
```

### 5. API Key Management UI

User dashboard section:
- Generate new API key
- View existing keys
- See usage stats
- Revoke keys
- Upgrade tier

### 6. Code Examples

Provide examples in multiple languages:

**JavaScript/TypeScript:**
```typescript
import { KolQuestClient } from '@kolquest/sdk';

const client = new KolQuestClient({ apiKey: 'your-key' });

const wallet = await client.solana.getWallet('ABC123');
console.log(wallet.portfolioValue);
```

**Python:**
```python
import kolquest

client = kolquest.Client(api_key='your-key')

wallet = client.solana.get_wallet('ABC123')
print(wallet.portfolio_value)
```

**cURL:**
```bash
curl -X GET "https://kolquest.com/api/proxy/solana/wallet/ABC123" \
  -H "X-API-Key: your-key"
```

### 7. Error Documentation

| Code | Name | Description |
|------|------|-------------|
| 400 | INVALID_PARAMS | Invalid request parameters |
| 401 | AUTH_REQUIRED | API key missing or invalid |
| 403 | QUOTA_EXCEEDED | Plan quota exceeded |
| 404 | NOT_FOUND | Resource not found |
| 429 | RATE_LIMITED | Too many requests |
| 500 | UPSTREAM_ERROR | External API error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

### 8. Changelog

Document API changes:
- New endpoints
- Breaking changes
- Deprecations
- Bug fixes

## Files to Create/Modify

```
site/app/docs/
├── page.tsx (main docs page)
├── api/
│   ├── page.tsx
│   └── [section]/page.tsx
├── components/
│   ├── ApiPlayground.tsx
│   ├── EndpointDoc.tsx
│   ├── CodeBlock.tsx
│   ├── ApiKeyManager.tsx
│   └── Navigation.tsx

site/app/api/
├── openapi.json/route.ts  # Generate OpenAPI spec
└── docs/route.ts  # Serve rendered docs

site/lib/
└── openapi-generator.ts
```

## Acceptance Criteria
- [x] Documentation page renders
- [x] All endpoints documented
- [x] Interactive playground works
- [x] OpenAPI spec generated
- [x] Code examples for all endpoints
- [x] Error codes documented
- [ ] API key management UI
- [x] Mobile responsive
- [x] Search functionality
- [x] Copy-to-clipboard for code
