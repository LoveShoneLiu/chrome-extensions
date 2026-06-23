import { defaultBaseUrls, defaultModels, defaultProfile, defaultSettings } from "./defaults";
import type { AppSettings, StorageShape, UserProfile } from "../types";

const getStorage = async <T>(key: keyof StorageShape, fallback: T): Promise<T> => {
  if (!chrome?.storage?.local) {
    return fallback;
  }

  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
};

export const getProfile = async () => {
  const profile = await getStorage<Partial<UserProfile>>("profile", defaultProfile);
  return {
    ...defaultProfile,
    ...profile,
    basics: { ...defaultProfile.basics, ...profile.basics },
    jobPreferences: { ...defaultProfile.jobPreferences, ...profile.jobPreferences },
    workExperiences: profile.workExperiences ?? defaultProfile.workExperiences
  };
};

export const saveProfile = async (profile: UserProfile) => {
  await chrome.storage.local.set({ profile });
};

export const getSettings = async () => {
  const settings = await getStorage<Partial<AppSettings>>("settings", defaultSettings);
  const provider = settings.provider ?? defaultSettings.provider;
  return {
    ...defaultSettings,
    ...settings,
    provider,
    model: settings.model || defaultModels[provider],
    baseUrl: settings.baseUrl || defaultBaseUrls[provider]
  };
};

export const saveSettings = async (settings: AppSettings) => {
  await chrome.storage.local.set({ settings });
};

export const clearAll = async () => {
  await chrome.storage.local.clear();
};
