"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setComplete(true);
  }

  if (complete) {
    return (
      <div className="password-complete" role="status">
        <CheckCircle2 size={34} aria-hidden="true" />
        <h2>Password updated</h2>
        <p>Your new password is ready to use.</p>
        <Link className="primary-button" href="/dashboard">
          Continue to T.I.K.I. <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form update-password-form" onSubmit={submit}>
      <label htmlFor="new-password">New password</label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        disabled={loading}
      />
      <label htmlFor="confirm-new-password">Confirm new password</label>
      <input
        id="confirm-new-password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        required
        disabled={loading}
      />
      <p className="auth-form__hint">Use at least 8 characters.</p>
      {errorMessage && <div className="notice notice--error" role="alert">{errorMessage}</div>}
      <button className="primary-button auth-submit" type="submit" disabled={loading}>
        {loading && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
        {loading ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
