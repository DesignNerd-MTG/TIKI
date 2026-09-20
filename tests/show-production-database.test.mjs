import assert from "node:assert/strict";
import { before, after, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { storageFixture } from "./storage-fixture.mjs";

const db = new PGlite();
const ids = { admin: crypto.randomUUID(), contributor: crypto.randomUUID(), viewer: crypto.randomUUID() };
let showId, locationId, privateLocationId, baseline, policies;
async function as(role) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[role]]);
  await db.exec("set role authenticated");
}
const save = (id, fields, stops = []) => db.query("select * from public.save_show_production($1,$2,$3)", [id, JSON.stringify(fields), JSON.stringify(stops)]);
before(async () => {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
    alter default privileges grant execute on functions to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;`);
  await storageFixture(db);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((n) => n.endsWith(".sql") && n < "202609200001").sort()) await db.exec(await readFile(new URL(name, directory), "utf8"));
  for (const [role, id] of Object.entries(ids)) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${role}@test.invalid`]);
    await db.query("update public.profiles set role=$1::public.app_role,active=true where id=$2", [role, id]);
  }
  showId = (await db.query("insert into public.shows(title,location,summary,status,created_by) values('Original','Legacy city','A memory','published',$1) returning id", [ids.admin])).rows[0].id;
  locationId = (await db.query("insert into public.locations(name,city,status,created_by) values('Studio A','Brooklyn','published',$1) returning id", [ids.admin])).rows[0].id;
  privateLocationId = (await db.query("insert into public.locations(name,city,status,created_by) values('Private venue','Secret city','draft',$1) returning id", [ids.admin])).rows[0].id;
  baseline = (await db.query("select to_jsonb(s) as row from public.shows s")).rows;
  policies = (await db.query("select * from pg_policies where tablename in ('shows','locations') order by tablename,policyname")).rows;
  await db.exec(await readFile(new URL("202609200001_show_production_archive.sql", directory), "utf8"));
});
after(() => db.close());

it("preserves every Show field, timestamp and original policy", async () => {
  assert.deepEqual((await db.query("select to_jsonb(s)-'producer'-'network_brand'-'google_photos_url'-'primary_location_id' as row from public.shows s")).rows, baseline);
  assert.deepEqual((await db.query("select * from pg_policies where tablename in ('shows','locations') order by tablename,policyname")).rows, policies);
});
it("atomically saves production fields and ordered stops, preserving omitted legacy fields", async () => {
  await as("admin");
  const stops = [{ location_id: locationId, start_date: "2020-01-01", end_date: "2020-01-03" }, { location_id: locationId, start_date: "2020-02-01", end_date: "" }];
  await save(showId, { producer: "Producer A", network_brand: "Brand B", primary_location_id: locationId, google_photos_url: "https://photos.app.goo.gl/album" }, stops);
  assert.equal((await db.query("select location from public.shows where id=$1", [showId])).rows[0].location, "Legacy city");
  assert.deepEqual((await db.query("select position from public.show_stops where show_id=$1 order by position", [showId])).rows.map((r) => r.position), [0, 1]);
  await assert.rejects(() => save(showId, { title: "Must roll back" }, [{ location_id: crypto.randomUUID() }]));
  assert.equal((await db.query("select title from public.shows where id=$1", [showId])).rows[0].title, "Original");
  assert.equal((await db.query("select * from public.show_stops where show_id=$1", [showId])).rows.length, 2);
  await assert.rejects(() => save(showId, { google_photos_url: "https://evil.com" }));
  await assert.rejects(() => db.query("delete from public.locations where id=$1", [locationId]));
  await save(showId, { producer: "Producer A" }, [stops[1]]);
  assert.equal((await db.query("select * from public.show_stops where show_id=$1", [showId])).rows.length, 1);
});
it("archive reads current canonical location, notes, people and respects viewer RLS", async () => {
  await as("admin");
  await db.query("update public.locations set city='Queens' where id=$1", [locationId]);
  await as("viewer");
  const record = (await db.query("select * from public.show_production_history where id=$1", [showId])).rows[0];
  assert.equal(record.primary_city, "Queens");
  assert.match(record.search_text, /Producer A/); assert.match(record.search_text, /A memory/);
  await assert.rejects(() => save(showId, { title: "Viewer edit" }));
  await assert.rejects(() => db.query("insert into public.show_stops values($1,5,$2,null,null)", [showId, locationId]));
  await as("admin");
  await save(showId, { primary_location_id: privateLocationId }, [{ location_id: privateLocationId }]);
  await as("viewer");
  const restricted = (await db.query("select * from public.show_production_history where id=$1", [showId])).rows[0];
  assert.equal(restricted.primary_location_name, null);
  assert.doesNotMatch(restricted.search_text, /Secret city|Private venue/);
});
it("supports contributor draft creation/submission, rejects hidden locations and unrelated writes", async () => {
  await as("contributor");
  const created = (await save(null, { title: "Draft", status: "draft", primary_location_id: locationId }, [{ location_id: locationId }])).rows[0].id;
  await save(created, { status: "submitted" }, [{ location_id: locationId }]);
  await assert.rejects(() => save(created, { primary_location_id: privateLocationId }));
  await assert.rejects(() => save(created, { title: "No" }, [{ location_id: privateLocationId }]));
  await assert.rejects(() => save(showId, { title: "No" }));
  await assert.rejects(() => save(null, { title: "No", status: "published" }));
  await as("viewer");
  assert.equal((await db.query("select * from public.show_production_history where id=$1", [created])).rows.length, 0);
  await db.exec("reset role; set role anon");
  await assert.rejects(() => db.query("select * from public.show_production_history"));
  await assert.rejects(() => save(null, { title: "Anon" }));
});
