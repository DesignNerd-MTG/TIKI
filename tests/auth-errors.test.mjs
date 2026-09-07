import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getEmailAuthErrorMessage } from "../src/lib/auth-errors.ts";
import { validateSupabaseConfig } from "../src/lib/supabase/config.ts";

function authError({ code, message, name = "AuthApiError", status = 400 }) {
  return Object.assign(new Error(message), { code, name, status });
}

describe("Supabase configuration", () => {
  it("identifies a missing project URL", () => {
    const status = validateSupabaseConfig(undefined, "sb_publishable_12345678901234567890");
    assert.equal(status.configured, false);
    assert.equal(status.code, "missing-url");
  });

  it("identifies an invalid project URL", () => {
    const status = validateSupabaseConfig(
      "not-a-url",
      "sb_publishable_12345678901234567890",
    );
    assert.equal(status.configured, false);
    assert.equal(status.code, "invalid-url");
  });

  it("identifies an invalid or secret key", () => {
    const status = validateSupabaseConfig(
      "https://project.supabase.co",
      "sb_secret_12345678901234567890",
    );
    assert.equal(status.configured, false);
    assert.equal(status.code, "invalid-key");
  });

  it("accepts a hosted project URL and publishable key", () => {
    const status = validateSupabaseConfig(
      "https://project.supabase.co",
      "sb_publishable_12345678901234567890",
    );
    assert.equal(status.configured, true);
  });
});

describe("email auth errors", () => {
  it("turns fetch failed into a useful network error", () => {
    const error = authError({
      message: "fetch failed",
      name: "AuthRetryableFetchError",
      status: 0,
    });
    assert.match(getEmailAuthErrorMessage(error, "sign-up"), /could not reach Supabase/);
  });

  it("distinguishes an invalid API key", () => {
    const error = authError({ message: "Invalid API key", status: 401 });
    assert.match(getEmailAuthErrorMessage(error, "sign-up"), /publishable key is invalid/);
  });

  it("gives an existing user a next step", () => {
    const error = authError({
      code: "user_already_exists",
      message: "User already registered",
    });
    assert.match(getEmailAuthErrorMessage(error, "sign-up"), /Choose Sign in/);
  });

  it("describes password requirements", () => {
    const error = Object.assign(new Error("Weak password"), {
      code: "weak_password",
      name: "AuthWeakPasswordError",
      reasons: ["length", "pwned"],
      status: 422,
    });
    const message = getEmailAuthErrorMessage(error, "sign-up");
    assert.match(message, /at least 8 characters/);
    assert.match(message, /known data breach/);
  });

  it("keeps invalid credentials separate from network errors", () => {
    const error = authError({
      code: "invalid_credentials",
      message: "Invalid login credentials",
    });
    assert.equal(
      getEmailAuthErrorMessage(error, "sign-in"),
      "The email or password was not accepted.",
    );
  });
});
