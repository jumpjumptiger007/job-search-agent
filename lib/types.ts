export type JobStatus = "DISCOVERED" | "ANALYZED" | "MATERIAL_GENERATED";
export type MaterialStatus = "NOT_GENERATED" | "GENERATING" | "READY" | "ERROR";
export type ReviewStatus = "PENDING" | "INTERESTED" | "SKIPPED";
export type ApplicationStatus = "NOT_APPLIED" | "READY_TO_APPLY" | "APPLIED" | "INTERVIEW" | "REJECTED" | "OFFER" | "WITHDRAWN";
export interface CandidateProfile { skills?: string[]; roleFamilies?: string[]; preferredLocations?: string[]; languages?: string[]; remotePreference?: string; }
export interface DiscoveredJob { company:string; title:string; location?:string; url:string; sourceName:string; ats?:string; externalId?:string; description:string; postedAt?:string; workModel?:string; discoveredVia?:string; }
export type WorkingLanguage = "German" | "English" | "German & English";
export type OtherLanguagePreference = { language: string; requirement: "Required" | "Preferred" };
export interface DiscoveryPreferences { roleFamilies?:string[]; location?:string; radiusKm?:number; remotePreference?:string; workingLanguage?:WorkingLanguage; otherLanguages?:OtherLanguagePreference[]; postingAgeDays?:number; limits?:{perRun?:number}; }
