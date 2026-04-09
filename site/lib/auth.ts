import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { username } from "better-auth/plugins";
import { siwe } from "better-auth/plugins";
import { solanaWallet } from "@/lib/solana-auth-plugin";
import { db } from "@/drizzle/db";
import crypto from "crypto";

function createAuth() {
  try {
    return betterAuth({
      baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
      database: drizzleAdapter(db, {
        provider: "pg",
      }),
      emailAndPassword: {
        enabled: true,
      },
      user: {
        additionalFields: {
          role: {
            type: "string",
            defaultValue: "user",
            input: false,
          },
        },
      },
      trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS || process.env.NEXT_PUBLIC_URL || "http://localhost:3000")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
      plugins: [
        admin(),
        username({
          minUsernameLength: 3,
          maxUsernameLength: 20,
        }),
        siwe({
          domain: new URL(process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000").host,
          getNonce: async () => crypto.randomBytes(16).toString("hex"),
          verifyMessage: async ({ message, signature }) => {
            const { verifyMessage: ethVerify } = await import("ethers");
            const recoveredAddress = ethVerify(message, signature);
            const addressMatch = message.match(/^.*wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})/m);
            if (!addressMatch) return false;
            return recoveredAddress.toLowerCase() === addressMatch[1].toLowerCase();
          },
        }),
        solanaWallet(),
      ],
    });
  } catch {
    return null;
  }
}

const _auth = createAuth();

export const auth = new Proxy({} as NonNullable<ReturnType<typeof createAuth>>, {
  get(_target, prop, receiver) {
    if (!_auth) {
      throw new Error(
        "Auth is not configured. Set DATABASE_URL and AUTH_SECRET in .env.local",
      );
    }
    return Reflect.get(_auth, prop, receiver);
  },
});
