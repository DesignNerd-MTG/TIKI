import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { checkReference } from "../src/lib/reference-fetch.ts";

const db=new PGlite();
const ids={admin:"11111111-1111-4111-8111-111111111111",editor:"22222222-2222-4222-8222-222222222222",contributor:"33333333-3333-4333-8333-333333333333",viewer:"44444444-4444-4444-8444-444444444444",pending:"55555555-5555-4555-8555-555555555555"};
let legacyId;
async function as(role){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]]);await db.exec("set role authenticated");}
const manifest=[{import_source:"notion:aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa",label:"Imported resource",url:"https://www.etcconnect.com",description:"Old source",date_added:"2022-03-04T10:30:00Z",collection_id:"control-systems",subcollection_id:null,category:"Control Systems",tags:["console"],link_health:"redirected",site_name:"Lighting maker",final_url:"https://www.etcconnect.com/new",last_checked_at:"2026-09-13T00:00:00Z"}];

before(async()=>{
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  const directory=new URL("../supabase/migrations/",import.meta.url);
  const migrations=(await readdir(directory)).filter(name=>name.endsWith(".sql")).sort();
  for(const name of migrations){
    if(name==="202609130001_reference_hub.sql"){
      for(const [role,id] of Object.entries(ids)){
        await db.query("insert into auth.users(id,email) values($1,$2)",[id,role+"@test.invalid"]);
        await db.query("update public.profiles set role=$1::public.app_role,active=$2 where id=$3",[role==="pending"?"viewer":role,role!=="pending",id]);
      }
      const result=await db.query("insert into public.link_items(label,url,category,status,created_by,created_at,updated_at) values('Legacy link','https://public.com','Drafting','published',$1,'2020-01-01T12:30:00.123456Z','2021-02-03T04:05:06.654321Z') returning id",[ids.admin]);
      legacyId=result.rows[0].id;
    }
    await db.exec(await readFile(new URL(name,directory),"utf8"));
  }
});
after(async()=>{await db.close();});
describe("Reference PostgreSQL migration and RLS",()=>{
  it("backfills dates without losing legacy records or editability",async()=>{
    await as("admin");
    const row=(await db.query("select * from public.link_items where id=$1",[legacyId])).rows[0];
    const exact=(await db.query("select created_at = '2020-01-01T12:30:00.123456Z'::timestamptz as created_preserved, updated_at = '2021-02-03T04:05:06.654321Z'::timestamptz as updated_preserved, date_added = created_at as date_preserved from public.link_items where id=$1",[legacyId])).rows[0];
    assert.deepEqual(exact,{created_preserved:true,updated_preserved:true,date_preserved:true});
    assert.equal(row.collection_id,"drafting");
    await db.query("update public.link_items set label='Legacy edited' where id=$1",[legacyId]);
    assert.equal((await db.query("select label from public.link_items where id=$1",[legacyId])).rows[0].label,"Legacy edited");
    assert.deepEqual((await db.query("select updated_at > '2021-02-03T04:05:06.654321Z'::timestamptz as advanced, date_added = created_at as preserved from public.link_items where id=$1",[legacyId])).rows[0],{advanced:true,preserved:true});
  });
  it("enforces one nesting level and matching collection/subcollection in PostgreSQL",async()=>{
    await as("admin");
    await db.query("update public.link_items set collection_id='control-systems',subcollection_id='consoles' where id=$1",[legacyId]);
    await assert.rejects(()=>db.query("update public.link_items set collection_id='drafting' where id=$1",[legacyId]));
    await assert.rejects(()=>db.query("update public.link_items set collection_id='consoles',subcollection_id=null where id=$1",[legacyId]));
    await db.exec("reset role");
    await assert.rejects(()=>db.exec("insert into public.reference_collections values('too-deep','Deep','No','consoles',1,0)"));
  });
  it("rejects NULL hierarchy bypasses while allowing a root and one child",async()=>{
    await db.exec("reset role");
    await db.exec("insert into public.reference_collections values('test-root','Root','Test',null,0,null),('test-child','Child','Test','test-root',1,0)");
    for (const [parent,depth,parentDepth] of [["test-root",1,null],["test-root",1,1],["test-child",1,null],["test-child",1,0],["test-child",2,1],[null,1,0],["test-root",0,null]]) {
      await assert.rejects(()=>db.query("insert into public.reference_collections values('invalid-child','Invalid','Test',$1,$2,$3)",[parent,depth,parentDepth]));
    }
  });
  it("preserves publication rules and filters collection counts/search through RLS",async()=>{
    await as("contributor");
    await assert.rejects(()=>db.query("insert into public.link_items(label,url,status,created_by) values('Forbidden','https://public.com','published',$1)",[ids.contributor]));
    await db.query("insert into public.link_items(label,url,description,status,created_by) values('Private draft','https://public.com','draftneedle','draft',$1)",[ids.contributor]);
    await as("viewer");
    assert.equal((await db.query("select * from public.search_references('draftneedle')")).rows.length,0);
    assert.equal((await db.query("select * from public.search_references('Consoles')")).rows.length,1);
    await assert.rejects(()=>db.query("insert into public.link_items(label,url,created_by) values('Bad','https://public.com',$1)",[ids.viewer]));
    await as("pending");
    assert.equal((await db.query("select * from public.search_references('')")).rows.length,0);
    assert.equal((await db.query("select * from public.reference_collections")).rows.length,0);
  });
  it("imports atomically and idempotently while retaining source dates, tags, revisions and later edits",async()=>{
    await as("admin");
    let result=await db.query("select * from public.import_notion_references($1)",[JSON.stringify(manifest)]);
    assert.equal(result.rows[0].outcome,"imported");
    await db.exec("update public.link_items set label='Human edit' where import_source is not null");
    result=await db.query("select * from public.import_notion_references($1)",[JSON.stringify(manifest)]);
    assert.equal(result.rows[0].outcome,"already_imported");
    const row=(await db.query("select * from public.link_items where import_source=$1",[manifest[0].import_source])).rows[0];
    assert.equal(row.label,"Human edit"); assert.equal(row.status,"draft");
    assert.equal(row.link_health,"redirected"); assert.equal(row.final_url,manifest[0].final_url);
    assert.equal(new Date(row.date_added).toISOString(),"2022-03-04T10:30:00.000Z");
    assert.equal((await db.query("select * from public.revision_notes where entity_id=$1",[row.id])).rows.length,1);
    assert.equal((await db.query("select * from public.search_references('console')")).rows.length,2);
    for (const needle of ["Human edit","Lighting maker","Old source","etcconnect.com"]) {
      assert.equal((await db.query("select * from public.search_references($1)",[needle])).rows.length,1);
    }
    await assert.rejects(()=>db.query("select * from public.import_notion_references($1)",[JSON.stringify([{...manifest[0],import_source:"notion:bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb"},{...manifest[0],import_source:"bad"}])]));
    assert.equal((await db.query("select * from public.link_items where import_source='notion:bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb'")).rows.length,0);
    await as("editor");
    await assert.rejects(()=>db.query("select * from public.import_notion_references($1)",[JSON.stringify(manifest)]));
  });
  it("restricts social link mutations to the owning active profile and exposes only public identity",async()=>{
    await as("viewer");
    await db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Portfolio','https://public.com')",[ids.viewer]);
    await assert.rejects(()=>db.query("insert into public.profile_social_links(profile_id,label,url) values($1,'Impersonation','https://public.com')",[ids.admin]));
    await as("contributor");
    assert.equal((await db.query("update public.profile_social_links set label='Hijack' returning id")).rows.length,0);
    const rows=(await db.query("select * from public.social_directory()")).rows;
    assert.equal(rows.length,1); assert.deepEqual(Object.keys(rows[0]).sort(),["display_name","id","label","profile_id","url"].sort());
    await as("pending"); assert.equal((await db.query("select * from public.social_directory()")).rows.length,0);
  });
  it("persists Unicode boundary metadata and imports failed enrichment without losing references",async()=>{
    await as("admin");
    const metadata=await checkReference("https://public.com",{
      resolve:async()=>[{address:"93.184.216.34",family:4}],
      request:async()=>({status:200,headers:{"content-type":"text/html"},body:Buffer.from('<title>'+"a".repeat(499)+'😀</title><meta property="og:site_name" content="'+"b".repeat(199)+'😀&#xD800;\0">')}),
    });
    await db.query("select $1::jsonb",[JSON.stringify(metadata)]);
    await db.query("update public.link_items set fetched_title=$1,site_name=$2 where id=$3",[metadata.fetched_title,metadata.site_name,legacyId]);
    const failed=await checkReference("https://public.com",{resolve:async()=>{throw new Error("DNS failed");},request:async()=>assert.fail("No request after DNS failure")});
    const batch=[{...manifest[0],...metadata,import_source:"notion:cccccccccccc4ccc8ccccccccccccccc"},{...manifest[0],...failed,import_source:"notion:dddddddddddd4ddd8ddddddddddddddd"}];
    const results=(await db.query("select * from public.import_notion_references($1)",[JSON.stringify(batch)])).rows;
    assert.deepEqual(results.map(r=>r.outcome),["imported","imported"]);
    assert.equal((await db.query("select link_health from public.link_items where import_source=$1",[batch[1].import_source])).rows[0].link_health,"could_not_verify");
  });
});
