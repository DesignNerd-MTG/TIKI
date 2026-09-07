"use client";

import { FormEvent, useActionState, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  LogIn,
  Mail,
  UserPlus,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  emailAuthAction,
  type EmailAuthActionState,
} from "@/app/login/actions";

type AuthMode = "sign-in" | "sign-up" | "reset";

const modeCopy: Record<AuthMode, { title: string; action: string }> = {
  "sign-in": { title: "Sign in", action: "Sign in" },
  "sign-up": { title: "Create account", action: "Create account" },
  reset: { title: "Reset password", action: "Send reset link" },
};

const initialAuthState: EmailAuthActionState = {};

export function EmailAuthForm({ configured }: { configured: boolean }) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authState, formAction, authPending] = useActionState(
    emailAuthAction,
    initialAuthState,
  );

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
    setErrorMessage(null);
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || resetLoading) return;

    setResetLoading(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;

      setMessage(
        "If an account exists for that address, Supabase will send a password-reset link.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The password reset could not start.",
      );
    } finally {
      setResetLoading(false);
    }
  }

  const loading = resetLoading || authPending;
  const actionState = authState.mode === mode ? authState : initialAuthState;
  const visibleMessage = message ?? actionState.message;
  const visibleError = errorMessage ?? actionState.error;

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

      <form
        className="auth-form"
        action={mode === "reset" ? undefined : formAction}
        onSubmit={mode === "reset" ? submitReset : undefined}
      >
        {mode !== "reset" && <input type="hidden" name="mode" value={mode} />}
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

        {visibleMessage && <div className="notice notice--success" role="status">{visibleMessage}</div>}
        {visibleError && <div className="notice notice--error" role="alert">{visibleError}</div>}

        <button className="primary-button auth-submit" type="submit" disabled={!configured || loading}>
          {submitIcon}
          {loading ? "Working…" : modeCopy[mode].action}
        </button>
      </form>
    </div>
  );
}
