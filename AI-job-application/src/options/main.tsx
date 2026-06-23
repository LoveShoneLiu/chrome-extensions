import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { parseResumeText } from "../ai/openai";
import { extractPdfText } from "../pdf/extractPdfText";
import { clearAll, getProfile, getSettings, saveProfile, saveSettings } from "../storage/chromeStorage";
import { defaultBaseUrls, defaultModels, defaultProfile, defaultSettings } from "../storage/defaults";
import type { AppSettings, UserProfile } from "../types";
import "../styles.css";

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const joinList = (value: string[]) => value.join(", ");

type ModelOption = {
  group: string;
  label: string;
  value: string;
};

const providerLabels: Record<AppSettings["provider"], string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  gemini: "Google Gemini",
  anthropic: "Anthropic Claude",
  deepseek: "DeepSeek",
  dashscope: "Alibaba Qwen / DashScope",
  tencent: "Tencent Hunyuan",
  moonshot: "Moonshot Kimi"
};

const providerOptions = Object.entries(providerLabels) as Array<[AppSettings["provider"], string]>;

const openRouterModels: ModelOption[] = [
  { group: "OpenAI", label: "GPT-4.1 Mini", value: "openai/gpt-4.1-mini" },
  { group: "OpenAI", label: "GPT-4.1", value: "openai/gpt-4.1" },
  { group: "OpenAI", label: "GPT-4o Mini", value: "openai/gpt-4o-mini" },
  { group: "OpenAI", label: "GPT-4o", value: "openai/gpt-4o" },
  { group: "Anthropic", label: "Claude 3.7 Sonnet", value: "anthropic/claude-3.7-sonnet" },
  { group: "Anthropic", label: "Claude 3.5 Sonnet", value: "anthropic/claude-3.5-sonnet" },
  { group: "Google", label: "Gemini 2.5 Pro", value: "google/gemini-2.5-pro" },
  { group: "Google", label: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
  { group: "DeepSeek", label: "DeepSeek Chat", value: "deepseek/deepseek-chat" },
  { group: "DeepSeek", label: "DeepSeek R1", value: "deepseek/deepseek-r1" },
  { group: "Meta", label: "Llama 3.3 70B Instruct", value: "meta-llama/llama-3.3-70b-instruct" },
  { group: "Meta", label: "Llama 3.1 405B Instruct", value: "meta-llama/llama-3.1-405b-instruct" },
  { group: "Mistral", label: "Mistral Large", value: "mistralai/mistral-large" },
  { group: "Qwen", label: "Qwen 2.5 72B Instruct", value: "qwen/qwen-2.5-72b-instruct" }
];

const openAiModels: ModelOption[] = [
  { group: "OpenAI", label: "GPT-4.1 Mini", value: "gpt-4.1-mini" },
  { group: "OpenAI", label: "GPT-4.1", value: "gpt-4.1" },
  { group: "OpenAI", label: "GPT-4o Mini", value: "gpt-4o-mini" },
  { group: "OpenAI", label: "GPT-4o", value: "gpt-4o" },
  { group: "OpenAI Reasoning", label: "o3-mini", value: "o3-mini" },
  { group: "OpenAI Reasoning", label: "o3", value: "o3" }
];

const geminiModels: ModelOption[] = [
  { group: "Google", label: "Gemini 3.5 Flash", value: "gemini-3.5-flash" },
  { group: "Google", label: "Gemini 3.5 Pro", value: "gemini-3.5-pro" },
  { group: "Google", label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
  { group: "Google", label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" }
];

const anthropicModels: ModelOption[] = [
  { group: "Claude", label: "Claude 3.5 Sonnet Latest", value: "claude-3-5-sonnet-latest" },
  { group: "Claude", label: "Claude 3.5 Haiku Latest", value: "claude-3-5-haiku-latest" },
  { group: "Claude", label: "Claude 3 Opus Latest", value: "claude-3-opus-latest" }
];

const deepseekModels: ModelOption[] = [
  { group: "DeepSeek", label: "DeepSeek V4 Flash", value: "deepseek-v4-flash" },
  { group: "DeepSeek", label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
  { group: "DeepSeek", label: "DeepSeek Chat", value: "deepseek-chat" },
  { group: "DeepSeek", label: "DeepSeek Reasoner", value: "deepseek-reasoner" }
];

const dashscopeModels: ModelOption[] = [
  { group: "Alibaba Qwen", label: "Qwen Plus", value: "qwen-plus" },
  { group: "Alibaba Qwen", label: "Qwen Turbo", value: "qwen-turbo" },
  { group: "Alibaba Qwen", label: "Qwen Max", value: "qwen-max" },
  { group: "Alibaba Qwen", label: "Qwen Long", value: "qwen-long" }
];

const tencentModels: ModelOption[] = [
  { group: "Tencent Hunyuan", label: "Hunyuan TurboS Latest", value: "hunyuan-turbos-latest" },
  { group: "Tencent Hunyuan", label: "Hunyuan Turbo Latest", value: "hunyuan-turbo-latest" },
  { group: "Tencent Hunyuan", label: "Hunyuan Large", value: "hunyuan-large" },
  { group: "Tencent Hunyuan", label: "Hunyuan Standard", value: "hunyuan-standard" }
];

const moonshotModels: ModelOption[] = [
  { group: "Moonshot Kimi", label: "Moonshot v1 8K", value: "moonshot-v1-8k" },
  { group: "Moonshot Kimi", label: "Moonshot v1 32K", value: "moonshot-v1-32k" },
  { group: "Moonshot Kimi", label: "Moonshot v1 128K", value: "moonshot-v1-128k" },
  { group: "Moonshot Kimi", label: "Kimi Latest", value: "kimi-latest" }
];

const modelOptionsForProvider = (provider: AppSettings["provider"]) =>
  ({
    openrouter: openRouterModels,
    openai: openAiModels,
    gemini: geminiModels,
    anthropic: anthropicModels,
    deepseek: deepseekModels,
    dashscope: dashscopeModels,
    tencent: tencentModels,
    moonshot: moonshotModels
  })[provider];

const groupedModelOptions = (models: ModelOption[]) =>
  models.reduce<Record<string, ModelOption[]>>((groups, model) => {
    groups[model.group] = [...(groups[model.group] ?? []), model];
    return groups;
  }, {});

const defaultModelForProvider = (provider: AppSettings["provider"]) =>
  defaultModels[provider] || modelOptionsForProvider(provider)[0]?.value || "";

function Options() {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [resumeStatus, setResumeStatus] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");

  useEffect(() => {
    Promise.all([getProfile(), getSettings()]).then(([storedProfile, storedSettings]) => {
      setProfile(storedProfile);
      setSettings(storedSettings);
    });
  }, []);

  const updateBasics = (key: keyof UserProfile["basics"], value: string) => {
    setProfile((current) => ({ ...current, basics: { ...current.basics, [key]: value } }));
  };

  const updateWorkExperience = (
    index: number,
    key: keyof UserProfile["workExperiences"][number],
    value: string | string[]
  ) => {
    setProfile((current) => ({
      ...current,
      workExperiences: current.workExperiences.map((experience, itemIndex) =>
        itemIndex === index ? { ...experience, [key]: value } : experience
      )
    }));
  };

  const addWorkExperience = () => {
    setProfile((current) => ({
      ...current,
      workExperiences: [
        ...current.workExperiences,
        { company: "", title: "", startDate: "", endDate: "", location: "", description: "", highlights: [] }
      ]
    }));
  };

  const removeWorkExperience = (index: number) => {
    setProfile((current) => ({
      ...current,
      workExperiences: current.workExperiences.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const save = async () => {
    await Promise.all([saveProfile(profile), saveSettings(settings)]);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const reset = async () => {
    await clearAll();
    setProfile(defaultProfile);
    setSettings(defaultSettings);
  };

  const importResumePdf = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setResumeStatus("Please upload a PDF resume.");
      return;
    }

    try {
      setResumeStatus("Reading PDF text...");
      const resumeText = await extractPdfText(file);
      if (!resumeText) {
        throw new Error("No text was found in the PDF. Make sure this is not a scanned image-only resume.");
      }

      await Promise.all([saveProfile(profile), saveSettings(settings)]);
      setResumeStatus(`Structuring resume details with ${providerLabels[settings.provider]} (${settings.model}, up to 45s)...`);
      const result = await parseResumeText(settings, profile, resumeText);
      const parsedProfile = {
        ...profile,
        ...result.profile,
        basics: { ...profile.basics, ...result.profile.basics },
        jobPreferences: profile.jobPreferences,
        workExperiences: result.profile.workExperiences ?? profile.workExperiences
      };

      await saveProfile(parsedProfile);
      setProfile(parsedProfile);
      setResumeStatus("Resume parsed. Basic info, job search profile, work experience, and resume summary have been filled. Please review and save.");
    } catch (error) {
      setResumeStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const importCoverLetterTemplate = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const isMarkdownFile = /\.(md|markdown)$/i.test(file.name);
    if (!isMarkdownFile) {
      setTemplateStatus("Please upload a .md or .markdown template.");
      return;
    }

    try {
      const content = await file.text();
      if (!content.trim()) {
        throw new Error("The Markdown template is empty.");
      }

      setProfile((current) => ({ ...current, coverLetterTemplate: content }));
      setTemplateStatus(`Imported ${file.name}. Please review and save.`);
    } catch (error) {
      setTemplateStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const modelOptions = modelOptionsForProvider(settings.provider);
  const groupedModels = groupedModelOptions(modelOptions);
  const selectedModelPreset = modelOptions.some((model) => model.value === settings.model) ? settings.model : "";

  return (
    <main className="options shell">
      <header className="pageHeader">
        <h1>AI Job Assistant Settings</h1>
        <p>Your profile is stored only in local Chrome storage. Autofill creates a preview first and never submits applications automatically.</p>
      </header>

      <section className="settingsGrid">
        <div className="panel">
          <h2>Basic Info</h2>
          <div className="formGrid">
            <label>First name<input value={profile.basics.firstName} onChange={(event) => updateBasics("firstName", event.target.value)} /></label>
            <label>Last name<input value={profile.basics.lastName} onChange={(event) => updateBasics("lastName", event.target.value)} /></label>
            <label>Email<input value={profile.basics.email} onChange={(event) => updateBasics("email", event.target.value)} /></label>
            <label>Phone<input value={profile.basics.phone} onChange={(event) => updateBasics("phone", event.target.value)} /></label>
            <label>Location<input value={profile.basics.location} onChange={(event) => updateBasics("location", event.target.value)} /></label>
            <label>LinkedIn<input value={profile.basics.linkedin} onChange={(event) => updateBasics("linkedin", event.target.value)} /></label>
            <label>GitHub<input value={profile.basics.github} onChange={(event) => updateBasics("github", event.target.value)} /></label>
            <label>Website<input value={profile.basics.website} onChange={(event) => updateBasics("website", event.target.value)} /></label>
          </div>
        </div>

        <div className="panel">
          <h2>Job Search Profile</h2>
          <label>Headline<input value={profile.headline} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} /></label>
          <label>Target roles<input value={joinList(profile.targetRoles)} onChange={(event) => setProfile({ ...profile, targetRoles: splitList(event.target.value) })} /></label>
          <label>Skills<input value={joinList(profile.skills)} onChange={(event) => setProfile({ ...profile, skills: splitList(event.target.value) })} /></label>
          <label>Work authorization<input value={profile.workAuthorization} onChange={(event) => setProfile({ ...profile, workAuthorization: event.target.value })} /></label>
          <label>Availability<input value={profile.availability} onChange={(event) => setProfile({ ...profile, availability: event.target.value })} /></label>
          <label>Expected salary<input value={profile.expectedSalary} onChange={(event) => setProfile({ ...profile, expectedSalary: event.target.value })} /></label>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <h2>Work Experience</h2>
          <button type="button" className="secondary smallButton" onClick={addWorkExperience}>Add Experience</button>
        </div>
        {profile.workExperiences.length === 0 && (
          <p className="helperText">Upload a PDF resume to extract company, dates, job titles, and responsibilities automatically.</p>
        )}
        <div className="experienceList">
          {profile.workExperiences.map((experience, index) => (
            <div className="experienceItem" key={`${experience.company}-${experience.title}-${index}`}>
              <div className="sectionHeader">
                <h3>{experience.title || "Experience"}</h3>
                <button type="button" className="secondary smallButton" onClick={() => removeWorkExperience(index)}>Remove</button>
              </div>
              <div className="formGrid">
                <label>Company<input value={experience.company} onChange={(event) => updateWorkExperience(index, "company", event.target.value)} /></label>
                <label>Job title<input value={experience.title} onChange={(event) => updateWorkExperience(index, "title", event.target.value)} /></label>
                <label>Start date<input value={experience.startDate} onChange={(event) => updateWorkExperience(index, "startDate", event.target.value)} placeholder="Jan 2020" /></label>
                <label>End date<input value={experience.endDate} onChange={(event) => updateWorkExperience(index, "endDate", event.target.value)} placeholder="Present" /></label>
                <label>Location<input value={experience.location} onChange={(event) => updateWorkExperience(index, "location", event.target.value)} /></label>
                <label>Highlights<input value={joinList(experience.highlights)} onChange={(event) => updateWorkExperience(index, "highlights", splitList(event.target.value))} placeholder="Leadership, performance, architecture" /></label>
              </div>
              <label className="wideField">Responsibilities and description<textarea rows={4} value={experience.description} onChange={(event) => updateWorkExperience(index, "description", event.target.value)} /></label>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Resume Summary</h2>
        <div className="uploadRow">
          <label className="fileButton">
            Upload PDF Resume
            <input
              accept="application/pdf"
              type="file"
              onChange={(event) => {
                importResumePdf(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {resumeStatus && <span>{resumeStatus}</span>}
        </div>
        <textarea
          rows={9}
          value={profile.resumeSummary}
          onChange={(event) => setProfile({ ...profile, resumeSummary: event.target.value })}
          placeholder="Upload a PDF to generate this automatically, or add resume highlights, projects, and education manually."
        />
      </section>

      <section className="panel">
        <h2>Cover Letter Template</h2>
        <div className="uploadRow">
          <label className="fileButton">
            Upload Markdown Template
            <input
              accept=".md,.markdown,text/markdown,text/plain"
              type="file"
              onChange={(event) => {
                importCoverLetterTemplate(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {templateStatus && <span>{templateStatus}</span>}
        </div>
        <textarea
          rows={10}
          value={profile.coverLetterTemplate}
          onChange={(event) => setProfile({ ...profile, coverLetterTemplate: event.target.value })}
          placeholder="Paste your Markdown cover letter template here."
        />
        <p className="helperText">
          Markdown is supported, including headings, lists, paragraphs, and placeholders such as [Company], [Role], and [Why this role].
          Placeholders will be filled from the job posting and your profile when you generate a cover letter.
        </p>
      </section>

      <section className="panel">
        <h2>AI Settings</h2>
        <div className="formGrid">
          <label>
            API Provider
            <select
              value={settings.provider}
              onChange={(event) => {
                const provider = event.target.value as AppSettings["provider"];
                setSettings({
                  ...settings,
                  provider,
                  model: defaultModelForProvider(provider),
                  baseUrl: defaultBaseUrls[provider]
                });
              }}
            >
              {providerOptions.map(([provider, label]) => (
                <option key={provider} value={provider}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>{providerLabels[settings.provider]} API Key<input type="password" value={settings.openaiApiKey} onChange={(event) => setSettings({ ...settings, openaiApiKey: event.target.value })} /></label>
          <label>
            Popular model
            <select
              value={selectedModelPreset}
              onChange={(event) => {
                if (event.target.value) {
                  setSettings({ ...settings, model: event.target.value });
                }
              }}
            >
              <option value="">Custom model ID</option>
              {Object.entries(groupedModels).map(([group, models]) => (
                <optgroup key={group} label={group}>
                  {models.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>Model ID<input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} /></label>
          <label>Base URL<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} /></label>
        </div>
        <p className="helperText">
          OpenRouter supports many model providers through one API key. Direct providers use their own API keys. If a model is not listed, choose Custom model ID and paste the model slug from your provider.
        </p>
      </section>

      <footer className="footerActions">
        <button type="button" onClick={save}>Save Settings</button>
        <button type="button" className="secondary" onClick={reset}>Clear Local Data</button>
        {saved && <span>Saved</span>}
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Options />);
