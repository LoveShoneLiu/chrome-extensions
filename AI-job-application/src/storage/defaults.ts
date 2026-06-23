import type { AppSettings, UserProfile } from "../types";

export const defaultBaseUrls: Record<AppSettings["provider"], string> = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  deepseek: "https://api.deepseek.com/chat/completions",
  dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  tencent: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
  moonshot: "https://api.moonshot.cn/v1/chat/completions"
};

export const defaultModels: Record<AppSettings["provider"], string> = {
  openrouter: "openai/gpt-4.1-mini",
  openai: "gpt-4.1-mini",
  gemini: "gemini-3.5-flash",
  anthropic: "claude-3-5-sonnet-latest",
  deepseek: "deepseek-v4-flash",
  dashscope: "qwen-plus",
  tencent: "hunyuan-turbos-latest",
  moonshot: "moonshot-v1-8k"
};

export const defaultProfile: UserProfile = {
  basics: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    website: ""
  },
  jobPreferences: {
    desiredLocations: [],
    workModes: [],
    employmentTypes: [],
    industries: [],
    companyStages: [],
    minSalary: "",
    noticePeriod: "",
    willingToRelocate: "",
    dealBreakers: [],
    notes: ""
  },
  workExperiences: [],
  headline: "",
  targetRoles: [],
  skills: [],
  workAuthorization: "",
  availability: "",
  expectedSalary: "",
  resumeSummary: "",
  coverLetterTemplate: ""
};

export const defaultSettings: AppSettings = {
  provider: "openrouter",
  openaiApiKey: "",
  model: defaultModels.openrouter,
  baseUrl: defaultBaseUrls.openrouter
};
