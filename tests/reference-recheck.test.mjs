import assert from "node:assert/strict";
import { it } from "node:test";
import { recheckReference } from "../src/lib/reference-recheck.ts";

const record = { url: "https://public.com", status: "draft", created_by: "owner", updated_at: "2020-01-01T00:00:00Z" };
const check = { link_health: "redirected", last_checked_at: "2026-09-13T00:00:00Z", final_url: "https://public.com/new" };

it("manual Recheck persists the new result with optimistic concurrency and an audit note", async () => {
  let notes = 0, saves = 0;
  const result = await recheckReference("contributor","owner",record,{
    check: async url => { assert.equal(url,record.url); return check; },
    save: async (value,previous) => { assert.deepEqual(value,check); assert.equal(previous,record.updated_at); saves++; return true; },
    note: async text => { assert.match(text,/redirected/); notes++; return true; },
  });
  assert.equal(result.ok,true); assert.equal(saves,1); assert.equal(notes,1);
});
it("manual Recheck cannot be used to bypass contributor ownership or viewer restrictions", async () => {
  for (const [role,user] of [["viewer","owner"],["contributor","other"]]) {
    const result = await recheckReference(role,user,record,{check:()=>assert.fail("Must authorize before fetching")});
    assert.equal(result.ok,false);
  }
});
it("manual Recheck reports failed verification, stale writes and partial audit failures honestly", async () => {
  const dependencies = {check:async()=>({...check,link_health:"could_not_verify"}),save:async()=>true,note:async()=>true};
  const unverified = await recheckReference("editor","other",record,dependencies);
  assert.equal(unverified.ok,true); assert.match(unverified.message,/Couldn’t verify/);
  const stale = await recheckReference("editor","other",record,{...dependencies,save:async()=>false,note:()=>assert.fail("No revision after failed update")});
  assert.equal(stale.ok,false); assert.match(stale.message,/changed/);
  const partial = await recheckReference("admin","other",record,{...dependencies,note:async()=>false});
  assert.equal(partial.ok,true); assert.match(partial.message,/revision note could not/);
});
