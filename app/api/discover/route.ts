import { runDiscovery } from "@/lib/discovery"; import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function POST(){await runDiscovery();return NextResponse.redirect(new URL("/",process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000"),303)}
