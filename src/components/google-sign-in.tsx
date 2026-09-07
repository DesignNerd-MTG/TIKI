"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export function GoogleSignIn({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signIn() {
    if (!configured) return;

    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sign-in could not start.");
      setLoading(false);
    }
  }

  return (
    <div className="sign-in-control">
      <button
        className="google-button"
        type="button"
        onClick={signIn}
        disabled={!configured || loading}
      >
        {loading ? (
          <LoaderCircle className="spin" size={19} aria-hidden="true" />
        ) : (
          <span className="google-g" aria-hidden="true">G</span>
        )}
        {loading ? "Opening Google…" : "Continue with Google"}
      </button>
      {message && <p className="form-error" role="alert">{message}</p>}
    </div>
  );
}
