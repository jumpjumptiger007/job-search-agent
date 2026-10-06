import { NextResponse } from "next/server";
import { setApplicationStatus } from "@/lib/jobs";
import type { ApplicationStatus } from "@/lib/types";

export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params, form=await req.formData(), status=form.get("status"), wantsJson=req.headers.get("accept")?.includes("application/json");
  let job;
  try { job=setApplicationStatus(id,status as ApplicationStatus); }
  catch(error) { const message=error instanceof Error?error.message:"Invalid application status"; return wantsJson ? NextResponse.json({error:message},{status:400}) : new NextResponse(message,{status:400}); }
  if(wantsJson) return NextResponse.json({ok:true,jobId:id,status:job.application_status});
  return NextResponse.redirect(new URL(`/jobs/${id}`,req.url),303);
}
