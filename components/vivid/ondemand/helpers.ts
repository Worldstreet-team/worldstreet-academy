// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseConfig(config: any): Record<string, any> {
  if (!config) return {}
  if (typeof config === "string") {
    try { return JSON.parse(config) } catch { return {} }
  }
  return config
}

export const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
]
