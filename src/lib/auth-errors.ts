import type { AuthError } from "@supabase/supabase-js";

export type EmailAuthMode = "sign-in" | "sign-up" | "reset";

type AuthErrorDetails = Pick<AuthError, "code" | "message" | "name" | "status"> & {
  reasons?: unknown;
};

function getDetails(error: unknown): AuthErrorDetails {
  if (!(error instanceof Error)) {
    return { code: undefined, message: "", name: "", status: undefined };
  }

  const details = error as AuthErrorDetails;
  return {
    code: typeof details.code === "string" ? details.code : undefined,
    message: error.message,
    name: error.name,
    status: typeof details.status === "number" ? details.status : undefined,
    reasons: details.reasons,
  };
}

function weakPasswordMessage(reasons: unknown) {
  const requirementList: string[] = [];
  const reasonList = Array.isArray(reasons) ? reasons : [];

  if (reasonList.includes("length")) {
    requirementList.push("at least 8 characters");
  }
  if (reasonList.includes("characters")) {
    requirementList.push("a stronger mix of letters, numbers, or symbols");
  }
  if (reasonList.includes("pwned")) {
    requirementList.push("a password that has not appeared in a known data breach");
  }

  if (requirementList.length === 0) {
    return "That password does not meet this project's requirements. Use at least 8 characters and avoid a commonly used password.";
  }

  return `Choose a password with ${requirementList.join(", ")}.`;
}

export function getEmailAuthErrorMessage(
  error: unknown,
  mode: EmailAuthMode,
) {
  if (error instanceof Error && error.name === "SupabaseConfigError") {
    return error.message;
  }

  const { code, message, name, reasons, status } = getDetails(error);
  const normalizedMessage = message.toLowerCase();

  if (
    name === "AuthRetryableFetchError" ||
    status === 0 ||
    code === "request_timeout" ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("network request failed")
  ) {
    return "T.I.K.I. could not reach Supabase. Check your internet connection and the Supabase project URL, then try again.";
  }

  if (
    normalizedMessage.includes("invalid api key") ||
    normalizedMessage.includes("no api key found")
  ) {
    return "The Supabase publishable key is invalid or does not belong to this project. Update .env.local, then restart T.I.K.I.";
  }

  if (
    code === "weak_password" ||
    name === "AuthWeakPasswordError"
  ) {
    return weakPasswordMessage(reasons);
  }

  if (
    mode === "sign-up" &&
    (code === "email_exists" ||
      code === "user_already_exists" ||
      code === "identity_already_exists" ||
      normalizedMessage.includes("already registered") ||
      normalizedMessage.includes("already exists"))
  ) {
    return "An account already exists for this email. Choose Sign in or use Forgot password.";
  }

  if (code === "invalid_credentials") {
    return "The email or password was not accepted.";
  }

  if (code === "email_not_confirmed") {
    return "Confirm this email address before signing in.";
  }

  if (code === "email_address_invalid") {
    return "Enter a valid email address.";
  }

  if (code === "signup_disabled") {
    return "New account creation is disabled in Supabase.";
  }

  if (code === "email_provider_disabled" || code === "provider_disabled") {
    return "Email sign-in is disabled in Supabase.";
  }

  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    status === 429
  ) {
    return "Too many attempts were made. Wait a few minutes, then try again.";
  }

  if (status && status >= 400 && status < 500) {
    const action =
      mode === "sign-up"
        ? "account creation"
        : mode === "reset"
          ? "password reset"
          : "sign-in";
    return `Supabase rejected the ${action} request. Check the information and try again.`;
  }

  return "T.I.K.I. could not complete the request. Please try again.";
}
