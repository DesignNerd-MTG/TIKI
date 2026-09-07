import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canAccess, hasMinimumRole, roleLabel } from "../src/lib/access.ts";

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
