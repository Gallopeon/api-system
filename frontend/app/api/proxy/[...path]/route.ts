import { getToken } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";

export async function GET(req: NextRequest) {
  return proxy(req, "GET");
}
export async function POST(req: NextRequest) {
  return proxy(req, "POST");
}
export async function PUT(req: NextRequest) {
  return proxy(req, "PUT");
}
export async function DELETE(req: NextRequest) {
  return proxy(req, "DELETE");
}
export async function PATCH(req: NextRequest) {
  return proxy(req, "PATCH");
}

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.accessToken) {
    return NextResponse.json({ error: "unauthorized", message: "Not authenticated" }, { status: 401 });
  }

  const path = req.nextUrl.pathname.replace("/api/proxy", "");
  const search = req.nextUrl.search;
  const url = `${BACKEND}${path}${search}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token.accessToken as string}`);

  // Forward content-type for mutating requests
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  // Forward the request-id header if present
  const reqId = req.headers.get("x-request-id");
  if (reqId) {
    headers.set("x-request-id", reqId);
  }

  let body: BodyInit | null = null;
  if (method !== "GET" && method !== "HEAD" && req.body) {
    body = await req.text();
  }

  const res = await fetch(url, { method, headers, body });

  // Stream the response back, forwarding the request-id
  const responseHeaders = new Headers(res.headers);
  const resReqId = responseHeaders.get("x-request-id");
  const result = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });

  if (resReqId) {
    result.headers.set("x-request-id", resReqId);
  }

  return result;
}
