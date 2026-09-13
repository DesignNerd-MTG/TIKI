import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile,readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { storageFixture } from "./storage-fixture.mjs";

it("consolidates Documents preserving history, tags, states, source rows and human edits across reruns",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    await storageFixture(db);
    const dir=new URL("../supabase/migrations/",import.meta.url);
    const migration="202609140002_retire_documents.sql";
    for(const name of (await readdir(dir)).filter(n=>n.endsWith(".sql")&&n!==migration).sort())await db.exec(await readFile(new URL(name,dir),"utf8"));
    const owner="11111111-1111-4111-8111-111111111111";
    await db.query("insert into auth.users(id,email) values($1,'test@example.invalid')",[owner]);
    await db.query("update public.profiles set active=true,role='admin' where id=$1",[owner]);
    const ids=[];
    for(const status of ["draft","submitted","published","archived"]){
      ids.push((await db.query("insert into public.documents(title,url,document_type,description,status,created_by,verified_by,created_at,updated_at) values('Expense form','https://example.com/form','Company policy','Original notes',$1,$2,$2,'2020-01-02T03:04:05.123456Z','2021-02-03T04:05:06.654321Z') returning id",[status,owner])).rows[0].id);
    }
    const invalid=(await db.query("insert into public.documents(title,url) values('Unresolved','not-a-url') returning id")).rows[0].id;
    await db.query("insert into public.tags(name,slug) values('expense','expense')");
    await db.query("insert into public.content_tags(tag_id,entity_kind,entity_id,created_by) select id,'document',$1,$2 from public.tags",[ids[2],owner]);
    await db.query("insert into public.revision_notes(entity_kind,entity_id,summary,source,created_by,created_at) values('document',$1,'Original history','Review',$2,'2021-01-01')",[ids[2],owner]);
    await db.query("insert into public.napkin_notes(body,status,converted_to_kind,converted_to_id,created_by) values('Filed source','converted','document',$1,$2)",[ids[2],owner]);
    const sources=(await db.query("select * from public.documents order by id")).rows;
    const sql=await readFile(new URL(migration,dir),"utf8");await db.exec(sql);
    assert.deepEqual((await db.query("select * from public.documents order by id")).rows,sources);
    const mapped=(await db.query("select * from public.link_items where import_source like 'document:%'")).rows;
    assert.equal(mapped.length,4);
    assert.equal((await db.query("select id from public.documents d where not exists(select 1 from public.link_items l where l.import_source='document:'||d.id::text)")).rows[0].id,invalid);
    for(const row of mapped){
      const original=sources.find(d=>'document:'+d.id===row.import_source);
      assert.equal(row.label,original.title);assert.equal(row.url,original.url);assert.equal(row.description,original.description);assert.equal(row.category,original.document_type);
      assert.equal(row.status,original.status);assert.equal(row.created_by,owner);assert.equal(row.verified_by,owner);assert.equal(row.collection_id,'ldg-ldge-documents');
      const exact=(await db.query("select l.created_at=d.created_at as created,l.updated_at=d.updated_at as updated,l.date_added=d.created_at as added from public.link_items l join public.documents d on l.import_source='document:'||d.id::text where l.id=$1",[row.id])).rows[0];
      assert.deepEqual(exact,{created:true,updated:true,added:true});
    }
    const published=mapped.find(r=>r.status==='published');
    assert.equal((await db.query("select * from public.content_tags where entity_kind='link' and entity_id=$1",[published.id])).rows.length,1);
    assert.equal((await db.query("select summary from public.revision_notes where entity_kind='link' and entity_id=$1",[published.id])).rows[0].summary,'Original history');
    assert.equal((await db.query("select converted_to_id from public.napkin_notes")).rows[0].converted_to_id,ids[2]);
    await db.query("update public.link_items set label='Human correction' where id=$1",[published.id]);
    const before=(await db.query("select * from public.link_items order by id")).rows;
    await db.exec(sql);assert.deepEqual((await db.query("select * from public.link_items order by id")).rows,before);
    assert.equal((await db.query("select * from public.revision_notes where entity_kind='link'")).rows.length,1);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec("set role authenticated");
    assert.equal((await db.query("select * from public.search_references('expense','ldg-ldge-documents')")).rows.length,3);
    await assert.rejects(()=>db.exec("insert into public.documents(title,url) values('No','https://example.com')"));
    await assert.rejects(()=>db.query("update public.documents set title='No' where id=$1",[ids[0]]));
    await assert.rejects(()=>db.query("delete from public.documents where id=$1",[ids[0]]));
    await assert.rejects(()=>db.query("select * from public.file_napkin($1,'document','No',null)",[ids[0]]));
  }finally{await db.close();}
});

it("retires Documents routes, navigation, mutations, filing and independent search",async()=>{
  const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
  for(const path of ['src/components/app-shell.tsx','src/components/dashboard-view.tsx','src/app/(portal)/dashboard/page.tsx','src/app/(portal)/search/page.tsx']){
    const source=await read(path);assert.doesNotMatch(source,/href: "\/documents"|from\("documents"\)|label: "Documents"/);
  }
  for(const path of ['src/app/(portal)/documents/page.tsx','src/app/(portal)/documents/new/page.tsx'])assert.match(await read(path),/redirect\("\/links\?collection=ldg-ldge-documents"\)/);
  const detail=await read('src/app/(portal)/documents/[id]/page.tsx');assert.match(detail,/import_source/);assert.doesNotMatch(detail,/ContentDetailPage|ContentEditor/);
  assert.match(await read('src/app/(portal)/content-actions.ts'),/value !== "document"/);
  const content=await read('src/lib/content.ts');assert.doesNotMatch(content.match(/filingDestinationKinds = .*/)[0],/"document"/);
  assert.match(await read('src/app/(portal)/search/page.tsx'),/neq\("entity_kind", "document"\)/);
});
