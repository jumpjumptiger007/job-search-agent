import type { ApplicationStatus } from "../types";

export const applicationStates:ApplicationStatus[]=["NOT_APPLIED","READY_TO_APPLY","APPLIED","INTERVIEW","REJECTED","OFFER","WITHDRAWN"];
export const isClosed=(job:any)=>job.review_status==="SKIPPED"||["REJECTED","WITHDRAWN"].includes(job.application_status);
export const isActive=(job:any)=>["APPLIED","INTERVIEW","OFFER"].includes(job.application_status);
export const isReadyToApply=(job:any)=>job.review_status==="INTERESTED"&&job.content_status!=="INSUFFICIENT"&&job.material_status==="READY";
export function classifyWorkflowQueues(jobs:any[]){return {review:jobs.filter(j=>j.review_status==="PENDING"&&!isClosed(j)),tailor:jobs.filter(j=>j.review_status==="INTERESTED"&&j.content_status!=="INSUFFICIENT"&&j.material_status!=="READY"&&!isActive(j)&&!isClosed(j)),materialsReady:jobs.filter(j=>isReadyToApply(j)&&j.application_status==="NOT_APPLIED"),readyToApply:jobs.filter(j=>j.content_status!=="INSUFFICIENT"&&j.application_status==="READY_TO_APPLY"&&!isClosed(j)),active:jobs.filter(isActive),historical:jobs.filter(isClosed)};}
