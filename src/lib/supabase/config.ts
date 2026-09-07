const urlVariable = "NEXT_PUBLIC_SUPABASE_URL";
const keyVariable = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const placeholderTokens = ["your-project-ref", "replace_me", "example"];

export type SupabaseConfigErrorCode =
  | "missing-url"
  | "missing-key"
  | "placeholder-values"
  | "invalid-url"
  | "invalid-key";

type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseConfigStatus =
  | { configured: true; config: SupabaseConfig }
  | {
      configured: false;
      code: SupabaseConfigErrorCode;
      message: string;
    };

export class SupabaseConfigError extends Error {
  readonly code: SupabaseConfigErrorCode;

  constructor(
    code: SupabaseConfigErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SupabaseConfigError";
    this.code = code;
  }
}

function isValidSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function decodeJwtPayload(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isValidPublicKey(value: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value)) return true;

  // Supabase still accepts the legacy browser-safe anon JWT. Explicitly reject
  // a service-role JWT because every NEXT_PUBLIC value is shipped to browsers.
  const payload = decodeJwtPayload(value);
  return payload?.role === "anon";
}

export function validateSupabaseConfig(
  urlValue: string | undefined,
  keyValue: string | undefined,
): SupabaseConfigStatus {
  const url = urlValue?.trim() ?? "";
  const publishableKey = keyValue?.trim() ?? "";

  if (!url) {
    return {
      configured: false,
      code: "missing-url",
      message: `Server setup is missing ${urlVariable}. Add it to .env.local, then restart T.I.K.I.`,
    };
  }

  if (!publishableKey) {
    return {
      configured: false,
      code: "missing-key",
      message: `Server setup is missing ${keyVariable}. Add it to .env.local, then restart T.I.K.I.`,
    };
  }

  if (
    placeholderTokens.some(
      (token) =>
        url.toLowerCase().includes(token) ||
        publishableKey.toLowerCase().includes(token),
    )
  ) {
    return {
      configured: false,
      code: "placeholder-values",
      message:
        "Supabase still has example values. Copy the Project URL and publishable key from the TIKI project, then restart T.I.K.I.",
    };
  }

  if (!isValidSupabaseUrl(url)) {
    return {
      configured: false,
      code: "invalid-url",
      message:
        "NEXT_PUBLIC_SUPABASE_URL is not a valid project URL. Copy the Project URL from Supabase, then restart T.I.K.I.",
    };
  }

  if (!isValidPublicKey(publishableKey)) {
    return {
      configured: false,
      code: "invalid-key",
      message:
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a valid browser-safe Supabase key. Copy the publishable key from the same project, then restart T.I.K.I.",
    };
  }

  return { configured: true, config: { url, publishableKey } };
}

export function getSupabaseConfigStatus() {
  return validateSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function isSupabaseConfigured() {
  return getSupabaseConfigStatus().configured;
}

export function getSupabaseConfig() {
  const status = getSupabaseConfigStatus();

  if (!status.configured) {
    throw new SupabaseConfigError(status.code, status.message);
  }

  return status.config;
}
