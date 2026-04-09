import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/drizzle/db";

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

function createAuth() {
  try {
    return betterAuth({
      baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
      database: drizzleAdapter(db, {
        provider: "pg",
      }),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
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
      socialProviders,
      trustedOrigins: [process.env.NEXT_PUBLIC_URL || "http://localhost:3000"],
      plugins: [admin()],
    });
  } catch {
    // Return a stub that throws helpful errors at call time instead of crashing at import
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
