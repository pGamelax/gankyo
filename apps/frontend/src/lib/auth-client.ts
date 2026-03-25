import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/auth`,
  plugins: [adminClient(), usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
