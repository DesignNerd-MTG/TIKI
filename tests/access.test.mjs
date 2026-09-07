import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canAccess, hasMinimumRole, roleLabel } from "../src/lib/access.ts";
import { getPortalEntryRoute } from "../src/lib/auth-routing.ts";

describe("role access", () => {
  it("keeps the role hierarchy ordered", () => {
    assert.equal(hasMinimumRole("viewer", "contributor"), false);
    assert.equal(hasMinimumRole("editor", "contributor"), true);
    assert.equal(hasMinimumRole("admin", "admin"), true);
  });

  it("requires an activated profile", () => {
    assert.equal(canAccess({ active: false, role: "admin" }, "viewer"), false);
    assert.equal(canAccess({ active: true, role: "viewer" }, "viewer"), true);
  });

  it("formats role labels", () => {
    assert.equal(roleLabel("contributor"), "Contributor");
  });
});

describe("portal entry routing", () => {
  it("allows an active admin profile into the dashboard", () => {
    assert.equal(
      getPortalEntryRoute(true, { active: true, role: "admin" }),
      "/dashboard",
    );
  });

  it("sends an inactive profile to Access Pending", () => {
    assert.equal(
      getPortalEntryRoute(true, { active: false, role: "viewer" }),
      "/pending",
    );
  });

  it("sends a missing session to login", () => {
    assert.equal(
      getPortalEntryRoute(false, { active: true, role: "admin" }),
      "/login",
    );
  });

  it("sends an authenticated account with no profile to Access Pending", () => {
    assert.equal(getPortalEntryRoute(true, null), "/pending");
  });
});
