import type {
  AppSettings,
  CoverLetterResult,
  FillPlanItem,
  FormField,
  JobPosting,
  MatchReport,
  ResumeParseResult,
  UserProfile
} from "../types";

const parseJson = <T>(text: string): T => {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as T;
};

const AI_TIMEOUT_MS = 45000;

const providerLabel = (provider: AppSettings["provider"]) =>
  ({
    openrouter: "OpenRouter",
    openai: "OpenAI",
    gemini: "Gemini",
    anthropic: "Claude",
    deepseek: "DeepSeek",
    dashscope: "Alibaba DashScope",
    tencent: "Tencent Hunyuan",
    moonshot: "Moonshot Kimi"
  })[provider];

const jsonModeProviders: AppSettings["provider"][] = ["openrouter", "openai", "gemini"];

const fetchJsonWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI request failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI request timed out. Try again or choose a faster model in settings.");
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const buildOpenAiCompatibleBody = (settings: AppSettings, messages: Array<{ role: "system" | "user"; content: string }>) => {
  const body: Record<string, unknown> = {
    model: settings.model,
    temperature: 0.2,
    messages
  };

  if (jsonModeProviders.includes(settings.provider)) {
    body.response_format = { type: "json_object" };
  }

  return body;
};

const requestOpenAiCompatibleJson = async <T>(
  settings: AppSettings,
  messages: Array<{ role: "system" | "user"; content: string }>
): Promise<T> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${settings.openaiApiKey}`
  };

  if (settings.provider === "openrouter") {
    headers["HTTP-Referer"] = chrome.runtime.getURL("");
    headers["X-Title"] = "AI Job Match & Autofill";
  }

  const data = await fetchJsonWithTimeout(settings.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(buildOpenAiCompatibleBody(settings, messages))
  });

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI did not return parseable content.");
  }

  return parseJson<T>(content);
};

const requestAnthropicJson = async <T>(
  settings: AppSettings,
  messages: Array<{ role: "system" | "user"; content: string }>
): Promise<T> => {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => ({ role: "user", content: message.content }));

  const data = await fetchJsonWithTimeout(settings.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.openaiApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 4096,
      temperature: 0.2,
      system,
      messages: userMessages
    })
  });

  const content = data.content?.find((item: { type?: string; text?: string }) => item.type === "text")?.text;
  if (!content) {
    throw new Error("AI did not return parseable content.");
  }

  return parseJson<T>(content);
};

const requestJson = async <T>(settings: AppSettings, messages: Array<{ role: "system" | "user"; content: string }>): Promise<T> => {
  if (!settings.openaiApiKey) {
    throw new Error(`Please save your ${providerLabel(settings.provider)} API key in settings first.`);
  }

  if (settings.provider === "anthropic") {
    return requestAnthropicJson<T>(settings, messages);
  }

  return requestOpenAiCompatibleJson<T>(settings, messages);
};

export const analyzeJob = (settings: AppSettings, profile: UserProfile, job: JobPosting) =>
  requestJson<MatchReport>(settings, [
    {
      role: "system",
      content:
        "You are a precise job application advisor. Return only JSON with keys: score, recommendation, summary, strengths, gaps, risks, suggestedResumeKeywords. recommendation must be one of strong_apply, apply, maybe, skip."
    },
    {
      role: "user",
      content: JSON.stringify({ profile, job })
    }
  ]);

export const buildFillPlan = (settings: AppSettings, profile: UserProfile, fields: FormField[]) =>
  requestJson<{ plan: FillPlanItem[] }>(settings, [
    {
      role: "system",
      content:
        "Map application form fields to the candidate profile. Return JSON: {\"plan\":[{\"selector\":\"...\",\"value\":\"...\",\"reason\":\"...\"}]}. Only include fields you can answer confidently. Do not submit forms."
    },
    {
      role: "user",
      content: JSON.stringify({ profile, fields })
    }
  ]);

export const parseResumeText = (settings: AppSettings, currentProfile: UserProfile, resumeText: string) =>
  requestJson<ResumeParseResult>(settings, [
    {
      role: "system",
      content:
        "Extract a candidate profile from resume text. Return JSON: {\"profile\": UserProfile}. Preserve useful existing values when the resume does not provide better data. Fill basics, headline, targetRoles, skills, workAuthorization, availability, expectedSalary, resumeSummary, and workExperiences as much as the resume reasonably supports. targetRoles and skills must be arrays of strings. Leave jobPreferences unchanged from the existing profile. Extract workExperiences from the resume as an array, where each item has company, title, startDate, endDate, location, description, and highlights. Use the resume's wording for responsibilities and achievements when possible. Do not invent salary or availability if not present. resumeSummary should be a concise but information-rich summary for job matching. coverLetterTemplate should preserve the existing template value unless the resume clearly contains reusable cover letter material."
    },
    {
      role: "user",
      content: JSON.stringify({ currentProfile, resumeText })
    }
  ]);

const fallbackPlaceholderValues = (profile: UserProfile, job: JobPosting) => ({
  company: job.company || "the company",
  employer: job.company || "the company",
  role: job.title || "the role",
  position: job.title || "the role",
  title: job.title || "the role",
  location: job.location || profile.basics.location || "the advertised location",
  name: `${profile.basics.firstName} ${profile.basics.lastName}`.trim(),
  candidate: `${profile.basics.firstName} ${profile.basics.lastName}`.trim()
});

const fillCommonPlaceholders = (content: string, profile: UserProfile, job: JobPosting) => {
  const values = fallbackPlaceholderValues(profile, job);
  return content.replace(/(\{\{|\{|\[|<)\s*([a-z][a-z\s_-]{1,40})\s*(\}\}|\}|\]|>)/gi, (match, _open, rawKey: string) => {
    const key = rawKey.toLowerCase().replace(/[\s_-]+/g, "");
    const value = Object.entries(values).find(([candidate]) => candidate.replace(/[\s_-]+/g, "") === key)?.[1];
    return value || match;
  });
};

export const generateCoverLetter = (settings: AppSettings, profile: UserProfile, job: JobPosting) =>
  requestJson<CoverLetterResult>(settings, [
    {
      role: "system",
      content:
        "Generate a tailored cover letter using the candidate profile, job posting, and the candidate's coverLetterTemplate. The template may be Markdown. Return JSON: {\"coverLetter\":\"...\"}. Preserve Markdown formatting such as headings, paragraphs, bullet lists, emphasis, links, and line breaks when present. Keep the template's voice, structure, and reusable phrases, but adapt the content to the company, role, requirements, and candidate strengths. Do not invent credentials. Detect placeholders in formats like [Company], [Role], [Why this role], {Company}, {{Company}}, <Company>, or similar template tokens. Replace every placeholder with a specific value inferred from the job posting and candidate profile. If an exact value is unavailable, write a concise context-appropriate phrase instead of leaving the placeholder unchanged."
    },
    {
      role: "user",
      content: JSON.stringify({ profile, job, template: profile.coverLetterTemplate })
    }
  ]).then((result) => ({
    coverLetter: fillCommonPlaceholders(result.coverLetter, profile, job)
  }));
