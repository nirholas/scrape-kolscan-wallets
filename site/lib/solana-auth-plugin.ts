import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import crypto from "crypto";

export function solanaWallet(): BetterAuthPlugin {
  const nonceStore = new Map<string, { nonce: string; expires: number }>();

  return {
    id: "solana-wallet",
    endpoints: {
      solanaGetNonce: createAuthEndpoint(
        "/solana/nonce",
        {
          method: "POST",
          body: z.object({
            walletAddress: z.string().min(32).max(44),
          }),
        },
        async (ctx) => {
          // Clean expired nonces
          const now = Date.now();
          for (const [key, val] of nonceStore) {
            if (val.expires < now) nonceStore.delete(key);
          }

          const nonce = crypto.randomBytes(16).toString("hex");
          nonceStore.set(ctx.body.walletAddress, {
            nonce,
            expires: now + 5 * 60 * 1000,
          });
          return ctx.json({ nonce });
        },
      ),
      solanaVerify: createAuthEndpoint(
        "/solana/verify",
        {
          method: "POST",
          body: z.object({
            message: z.string(),
            signature: z.string(),
            walletAddress: z.string().min(32).max(44),
          }),
        },
        async (ctx) => {
          const { message, signature, walletAddress } = ctx.body;

          // Verify nonce exists and hasn't expired
          const stored = nonceStore.get(walletAddress);
          if (!stored || stored.expires < Date.now()) {
            throw new APIError("BAD_REQUEST", {
              message: "Invalid or expired nonce",
            });
          }
          const nonceMatch = message.match(/^Nonce:\s*(\S+)$/m);
          if (!nonceMatch || nonceMatch[1] !== stored.nonce) {
            throw new APIError("BAD_REQUEST", {
              message: "Nonce mismatch",
            });
          }
          nonceStore.delete(walletAddress);

          // Verify ed25519 signature
          const nacl = await import("tweetnacl");
          const bs58 = await import("bs58");

          const messageBytes = new TextEncoder().encode(message);
          const signatureBytes = Buffer.from(signature, "base64");
          const publicKeyBytes = bs58.default.decode(walletAddress);

          const isValid = nacl.default.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes,
          );
          if (!isValid) {
            throw new APIError("UNAUTHORIZED", {
              message: "Invalid signature",
            });
          }

          // Find or create user by Solana wallet address.
          // Use a hashed email to avoid collisions with real accounts.
          const emailHash = crypto.createHash("sha256").update(`solana:${walletAddress}`).digest("hex").slice(0, 16);
          const email = `${emailHash}@solana.wallet`;
          let dbUser = await ctx.context.internalAdapter.findUserByEmail(email);

          if (!dbUser) {
            const shortAddr = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
            const created = await ctx.context.internalAdapter.createUser({
              name: shortAddr,
              email,
              emailVerified: true,
            });
            if (!created) {
              console.error("[solana-auth] createUser returned null for wallet:", walletAddress);
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Failed to create user",
              });
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dbUser = { user: created, accounts: [] } as any;
          }

          // Create session
          const session = await ctx.context.internalAdapter.createSession(
            dbUser!.user.id,
          );
          if (!session) {
            console.error("[solana-auth] createSession returned null for userId:", dbUser!.user.id);
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to create session",
            });
          }

          await setSessionCookie(ctx, { session, user: dbUser!.user });

          return ctx.json({
            token: session.token,
            success: true,
            user: { id: dbUser!.user.id, walletAddress },
          });
        },
      ),
    },
  };
}
