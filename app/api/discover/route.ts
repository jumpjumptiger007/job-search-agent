import { runDiscovery } from "@/lib/discovery"; import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function POST(request: Request){await runDiscovery();return NextResponse.redirect(new URL("/",request.url),303)}
