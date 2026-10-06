import { NextResponse } from "next/server";
import { setReviewStatus } from "@/lib/jobs";
import type { ReviewStatus } from "@/lib/types";

export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params, form=await req.formData(), status=form.get("status"), wantsJson=req.headers.get("accept")?.includes("application/json");
  if(status!=="INTERESTED"&&status!=="SKIPPED"&&status!=="PENDING") return wantsJson ? NextResponse.json({error:"Invalid review status"},{status:400}) : new NextResponse("Invalid review status",{status:400});
  try { setReviewStatus(id,status as ReviewStatus); }
  catch { return wantsJson ? NextResponse.json({error:"Not found"},{status:404}) : new NextResponse("Not found",{status:404}); }
  if(wantsJson) return NextResponse.json({ok:true,jobId:id,status});
  return NextResponse.redirect(new URL(`/jobs/${id}`,req.url),303);
}
