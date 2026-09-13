import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import { storageFixture } from "./storage-fixture.mjs";

const db = new PGlite();
const ids = {
  admin: "11111111-1111-4111-8111-111111111111",
  editor: "22222222-2222-4222-8222-222222222222",
  contributor: "33333333-3333-4333-8333-333333333333",
  viewer: "44444444-4444-4444-8444-444444444444",
  clay: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  hes: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  chauvet: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};
let migrationSql = "";
let beforeResources;

async function as(role) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[role]]);
  await db.exec("set role authenticated");
}

before(async () => {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
    alter default privileges grant execute on functions to anon, authenticated, service_role;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  await storageFixture(db);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const migrations = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of migrations) {
    const sql = await readFile(new URL(name, directory), "utf8");
    if (name === "202609140013_fixture_manufacturer_taxonomy.sql") migrationSql = sql;
    else await db.exec(sql);
  }

  for (const [role, id] of Object.entries(ids).filter(([role]) => ["admin", "editor", "contributor", "viewer"].includes(role))) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${role}@test.invalid`]);
    await db.query("update public.profiles set role=$1::public.app_role,active=true where id=$2", [role, id]);
  }

  const fixtureSql = `insert into public.fixtures
    (id,name,manufacturer,fixture_type,preferred_mode,dmx_footprint,typical_use,status,created_by,created_at,updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,'published',$8,'2024-01-02T03:04:05Z','2024-02-03T04:05:06Z')`;
  await db.query(fixtureSql, [ids.clay, "Scenius", "Clay Paky", "Wash Bricks", "Extended", 42, "Legacy use", ids.viewer]);
  await db.query(fixtureSql, [ids.hes, "SolaFrame", "HES", "Mover Profile", "Standard", 36, "Keep me", ids.viewer]);
  await db.query(fixtureSql, [ids.chauvet, "Unknown Chauvet", "Chauvet", "LED PAR", "", 8, "Ambiguous", ids.viewer]);
  await db.query("insert into public.additional_links(entity_kind,entity_id,section,label,url,position,created_by) values('fixture',$1,'fixture','Firmware','https://example.com/firmware',0,$2)", [ids.clay, ids.viewer]);
  beforeResources = (await db.query("select entity_kind,entity_id,section,label,url,position,created_by from public.additional_links order by id")).rows;
  await db.exec(migrationSql);
});

after(async () => db.close());

describe("Fixture manufacturer PostgreSQL migration and RLS", () => {
  it("seeds 48 canonical manufacturers with deliberate brand separation", async () => {
    const rows = (await db.query("select name from public.fixture_manufacturers order by name")).rows.map((row) => row.name);
    assert.equal(rows.length, 48);
    for (const name of ["Chauvet DJ", "Chauvet Professional", "ADJ", "Elation", "ETC", "High End Systems", "Vari-Lite", "Strand"]) assert.ok(rows.includes(name));
    assert.equal(rows.includes("Chauvet"), false);
  });

  it("normalizes deterministic aliases, preserves ambiguous text, IDs, timestamps, and legacy fields", async () => {
    const rows = (await db.query("select id,name,manufacturer,manufacturer_id,fixture_type,dmx_footprint,typical_use,created_at,updated_at from public.fixtures order by id")).rows;
    assert.equal(rows.length, 3);
    const clay = rows.find((row) => row.id === ids.clay);
    const hes = rows.find((row) => row.id === ids.hes);
    const chauvet = rows.find((row) => row.id === ids.chauvet);
    assert.equal(clay.manufacturer, "Claypaky");
    assert.ok(clay.manufacturer_id);
    assert.equal(clay.fixture_type, "Battens & Tubes");
    assert.equal(clay.dmx_footprint, 42);
    assert.equal(clay.typical_use, "Legacy use");
    assert.equal(new Date(clay.created_at).toISOString(), "2024-01-02T03:04:05.000Z");
    assert.equal(new Date(clay.updated_at).toISOString(), "2024-02-03T04:05:06.000Z");
    assert.equal(hes.manufacturer, "High End Systems");
    assert.ok(hes.manufacturer_id);
    assert.equal(chauvet.manufacturer, "Chauvet");
    assert.equal(chauvet.manufacturer_id, null);
  });

  it("is idempotent and leaves existing fixture resources untouched", async () => {
    const before = (await db.query("select id,name,manufacturer,manufacturer_id,fixture_type,dmx_footprint,typical_use,created_at,updated_at from public.fixtures order by id")).rows;
    await db.exec(migrationSql);
    const afterRows = (await db.query("select id,name,manufacturer,manufacturer_id,fixture_type,dmx_footprint,typical_use,created_at,updated_at from public.fixtures order by id")).rows;
    assert.deepEqual(afterRows, before);
    assert.deepEqual((await db.query("select entity_kind,entity_id,section,label,url,position,created_by from public.additional_links order by id")).rows, beforeResources);
    assert.equal(Number((await db.query("select count(*) as count from public.fixture_manufacturers")).rows[0].count), 48);
  });

  it("searches canonical manufacturer aliases and the renamed category", async () => {
    await as("viewer");
    assert.deepEqual((await db.query("select name from public.search_fixtures('HES')")).rows.map((row) => row.name), ["SolaFrame"]);
    assert.deepEqual((await db.query("select name from public.search_fixtures('Battens & Tubes')")).rows.map((row) => row.name), ["Scenius"]);
    await db.exec("reset role");
  });

  it("allows Editor/Admin additions and rejects lower roles server-side", async () => {
    await as("contributor");
    await assert.rejects(() => db.query("insert into public.fixture_manufacturers(name,slug,created_by) values('Newco','newco',$1)", [ids.contributor]), (error) => error.code === "42501");
    await as("editor");
    assert.equal((await db.query("insert into public.fixture_manufacturers(name,slug,created_by) values('Newco','newco',$1) returning name", [ids.editor])).rows[0].name, "Newco");
    await as("admin");
    assert.equal((await db.query("insert into public.fixture_manufacturers(name,slug,created_by) values('Admin Lights','admin-lights',$1) returning name", [ids.admin])).rows[0].name, "Admin Lights");
    await db.exec("reset role");
  });

  it("does not expose the taxonomy or Fixture search RPC anonymously", async () => {
    await db.exec("reset role; set role anon");
    await assert.rejects(() => db.query("select * from public.fixture_manufacturers"), (error) => error.code === "42501");
    await assert.rejects(() => db.query("select * from public.search_fixtures('HES')"), (error) => error.code === "42501");
    await db.exec("reset role");
  });

  it("prevents case-only, alias, and Chauvet ambiguity duplicates at the database boundary", async () => {
    await as("editor");
    for (const [name, slug] of [["MARTIN", "martin-copy"], ["Martin Lighting", "martin-lighting-copy"], ["Chauvet", "chauvet"]]) {
      await assert.rejects(() => db.query("insert into public.fixture_manufacturers(name,slug,created_by) values($1,$2,$3)", [name, slug, ids.editor]), (error) => error.code === "P0001" && /Similar manufacturers already exist/.test(error.message));
    }
    await db.exec("reset role");
  });
});
