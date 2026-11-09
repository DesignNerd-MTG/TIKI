import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import vm from "node:vm";
import ts from "typescript";

import * as http from "../src/lib/http.ts";
import { getPortalEntryRoute } from "../src/lib/auth-routing.ts";

const unsafeTargets = [
  "", "dashboard", "https://example.com", "http://example.com",
  "javascript:alert(1)", "//example.com", "///example.com",
  "/\\example.com", "/\\\\example.com", "\\/example.com",
  "/\t/example.com", "/\r/example.com", "/\n/example.com",
  " /dashboard", "/dashboard\\settings",
  ...Array.from({ length: 32 }, (_, code) => `/dashboard${String.fromCharCode(code)}`),
  "/dashboard\u007f",
];
const safeTargets = [
  "/", "/dashboard", "/pending", "/reset-password",
  "/admin?saved=1", "/login?error=auth_callback",
  "/links?collection=control-systems&q=light%20console#results",
  "/links?q=https%3A%2F%2Fexample.com%2Ffile&name=Front%20of%20House",
];

async function loadModule(path, dependencies) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, URL, Request, Response,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

async function callback({ configured = true, error = null } = {}) {
  const exchangedCodes = [];
  const { GET } = await loadModule("../src/app/auth/callback/route.ts", {
    "@/lib/http": http,
    "@/lib/supabase/config": { isSupabaseConfigured: () => configured },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          exchangeCodeForSession: async (code) => {
            exchangedCodes.push(code);
            return { error };
          },
        },
      }),
    },
  });
  return { GET, exchangedCodes };
}

function callbackRequest(next, { code = "confirmation-code", origin = "https://tiki.mtgdesigns.net" } = {}) {
  const url = new URL("/auth/callback", origin);
  if (code !== null) url.searchParams.set("code", code);
  if (next !== undefined) url.searchParams.set("next", next);
  return new Request(url);
}

describe("redirect path validation", () => {
  it("rejects external, slash-backslash and control-character destinations", () => {
    for (const target of unsafeTargets) {
      assert.throws(() => http.redirectToPath(target), /same-origin path/, JSON.stringify(target));
    }
  });

  it("preserves local navigation, queries, fragments and the visitor's origin", () => {
    for (const origin of ["https://tiki.mtgdesigns.net", "https://preview.example.net", "http://localhost:3001"]) {
      for (const target of safeTargets) {
        const response = http.redirectToPath(target);
        assert.equal(response.status, 303);
        assert.equal(response.headers.get("location"), target);
        assert.equal(new URL(response.headers.get("location"), origin).origin, origin);
      }
    }
  });
});

describe("authentication callback redirects", () => {
  it("finishes session exchange and falls back to the dashboard for unsafe destinations", async () => {
    const { GET, exchangedCodes } = await callback();
    for (const target of unsafeTargets) {
      const response = await GET(callbackRequest(target));
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), "/dashboard", JSON.stringify(target));
    }
    assert.equal(exchangedCodes.length, unsafeTargets.length);
    assert.ok(exchangedCodes.every((code) => code === "confirmation-code"));
  });

  it("rejects the percent-encoded bypasses after query parsing", async () => {
    const { GET } = await callback();
    for (const target of ["%2F%5Cexample.com", "%2F%09%2Fexample.com", "%2F%0D%2Fexample.com", "%2F%0A%2Fexample.com"]) {
      const response = await GET(new Request(`https://tiki.mtgdesigns.net/auth/callback?code=confirmation-code&next=${target}`));
      assert.equal(response.headers.get("location"), "/dashboard");
    }
  });

  it("preserves confirmation, password recovery and ordinary internal destinations", async () => {
    const { GET, exchangedCodes } = await callback();
    for (const target of safeTargets) {
      const response = await GET(callbackRequest(target));
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), target);
    }
    assert.equal(exchangedCodes.length, safeTargets.length);
  });

  it("defaults to the dashboard when next is absent", async () => {
    const { GET, exchangedCodes } = await callback();
    const response = await GET(callbackRequest(undefined));
    assert.equal(response.headers.get("location"), "/dashboard");
    assert.deepEqual(exchangedCodes, ["confirmation-code"]);
  });

  it("keeps missing-code and unconfigured errors on the login page without exchanging a code", async () => {
    for (const options of [{ configured: false }, { code: null }]) {
      const { GET, exchangedCodes } = await callback(options);
      const response = await GET(callbackRequest("/reset-password", options));
      assert.equal(response.headers.get("location"), "/login?error=auth_callback");
      assert.deepEqual(exchangedCodes, []);
    }
  });

  it("keeps failed exchanges on the login page, regardless of next", async () => {
    const { GET } = await callback({ error: { message: "Expired code" } });
    for (const next of ["/reset-password", "/\\example.com"]) {
      const response = await GET(callbackRequest(next));
      assert.equal(response.headers.get("location"), "/login?error=auth_callback");
    }
  });
});

describe("ordinary email sign-in", () => {
  it("still routes verified active and inactive accounts to their usual entry page", async () => {
    for (const active of [true, false]) {
      const calls = [];
      const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: { active, role: "viewer" } }) };
      const { emailAuthAction } = await loadModule("../src/app/login/actions.ts", {
        "next/cache": { revalidatePath: (...args) => calls.push(args) },
        "next/headers": { headers: () => { throw new Error("Sign-in should not need origin headers"); } },
        "next/navigation": { redirect: (path) => { throw new Error(`Redirect: ${path}`); } },
        "@/lib/auth-errors": { getEmailAuthErrorMessage: () => "Unexpected auth error" },
        "@/lib/auth-routing": { getPortalEntryRoute },
        "@/lib/supabase/server": {
          createClient: async () => ({
            auth: {
              signInWithPassword: async (credentials) => { calls.push({ ...credentials }); return { error: null }; },
              getClaims: async () => ({ data: { claims: { sub: "user-id" } }, error: null }),
            },
            from: () => query,
          }),
        },
      });
      const form = new FormData();
      form.set("mode", "sign-in");
      form.set("email", " Viewer@Example.com ");
      form.set("password", "test-password");
      await assert.rejects(emailAuthAction({}, form), { message: `Redirect: ${active ? "/dashboard" : "/pending"}` });
      assert.deepEqual(calls, [{ email: "viewer@example.com", password: "test-password" }, ["/", "layout"]]);
    }
  });
});
