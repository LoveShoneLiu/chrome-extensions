import { analyzeJob, buildFillPlan, generateCoverLetter, parseResumeText } from "../ai/openai";
import { getProfile, getSettings, saveProfile } from "../storage/chromeStorage";
import type { ExtensionRequest } from "../types";

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
  const run = async () => {
    if (request.type === "ANALYZE_JOB") {
      const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
      const report = await analyzeJob(settings, profile, request.payload.job);
      return { ok: true, report };
    }

    if (request.type === "BUILD_FILL_PLAN") {
      const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
      const result = await buildFillPlan(settings, profile, request.payload.fields);
      return { ok: true, plan: result.plan };
    }

    if (request.type === "PARSE_RESUME_TEXT") {
      const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
      const result = await parseResumeText(settings, profile, request.payload.resumeText);
      const parsedProfile = {
        ...profile,
        ...result.profile,
        basics: { ...profile.basics, ...result.profile.basics },
        jobPreferences: profile.jobPreferences,
        workExperiences: result.profile.workExperiences ?? profile.workExperiences
      };
      await saveProfile(parsedProfile);
      return { ok: true, profile: parsedProfile };
    }

    if (request.type === "GENERATE_COVER_LETTER") {
      const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
      const result = await generateCoverLetter(settings, profile, request.payload.job);
      return { ok: true, coverLetter: result.coverLetter };
    }

    return { ok: false, error: "Unsupported background request." };
  };

  run()
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});
