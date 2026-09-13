import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { storageFixture } from "./storage-fixture.mjs";

const db=new PGlite();
const ids={admin:"11111111-1111-4111-8111-111111111111",editor:"22222222-2222-4222-8222-222222222222",viewer:"44444444-4444-4444-8444-444444444444",pending:"55555555-5555-4555-8555-555555555555"};
let migrationSql,legacyId,otherNapkin;
async function as(role){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]]);await db.exec("set role authenticated");}

before(async()=>{
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
    alter default privileges grant execute on functions to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  await storageFixture(db);
  const directory=new URL("../supabase/migrations/",import.meta.url);
  for(const name of (await readdir(directory)).filter(name=>name.endsWith(".sql")).sort()) {
    const sql=await readFile(new URL(name,directory),"utf8"); if(name==="202609140016_napkins_vendor_directory.sql") migrationSql=sql; else await db.exec(sql);
  }
  for(const [role,id] of Object.entries(ids)){await db.query("insert into auth.users(id,email) values($1,$2)",[id,`${role}@test.invalid`]);await db.query("update public.profiles set full_name=$1,role=$2::public.app_role,active=$3 where id=$4",[`${role} Person`,role==="pending"?"viewer":role,role!=="pending",id]);}
  legacyId=(await db.query("insert into public.vendor_clients(name,kind,primary_contact,notes,status,created_by,created_at,updated_at) values('Legacy Co','client','Legacy Person','Keep notes','published',$1,'2020-01-02Z','2021-02-03Z') returning id",[ids.admin])).rows[0].id;
  otherNapkin=(await db.query("insert into public.napkin_notes(body,status,urgent,created_by) values('Editor note','needs_review',true,$1) returning id",[ids.editor])).rows[0].id;
  await db.exec(migrationSql);
});
after(async()=>db.close());

