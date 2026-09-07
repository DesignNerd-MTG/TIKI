"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  LogIn,
  Mail,
  UserPlus,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up" | "reset";

const modeCopy: Record<AuthMode, { title: string; action: string }> = {
  "sign-in": { title: "Sign in", action: "Sign in" },
  "sign-up": { title: "Create account", action: "Create account" },
  reset: { title: "Reset password", action: "Send reset link" },
};

export function EmailAuthForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
    setErrorMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || loading) return;

    setLoading(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;

        setMessage(
          "If an account exists for that address, Supabase will send a password-reset link.",
        );
        return;
      }

      if (mode === "sign-up") {
        if (password !== confirmPassword) {
          throw new Error("The two passwords do not match.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/pending`,
          },
        });
        if (error) throw error;

        if (data.session) {
          router.replace("/pending");
          router.refresh();
          return;
        }

        setMessage(
          "Account created. Check your email to confirm the address, then sign in. An administrator must still activate T.I.K.I. access.",
        );
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : `${modeCopy[mode].title} could not complete.`,
      );
    } finally {
      setLoading(false);
    }
  }

  const submitIcon = loading ? (
    <LoaderCircle className="spin" size={18} aria-hidden="true" />
  ) : mode === "sign-up" ? (
    <UserPlus size={18} aria-hidden="true" />
  ) : mode === "reset" ? (
    <Mail size={18} aria-hidden="true" />
  ) : (
    <LogIn size={18} aria-hidden="true" />
  );

  return (
    <div className="email-auth">
      {mode !== "reset" && (
        <div className="auth-mode" role="tablist" aria-label="Account action">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign-in"}
            className={mode === "sign-in" ? "auth-mode__button auth-mode__button--active" : "auth-mode__button"}
            onClick={() => changeMode("sign-in")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sign-up"}
            className={mode === "sign-up" ? "auth-mode__button auth-mode__button--active" : "auth-mode__button"}
            onClick={() => changeMode("sign-up")}
          >
            Create account
          </button>
        </div>
      )}

      {mode === "reset" && (
        <button className="auth-back" type="button" onClick={() => changeMode("sign-in")}>
          <ArrowLeft size={15} aria-hidden="true" /> Back to sign in
        </button>
      )}

      <form className="auth-form" onSubmit={submit}>
        {mode === "reset" && (
          <div className="auth-form__heading">
            <span><KeyRound size={18} aria-hidden="true" /></span>
            <div>
              <strong>Reset your password</strong>
              <small>We’ll email a secure link if the account exists.</small>
            </div>
          </div>
        )}

        <label htmlFor="auth-email">Email address</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          required
          disabled={!configured || loading}
        />

        {mode !== "reset" && (
          <>
            <div className="auth-label-row">
              <label htmlFor="auth-password">Password</label>
              {mode === "sign-in" && (
                <button type="button" onClick={() => changeMode("reset")}>
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              disabled={!configured || loading}
            />
          </>
        )}

        {mode === "sign-up" && (
          <>
            <label htmlFor="auth-confirm-password">Confirm password</label>
            <input
              id="auth-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
              disabled={!configured || loading}
            />
            <p className="auth-form__hint">Use at least 8 characters. Signing up does not automatically grant portal access.</p>
          </>
        )}

        {message && <div className="notice notice--success" role="status">{message}</div>}
        {errorMessage && <div className="notice notice--error" role="alert">{errorMessage}</div>}

        <button className="primary-button auth-submit" type="submit" disabled={!configured || loading}>
          {submitIcon}
          {loading ? "Working…" : modeCopy[mode].action}
        </button>
      </form>
    </div>
  );
}
