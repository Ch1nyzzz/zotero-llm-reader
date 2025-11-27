import { config } from "../../package.json";

export type PrefKey =
  | "provider"
  | "apiKey"
  | "baseURL"
  | "model"
  | "timeout"
  | "maxTokens"
  | "temperature"
  | "stream"
  | "scope"
  | "promptRich"
  | "promptChat"
  | "outputLang"
  | "log";

export type OutputLang = "zh" | "en";

export const PREF_DEFAULTS: Record<PrefKey, any> = {
  provider: "openai",
  apiKey: "",
  baseURL: "",
  model: "",
  timeout: 60,
  maxTokens: 2048,
  temperature: 0.7,
  stream: true,
  scope: "full",
  promptRich: "",
  promptChat: "",
  outputLang: "zh",
  log: false,
};

function prefKey(key: PrefKey) {
  return `${config.prefsPrefix}.${key}`;
}

export function getPref<T = any>(key: PrefKey, fallback?: T): T {
  const value = Zotero.Prefs.get(prefKey(key), true);
  if (value === undefined || value === null || value === "") {
    return (fallback ?? (PREF_DEFAULTS[key] as T)) as T;
  }
  return value as T;
}

export function setPref(key: PrefKey, value: any) {
  Zotero.Prefs.set(prefKey(key), value, true);
}