describe("Vendor/Napkin forward migration and RLS",()=>{
  it("preserves legacy organization and migrates the clear contact once idempotently",async()=>{
    const before=(await db.query("select id,name,kind,primary_contact,notes,status,created_by,created_at,updated_at,city from public.vendor_clients where id=$1",[legacyId])).rows[0];
    let contacts=(await db.query("select name,is_primary,created_at,updated_at from public.vendor_contacts where vendor_id=$1",[legacyId])).rows;
    assert.equal(before.primary_contact,"Legacy Person");assert.equal(before.city,null);assert.deepEqual(contacts.map(c=>[c.name,c.is_primary]),[["Legacy Person",true]]);
    await db.exec(migrationSql); const after=(await db.query("select id,name,kind,primary_contact,notes,status,created_by,created_at,updated_at,city from public.vendor_clients where id=$1",[legacyId])).rows[0];
    contacts=(await db.query("select name,is_primary from public.vendor_contacts where vendor_id=$1",[legacyId])).rows;assert.deepEqual(after,before);assert.equal(contacts.length,1);
  });
  it("atomically adds, edits, removes and promotes dynamic contacts while preserving old primary",async()=>{
    await as("editor");
    const initial=[{name:"Primary One",title:"Sales Manager",email:"one@example.com",cell:null,is_primary:true,sort_order:0},{name:"Extra Two",title:null,email:null,cell:"+44 20 1234",is_primary:false,sort_order:1}];
    const id=(await db.query("select public.save_vendor_directory_entry(null,'Acme','London','manufacturer','Notes','published',$1) as id",[JSON.stringify(initial)])).rows[0].id;
    let rows=(await db.query("select * from public.vendor_contacts where vendor_id=$1 order by sort_order",[id])).rows;assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.is_primary).length,1);
    const changed=rows.map((row,index)=>({id:row.id,name:index?row.name:"Primary One",title:row.title,email:row.email,cell:row.cell,is_primary:index===1,sort_order:index}));
    changed.push({name:"Third",title:"Product Specialist",email:"third@example.com",cell:"+1 212 555 0100",is_primary:false,sort_order:2});
    await db.query("select public.save_vendor_directory_entry($1,'Acme','Las Vegas','manufacturer','Notes','published',$2)",[id,JSON.stringify(changed)]);
    rows=(await db.query("select name,is_primary from public.vendor_contacts where vendor_id=$1 order by sort_order",[id])).rows;assert.deepEqual(rows,[{name:"Primary One",is_primary:false},{name:"Extra Two",is_primary:true},{name:"Third",is_primary:false}]);
    await assert.rejects(()=>db.query("insert into public.vendor_contacts(vendor_id,name,is_primary) values($1,'Second primary',true)",[id]),e=>e.code==="23505");
    changed.splice(0,1);await db.query("select public.save_vendor_directory_entry($1,'Acme','Las Vegas','manufacturer','Notes','published',$2)",[id,JSON.stringify(changed)]);assert.equal((await db.query("select count(*) count from public.vendor_contacts where vendor_id=$1",[id])).rows[0].count,2);
  });
  it("accepts blank City/no contacts and rejects bad email or missing contact name",async()=>{
    await as("editor");
    const id=(await db.query("select public.save_vendor_directory_entry(null,'No Contacts',null,'vendor',null,'draft','[]') id")).rows[0].id;assert.equal((await db.query("select city from public.vendor_clients where id=$1",[id])).rows[0].city,null);
    for(const contacts of [[{name:"",is_primary:false}],[{name:"Bad",email:"bad@",is_primary:false}]])await assert.rejects(()=>db.query("select public.save_vendor_directory_entry(null,'Bad',null,'vendor',null,'draft',$1)",[JSON.stringify(contacts)]));
  });
  it("searches organization, City, contact name/title/email and sorts complete results before paging",async()=>{
    await as("editor");
    const make=(name,city,contact)=>db.query("select public.save_vendor_directory_entry(null,$1,$2,'vendor',null,'published',$3)",[name,city,JSON.stringify([{name:contact,title:"Rental Manager",email:`${contact.toLowerCase()}@example.com`,is_primary:true,sort_order:0}])]);
    await make("zeta","New York","Zed");await make("Alpha","","Alice");await make("beta","London","Bert");
    for(const [needle,count] of [["zeta",1],["London",1],["Alice",1],["Rental Manager",3],["bert@example.com",1]])assert.equal((await db.query("select * from public.vendor_directory($1)",[needle])).rows.length,count);
    assert.deepEqual((await db.query("select name from public.vendor_directory('', 'name-asc',0,2)")).rows.map(r=>r.name),["Acme","Alpha"]);
    const cityRows=(await db.query("select name,city from public.vendor_directory('', 'city-asc',0,20)")).rows;const firstBlank=cityRows.findIndex(r=>!r.city);assert.ok(firstBlank>0);assert.ok(cityRows.slice(firstBlank).every(r=>!r.city));
  });
  it("keeps pin independent of workflow/urgent and enforces existing Napkin ownership",async()=>{
    await as("editor");await db.query("update public.napkin_notes set pinned=true where id=$1",[otherNapkin]);let row=(await db.query("select status,urgent,pinned from public.napkin_notes where id=$1",[otherNapkin])).rows[0];assert.deepEqual(row,{status:"needs_review",urgent:true,pinned:true});
    await as("viewer");const own=(await db.query("insert into public.napkin_notes(body,status,urgent,created_by) values('Own','raw',false,$1) returning id",[ids.viewer])).rows[0].id;assert.equal((await db.query("update public.napkin_notes set pinned=true where id=$1 returning id",[own])).rows.length,1);assert.equal((await db.query("update public.napkin_notes set pinned=false where id=$1 returning id",[otherNapkin])).rows.length,0);
    assert.equal((await db.query("select * from public.napkin_poster_identities($1)",[[ids.viewer,ids.editor]])).rows.length,2);
  });
  it("denies pending/anonymous directory, contacts, pin wall and poster identity",async()=>{
    await as("pending");assert.equal((await db.query("select * from public.vendor_directory() ")).rows.length,0);assert.equal((await db.query("select * from public.vendor_contacts")).rows.length,0);assert.equal((await db.query("select * from public.napkin_notes where pinned")).rows.length,0);await assert.rejects(()=>db.query("select public.save_vendor_directory_entry(null,'No',null,'vendor',null,'draft','[]')"),e=>e.code==="42501");
    await db.exec("reset role; set role anon");for(const sql of ["select * from public.vendor_directory()","select * from public.vendor_contacts","select * from public.napkin_poster_identities('{}')"])await assert.rejects(()=>db.query(sql),e=>e.code==="42501");await db.exec("reset role");
  });
});
