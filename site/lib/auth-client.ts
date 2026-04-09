import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { siweClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_URL,
  plugins: [usernameClient(), siweClient()],
});

export const { signIn, signUp, useSession, signOut, getSession } = authClient;
export { authClient };
