import { NextResponse } from "next/server";
export function GET(){return NextResponse.json({state:"SETUP_REQUIRED",required:["Private factual candidate profile", "Discovery preferences", "Validated job analysis/tailoring plan"],paths:["profile/README.md","config/preferences.example.yaml"]})}
