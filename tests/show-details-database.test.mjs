import assert from "node:assert/strict";
import { before, after, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { storageFixture } from "./storage-fixture.mjs";
import { searchShowCities } from "../src/lib/show-city-catalog.ts";

const db = new PGlite();
const ids = { admin: "11111111-1111-4111-8111-111111111111", contributor: "33333333-3333-4333-8333-333333333333", viewer: "44444444-4444-4444-8444-444444444444" };
let showId, baseline, policies;
const snapshot = () => db.query("select to_jsonb(s) - 'key_personnel' - 'studio_site' - 'location_data' - 'legacy_location' as row from public.shows s where id=$1", [showId]);
async function as(role) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[role]]);
  await db.exec("set role authenticated");
}
before(async () => {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
    alter default privileges grant execute on functions to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;`);
  await storageFixture(db);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files.filter((name) => name < "202609190001")) await db.exec(await readFile(new URL(name, directory), "utf8"));
  for (const [role, id] of Object.entries(ids)) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${role}@test.invalid`]);
    await db.query("update public.profiles set role=$1::public.app_role,active=true where id=$2", [role, id]);
  }
  showId = (await db.query("insert into public.shows(title,location,status,created_by,updated_at,staffing_calendar_url) values('Legacy','  AMV 26 / NYC  ','published',$1,'2020-01-01','https://example.com/crew') returning id", [ids.admin])).rows[0].id;
  baseline = (await snapshot()).rows;
  policies = (await db.query("select * from pg_policies order by schemaname,tablename,policyname")).rows;
  await db.exec(await readFile(new URL("202609190001_show_personnel_locations.sql", directory), "utf8"));
});
after(() => db.close());

it("migration preserves legacy data verbatim, timestamps and every existing policy", async () => {
  assert.deepEqual((await snapshot()).rows, baseline);
  assert.deepEqual((await db.query("select key_personnel,studio_site,location_data,legacy_location from public.shows where id=$1", [showId])).rows[0], { key_personnel: [], studio_site: null, location_data: null, legacy_location: "  AMV 26 / NYC  " });
  assert.deepEqual((await db.query("select * from pg_policies order by schemaname,tablename,policyname")).rows, policies);
});
it("persists structured personnel, order and city independently of site; rejects malformed writes atomically", async () => {
  await as("admin");
  const city = searchShowCities("san mo").find((city) => city.display_name === "Santa Monica, CA");
  const people = ["Mike", "Jo"].map((name, position) => ({ id: crypto.randomUUID(), name, role: position ? "Custom show caller" : "Lighting Designer / LD", company: "Team", email: "", phone: "", notes: "", primary: position === 1, position }));
  await db.query("update public.shows set key_personnel=$1,location=$2,location_data=$3,studio_site='Santa Monica Beach' where id=$4", [JSON.stringify(people), city.display_name, JSON.stringify(city), showId]);
  const saved = (await db.query("select key_personnel,location_data,studio_site,legacy_location from public.shows where id=$1", [showId])).rows[0];
  assert.deepEqual(saved.key_personnel, people); assert.deepEqual(saved.location_data, city);
  assert.equal(saved.studio_site, "Santa Monica Beach"); assert.equal(saved.legacy_location, "  AMV 26 / NYC  ");
  for (const invalid of [{}, [null], [{ ...people[0], primary: "yes" }], [{ ...people[0], role: "" }], [{ ...people[0], email: "bad" }], [people[1]], [people[0], { ...people[0], position: 1 }]]) {
    await assert.rejects(() => db.query("update public.shows set key_personnel=$1,studio_site='Should roll back' where id=$2", [JSON.stringify(invalid), showId]), (error) => error.code === "23514");
  }
  for (const invalid of [{}, { ...city, latitude: 91 }, { ...city, longitude: null }, { ...city, display_name: "Spoofed" }]) await assert.rejects(() => db.query("update public.shows set location_data=$1 where id=$2", [JSON.stringify(invalid), showId]), (error) => error.code === "23514");
  assert.equal((await db.query("select studio_site from public.shows where id=$1", [showId])).rows[0].studio_site, "Santa Monica Beach");
  await db.query("update public.shows set key_personnel=$1 where id=$2", [JSON.stringify([{ ...people[1], position: 0 }]), showId]);
  assert.equal((await db.query("select key_personnel from public.shows where id=$1", [showId])).rows[0].key_personnel[0].name, "Jo");
});
it("keeps existing Show permissions and supports optional empty create/edit", async () => {
  await as("contributor");
  const own = (await db.query("insert into public.shows(title,created_by) values('No personnel',$1) returning id,key_personnel", [ids.contributor])).rows[0];
  assert.deepEqual(own.key_personnel, []);
  assert.equal((await db.query("update public.shows set studio_site='AMV 26' where id=$1 returning id", [own.id])).rows.length, 1);
  assert.equal((await db.query("update public.shows set key_personnel='[]' where id=$1 returning id", [showId])).rows.length, 0);
  await as("viewer");
  assert.equal((await db.query("select key_personnel from public.shows where id=$1", [showId])).rows.length, 1);
  assert.equal((await db.query("update public.shows set key_personnel='[]' where id=$1 returning id", [showId])).rows.length, 0);
  await db.exec("reset role; set role anon");
  try { assert.equal((await db.query("select * from public.shows")).rows.length, 0); } catch (error) { assert.equal(error.code, "42501"); }
});
