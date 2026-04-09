# Authentication

KolQuest uses [Better-Auth](https://www.better-auth.com/) with three sign-in methods: email/password, Solana wallet, and Ethereum wallet.

## Configuration

Auth is set up in `site/lib/auth.ts`. It requires two environment variables:

```env
DATABASE_URL=postgres://...
AUTH_SECRET=your-random-secret
```

The auth instance is wrapped in a Proxy that throws a clear error if the database isn't configured, so the app can still build without a database connection.

## Sign-In Methods

### Email / Password

Standard username + password authentication via the Better-Auth `username()` plugin.

**Sign up:**
1. User provides username (3–20 chars, alphanumeric + underscores) and password (8+ chars)
2. Email is auto-generated as `{username}@wallet.local`
3. Account is created with `role: "user"`

**Sign in:**
1. User provides username + password
2. Better-Auth validates credentials and creates a session
3. Session token is set as a cookie

### Solana Wallet (ed25519)

Custom plugin defined in `site/lib/solana-auth-plugin.ts`.

**Flow:**
```
Client                          Server
  │                               │
  │  POST /api/auth/solana/nonce  │
  │  { walletAddress }            │
  │──────────────────────────────>│
  │  { nonce }                    │
  │<──────────────────────────────│
  │                               │
  │  [User signs message with     │
  │   Phantom wallet]             │
  │                               │
  │  POST /api/auth/solana/verify │
  │  { message, signature,        │
  │    walletAddress }            │
  │──────────────────────────────>│
  │                               │
  │  [Server verifies ed25519     │
  │   signature with tweetnacl]   │
  │                               │
  │  { token, success, user }     │
  │  + Set-Cookie: session        │
  │<──────────────────────────────│
```

**Details:**
- Nonce is stored in memory with 5-minute expiry
- Expired nonces are cleaned up on each new nonce request
- The message must contain the nonce to prevent replay attacks
- Signature is verified using `tweetnacl.sign.detached.verify`
- Public key is decoded from the wallet address via `bs58`
- If no user exists for the wallet, one is created with email `{address}@solana.wallet`

### Ethereum Wallet (EIP-191 / SIWE)

Uses the Better-Auth `siwe()` plugin with ethers.js for signature verification.

**Flow:**
```
Client                          Server
  │                               │
  │  POST /api/auth/siwe/nonce    │
  │  { walletAddress, chainId }   │
  │──────────────────────────────>│
  │  { nonce }                    │
  │<──────────────────────────────│
  │                               │
  │  [User signs EIP-191 message  │
  │   with MetaMask]              │
  │                               │
  │  POST /api/auth/siwe/verify   │
  │  { message, signature,        │
  │    walletAddress, chainId }   │
  │──────────────────────────────>│
  │                               │
  │  [Server recovers address     │
  │   from signature via ethers   │
  │   and compares to message]    │
  │                               │
  │  { success }                  │
  │  + Set-Cookie: session        │
  │<──────────────────────────────│
```

**Details:**
- Uses `ethers.verifyMessage()` to recover the signing address
- Extracts the claimed address from the SIWE message format
- Compares recovered address to claimed address (case-insensitive)
- Nonce is generated as 16 random bytes hex-encoded

## Sessions

- Stored in the `session` database table
- Cookie-based for the web app
- Tracks IP address and user agent
- Sessions have an expiry timestamp
- Deleting a user cascades to delete all their sessions

## Roles

Two roles: `user` (default) and `admin`.

### Admin Bootstrap

The first user whose username matches `ADMIN_USERNAME` (env var) gets auto-promoted:

1. After sign-in, the client calls `POST /api/admin/bootstrap-role`
2. Server compares `session.user.username` (lowercased) to `ADMIN_USERNAME` (lowercased)
3. If they match and user isn't already admin, updates `role` to `"admin"`

There is no UI for promoting other users to admin — that requires a direct database update.

### What Admins Can Do

- Approve/reject wallet submissions at `/admin/submissions`
- Auto-approve their own wallet submissions (skip pending queue)
- Access `GET /api/submissions/pending`
- Access `POST /api/submissions/[id]/approve` and `POST /api/submissions/[id]/reject`

## Rate Limiting

Submission endpoint is rate-limited to 12 requests per hour per user. The rate limiter is in-memory (`site/lib/rate-limit.ts`), so limits reset on server restart and are not shared across instances.

## Client-Side Auth

The client-side auth hook is in `site/lib/auth-client.ts`. Components use it to:
- Check if the user is signed in
- Get the current user's role and username
- Trigger sign-in/sign-out
- Call wallet-specific auth endpoints
