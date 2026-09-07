"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getEmailAuthErrorMessage } from "@/lib/auth-errors";
import { getPortalEntryRoute } from "@/lib/auth-routing";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export type EmailAuthActionState = {
  mode?: "sign-in" | "sign-up";
  message?: string;
  error?: string;
};

function confirmationRedirect(origin: string | null) {
  if (!origin) return undefined;

  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return new URL("/auth/callback?next=/pending", url.origin).toString();
  } catch {
    return undefined;
  }
}

export async function emailAuthAction(
  _previousState: EmailAuthActionState,
  formData: FormData,
): Promise<EmailAuthActionState> {
  const requestedMode = String(formData.get("mode") ?? "");
  const mode = requestedMode === "sign-up" ? "sign-up" : "sign-in";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { mode, error: "Enter both an email address and password." };
  }

  if (password.length < 8) {
    return { mode, error: "Use a password with at least 8 characters." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    return { mode, error: getEmailAuthErrorMessage(error, mode) };
  }

  if (mode === "sign-up") {
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      return { mode, error: "The two passwords do not match." };
    }

    const requestHeaders = await headers();
    const emailRedirectTo = confirmationRedirect(requestHeaders.get("origin"));
    let result;
    try {
      result = await supabase.auth.signUp({
        email,
        password,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
    } catch (error) {
      return { mode, error: getEmailAuthErrorMessage(error, mode) };
    }

    const { data, error } = result;

    if (error) {
      return { mode, error: getEmailAuthErrorMessage(error, mode) };
    }

    if (data.user && data.user.identities?.length === 0) {
      return {
        mode,
        error:
          "An account already exists for this email. Choose Sign in or use Forgot password.",
      };
    }

    if (data.session) {
      revalidatePath("/", "layout");
      redirect("/pending");
    }

    return {
      mode,
      message:
        "Account created. Check your email to confirm the address, then sign in. An administrator must still activate T.I.K.I. access.",
    };
  }

  let signInResult;
  try {
    signInResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });
  } catch (error) {
    return { mode, error: getEmailAuthErrorMessage(error, mode) };
  }

  if (signInResult.error) {
    return {
      mode,
      error: getEmailAuthErrorMessage(signInResult.error, mode),
    };
  }

  // Verify the cookie-backed identity before deciding where the account belongs.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    if (claimsError?.name === "AuthRetryableFetchError") {
      return { mode, error: getEmailAuthErrorMessage(claimsError, mode) };
    }

    await supabase.auth.signOut();
    return {
      mode,
      error: "The session could not be verified. Please sign in again.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active,role")
    .eq("id", userId)
    .maybeSingle();

  const typedProfile = profile as { active: boolean; role: AppRole } | null;
  revalidatePath("/", "layout");
  redirect(getPortalEntryRoute(true, typedProfile));
}
