import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const target = process.env.PROXY_TARGET;
  if (!target)
    return NextResponse.json(
      { error: "PROXY_TARGET not set" },
      { status: 500 },
    );

  const url = new URL((await req.json()).path || "", target);
  const init: RequestInit = {
    method: req.method,
    headers: Object.fromEntries(req.headers as any),
    body: JSON.stringify((await req.json()).body || {}),
  };

  const res = await fetch(url.toString(), init);
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: res.headers as any,
  });
}

export async function GET(req: Request) {
  const target = process.env.PROXY_TARGET;
  if (!target)
    return NextResponse.json(
      { error: "PROXY_TARGET not set" },
      { status: 500 },
    );

  const incomingUrl = new URL(req.url);
  const url = new URL(incomingUrl.pathname + incomingUrl.search, target);
  const res = await fetch(url.toString(), {
    headers: Object.fromEntries(req.headers as any),
  });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: res.headers as any,
  });
}
