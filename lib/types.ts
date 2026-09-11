export type JobStatus = "DISCOVERED" | "ANALYZED" | "MATERIAL_GENERATED" | "MATERIAL_APPROVED" | "READY_TO_APPLY";
export type MaterialStatus = "NOT_GENERATED" | "GENERATING" | "READY" | "ERROR";
export type ReviewStatus = "PENDING" | "APPROVED" | "REVISE" | "REJECTED";
export type ApplicationStatus = "NOT_APPLIED" | "READY_TO_APPLY" | "APPLIED" | "INTERVIEW" | "REJECTED" | "OFFER" | "WITHDRAWN";
export interface CandidateProfile { skills?: string[]; roleFamilies?: string[]; preferredLocations?: string[]; languages?: string[]; remotePreference?: string; }
export interface DiscoveredJob { company:string; title:string; location?:string; url:string; sourceName:string; ats?:string; externalId?:string; description:string; postedAt?:string; workModel?:string; }
