import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { storageFixture } from "./storage-fixture.mjs";

const db = new PGlite();
const ids = { admin: "11111111-1111-4111-8111-111111111111", editor: "22222222-2222-4222-8222-222222222222", contributor: "33333333-3333-4333-8333-333333333333", viewer: "44444444-4444-4444-8444-444444444444", pending: "55555555-5555-4555-8555-555555555555" };
let legacyId, baseline, policies, resources, manufacturerId;
const snapshot = () => db.query("select to_jsonb(f) - 'weight_lb' - 'ip_rating' as row from public.fixtures f where id=$1", [legacyId]);
const policySnapshot = () => db.query("select * from pg_policies order by schemaname,tablename,policyname");
async function as(role) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[role]]); await db.exec("set role authenticated"); }
before(async () => {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
    alter default privileges grant execute on functions to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;`);
  await storageFixture(db);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const migrations = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of migrations.filter((name) => name < "202609140014")) await db.exec(await readFile(new URL(name, directory), "utf8"));
  for (const [role, id] of Object.entries(ids)) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${role}@test.invalid`]);
    await db.query("update public.profiles set role=$1::public.app_role,active=$2 where id=$3", [role === "pending" ? "viewer" : role, role !== "pending", id]);
  }
  manufacturerId = (await db.query("select id from public.fixture_manufacturers where name='ETC'")).rows[0].id;
  legacyId = (await db.query(`insert into public.fixtures(name,manufacturer,manufacturer_id,fixture_type,preferred_mode,dmx_footprint,typical_use,status,created_by,created_at,updated_at,ies_url,photometrics_url)
    values('Legacy preserved','ETC',$1,'Battens & Tubes','Mode A',35,'Keep legacy use','published',$2,'2020-01-02T03:04:05.123456Z','2021-02-03T04:05:06.654321Z','https://example.com/a.ies','https://example.com/photo') returning id`, [manufacturerId, ids.admin])).rows[0].id;
  await db.query("insert into public.additional_links(entity_kind,entity_id,section,label,url,position,created_by) values('fixture',$1,'fixture','Firmware','https://example.com/firmware',0,$2)", [legacyId, ids.admin]);
  await db.query("insert into public.revision_notes(entity_kind,entity_id,summary,created_by) values('fixture',$1,'Keep history',$2)", [legacyId, ids.admin]);
  baseline = (await snapshot()).rows; policies = (await policySnapshot()).rows;
  resources = (await db.query("select row_to_json(a) as row from public.additional_links a union all select row_to_json(r) from public.revision_notes r")).rows;
  await db.exec(await readFile(new URL("202609140014_fixture_physical_specs.sql", directory), "utf8"));
});
after(async () => db.close());
describe("Fixture physical forward migration and RLS", () => {
  it("preserves every legacy field, IDs, exact timestamps, history and resources; new fields are null", async () => {
    assert.deepEqual((await snapshot()).rows, baseline);
    assert.deepEqual((await db.query("select weight_lb,ip_rating from public.fixtures where id=$1", [legacyId])).rows, [{ weight_lb: null, ip_rating: null }]);
    assert.deepEqual((await db.query("select row_to_json(a) as row from public.additional_links a union all select row_to_json(r) from public.revision_notes r")).rows, resources);
    assert.deepEqual((await policySnapshot()).rows, policies);
  });
  it("enforces optional clean numeric weight and controlled IP at the database boundary", async () => {
    for (const weight of ["-1", "0", "10001", "NaN", "Infinity", "-Infinity"]) await assert.rejects(() => db.query("update public.fixtures set weight_lb=$1 where id=$2", [weight, legacyId]), (error) => error.code === "23514");
    for (const ip of ["junk", "IP65+", "65"]) await assert.rejects(() => db.query("update public.fixtures set ip_rating=$1 where id=$2", [ip, legacyId]), (error) => error.code === "23514");
    assert.deepEqual((await snapshot()).rows, baseline);
  });
  it("contributors create/edit own working specs but cannot modify other or publish", async () => {
    await as("contributor");
    const id = (await db.query("insert into public.fixtures(name,manufacturer,manufacturer_id,status,created_by,weight_lb,ip_rating) values('Working','ETC',$1,'draft',$2,53.6,'IP65') returning id", [manufacturerId, ids.contributor])).rows[0].id;
    const changed = (await db.query("update public.fixtures set weight_lb=54.25,ip_rating='IP66' where id=$1 returning weight_lb,ip_rating", [id])).rows[0];
    assert.equal(Number(changed.weight_lb), 54.25); assert.equal(changed.ip_rating, "IP66");
    assert.equal((await db.query("update public.fixtures set weight_lb=1 where id=$1 returning id", [legacyId])).rows.length, 0);
    await assert.rejects(() => db.query("update public.fixtures set status='published' where id=$1", [id]), (error) => error.code === "42501");
    await db.exec("reset role"); await db.query("delete from public.fixtures where id=$1", [id]);
  });
  it("viewer reads published specs without writes; pending/anonymous cannot read them", async () => {
    await as("viewer"); assert.equal((await db.query("select weight_lb from public.fixtures where id=$1", [legacyId])).rows.length, 1);
    assert.equal((await db.query("update public.fixtures set weight_lb=1 where id=$1 returning id", [legacyId])).rows.length, 0);
    await assert.rejects(() => db.query("insert into public.fixtures(name,manufacturer,status,created_by) values('No','ETC','draft',$1)", [ids.viewer]), (error) => error.code === "42501");
    await as("pending"); assert.equal((await db.query("select * from public.fixtures")).rows.length, 0);
    await db.exec("reset role; set role anon");
    try { assert.equal((await db.query("select * from public.fixtures")).rows.length, 0); } catch (error) { assert.equal(error.code, "42501"); }
    await db.exec("reset role");
  });
  it("Editor/Admin edits retain normal timestamp updates, nullable removal and search", async () => {
    for (const role of ["editor", "admin"]) {
      await as(role);
      const row = (await db.query("update public.fixtures set weight_lb=53.6,ip_rating='IP65' where id=$1 returning weight_lb,updated_at", [legacyId])).rows[0];
      assert.equal(Number(row.weight_lb), 53.6); assert.notEqual(new Date(row.updated_at).getUTCFullYear(), 2021);
      assert.equal((await db.query("select id from public.search_fixtures('Battens & Tubes')")).rows[0].id, legacyId);
    }
    await db.query("update public.fixtures set weight_lb=null,ip_rating=null where id=$1", [legacyId]);
    await db.exec("reset role"); assert.deepEqual((await policySnapshot()).rows, policies);
  });
});
