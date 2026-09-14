/**
 * ISO 3166-1 alpha-2 country codes — all 249 officially assigned — with
 * English names from the runtime's built-in `Intl.DisplayNames`, so there is
 * no dependency and no hand-kept name table. `User.country` stores the code;
 * pages print the name. Client-safe: no server imports.
 */
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const

export type CountryCode = (typeof COUNTRY_CODES)[number]

const CODE_SET: ReadonlySet<string> = new Set(COUNTRY_CODES)

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && CODE_SET.has(value)
}

let displayNames: Intl.DisplayNames | null = null

/** English name for a stored code ("NG" → "Nigeria"); null for null or an unknown code. */
export function countryName(code: string | null | undefined): string | null {
  if (!isCountryCode(code)) return null
  if (!displayNames) displayNames = new Intl.DisplayNames(["en"], { type: "region" })
  return displayNames.of(code) ?? code
}

export type CountryOption = { value: CountryCode; label: string }

/**
 * Every country as a select option, sorted by English name. Compute it on the
 * server and pass it down wherever the select is server-rendered — the
 * browser's ICU data can name a country differently from Node's.
 */
export function countryOptions(): CountryOption[] {
  return COUNTRY_CODES.map((code) => ({ value: code, label: countryName(code) ?? code })).sort((a, b) =>
    a.label.localeCompare(b.label, "en")
  )
}
