import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return NextResponse.redirect(new URL(`/jobs/${id}`,req.url),303)}
