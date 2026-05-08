import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const apiBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";
        try {
          const creds = credentials as Record<string, string> | undefined;
          const body: { username: string; password: string; totp_code?: string } = {
            username: creds?.username || "",
            password: creds?.password || "",
          };
          if (creds?.totp_code) body.totp_code = creds.totp_code;
          const res = await fetch(`${apiBase}/admin/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            if (data?.code === "unauthorized" && data?.message?.includes("TOTP")) {
              throw new Error("totp_required");
            }
            return null;
          }
          return {
            id: data.user.id,
            name: data.user.display_name || data.user.username,
            email: data.user.email,
            image: data.user.avatar_url,
            role: data.user.role,
            accessToken: data.token,
          };
        } catch (e) {
          if ((e as Error).message === "totp_required") throw e;
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).role = token.role;
      (session as any).userId = token.userId;
      // accessToken stays server-side only — never sent to the browser.
      // Frontend API calls go through /api/proxy/[...path] which injects it.
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
});

export { handler as GET, handler as POST };
