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
      async authorize(credentials, req) {
        const apiBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";
        try {
          const creds = credentials as Record<string, string> | undefined;
          const body: { username: string; password: string; totp_code?: string; device_fingerprint?: string } = {
            username: creds?.username || "",
            password: creds?.password || "",
          };
          if (creds?.totp_code) body.totp_code = creds.totp_code;
          if (creds?.device_fingerprint) body.device_fingerprint = creds.device_fingerprint;
          const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
          const xff = (req as any)?.headers?.["x-forwarded-for"];
          if (xff) forwardHeaders["x-forwarded-for"] = Array.isArray(xff) ? xff[0] : String(xff);
          const ua = (req as any)?.headers?.["user-agent"];
          if (ua) forwardHeaders["user-agent"] = String(ua);
          const res = await fetch(`${apiBase}/admin/v1/auth/login`, {
            method: "POST",
            headers: forwardHeaders,
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            if (data?.error === "unauthorized" && data?.message?.includes("TOTP")) {
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
            userGroup: data.user.user_group || "admin_group",
            accessToken: data.token,
            permissions: data.permissions || [],
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
        token.userGroup = (user as any).userGroup || "admin_group";
        token.accessToken = (user as any).accessToken;
        token.userId = user.id;
        token.permissions = (user as any).permissions || [];
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).role = token.role;
      (session.user as any).userGroup = token.userGroup || "admin_group";
      (session as any).userId = token.userId;
      (session as any).permissions = token.permissions || [];
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
});

export { handler as GET, handler as POST };
