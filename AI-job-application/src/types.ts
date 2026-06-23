export type UserProfile = {
  basics: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    website: string;
  };
  jobPreferences: {
    desiredLocations: string[];
    workModes: string[];
    employmentTypes: string[];
    industries: string[];
    companyStages: string[];
    minSalary: string;
    noticePeriod: string;
    willingToRelocate: string;
    dealBreakers: string[];
    notes: string;
  };
  workExperiences: WorkExperience[];
  headline: string;
  targetRoles: string[];
  skills: string[];
  workAuthorization: string;
  availability: string;
  expectedSalary: string;
  resumeSummary: string;
  coverLetterTemplate: string;
};

export type WorkExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  highlights: string[];
};

export type AppSettings = {
  provider: "openrouter" | "openai" | "gemini" | "anthropic" | "deepseek" | "dashscope" | "tencent" | "moonshot";
  openaiApiKey: string;
  model: string;
  baseUrl: string;
};

export type JobPosting = {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
};

export type MatchReport = {
  score: number;
  recommendation: "strong_apply" | "apply" | "maybe" | "skip";
  summary: string;
  strengths: string[];
  gaps: string[];
  risks: string[];
  suggestedResumeKeywords: string[];
};

export type FormField = {
  selector: string;
  tagName: string;
  type: string;
  label: string;
  placeholder: string;
  name: string;
  id: string;
  options: string[];
};

export type FillPlanItem = {
  selector: string;
  value: string;
  reason: string;
};

export type ResumeParseResult = {
  profile: UserProfile;
};

export type CoverLetterResult = {
  coverLetter: string;
};

export type ExtensionRequest =
  | { type: "EXTRACT_JOB" }
  | { type: "SCAN_FORM" }
  | { type: "APPLY_FILL_PLAN"; payload: { plan: FillPlanItem[] } }
  | { type: "ANALYZE_JOB"; payload: { job: JobPosting } }
  | { type: "BUILD_FILL_PLAN"; payload: { fields: FormField[] } }
  | { type: "PARSE_RESUME_TEXT"; payload: { resumeText: string } }
  | { type: "GENERATE_COVER_LETTER"; payload: { job: JobPosting } };

export type StorageShape = {
  profile: UserProfile;
  settings: AppSettings;
};
