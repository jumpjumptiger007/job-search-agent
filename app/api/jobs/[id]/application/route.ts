import { NextResponse } from "next/server";
import { setApplicationStatus } from "@/lib/jobs";
import type { ApplicationStatus } from "@/lib/types";

export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params, form=await req.formData(), status=form.get("status");
  try { setApplicationStatus(id,status as ApplicationStatus); }
  catch(error) { return new NextResponse(error instanceof Error?error.message:"Invalid application status",{status:400}); }
  return NextResponse.redirect(new URL(`/jobs/${id}`,req.url),303);
}
