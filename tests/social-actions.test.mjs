import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as social from "../src/lib/social-accounts.ts";

it("server action rejects forged targets, normalizes saves, preserves edit owner and handles failures",async()=>{
  const source=await readFile(new URL("../src/app/(portal)/links/social/actions.ts",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const actor="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",row="33333333-3333-4333-8333-333333333333";
  let role="viewer",owner=actor,active=true,fail=false;const writes=[];
  const client={rpc:async()=>({data:active,error:null}),from(table){
    assert.equal(table,"profile_social_links");
    let operation="read",payload,filters=[];
    const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},
      insert(value){operation="insert";payload=value;return query;},update(value){operation="update";payload=value;return query;},delete(){operation="delete";return query;},
      async maybeSingle(){if(operation==="read")return {data:{profile_id:owner},error:null};writes.push({operation,payload,filters});return fail?{error:{message:"DB"},data:null}:{data:{id:row},error:null};},async single(){return query.maybeSingle();}};
    return query;
  }};
  const exports={};vm.runInNewContext(compiled,{exports,require(name){
    if(name==="next/cache")return {revalidatePath(){}};
    if(name.endsWith("/auth"))return {getIdentityAndProfile:async()=>({identity:{id:actor},profile:{role,active:true}})};
    if(name.endsWith("supabase/server"))return {createClient:async()=>client};
    if(name.endsWith("content-validation"))return {isUuid:value=>/^[\da-f-]{36}$/.test(value)};
    if(name.endsWith("social-accounts"))return social;
    throw Error(name);
  }});
  const save=values=>{const form=new FormData();for(const [key,value]of Object.entries(values))form.set(key,value);return exports.saveSocialAccountAction({},form);};
  assert.equal((await save({profile_id:other,platform:"Instagram",account:"user"})).ok,false);assert.equal(writes.length,0);
  assert.equal((await save({platform:"Instagram",account:"@User"})).ok,true);assert.equal(writes[0].payload.url,"https://www.instagram.com/user/");
  owner=other;assert.equal((await save({id:row,remove:"true"})).ok,false);
  role="admin";
  assert.equal((await save({profile_id:other,platform:"TikTok",account:"user"})).ok,true);assert.equal(writes.at(-1).payload.profile_id,other);
  assert.equal((await save({id:row,profile_id:actor,platform:"Instagram",account:"corrected"})).ok,true);
  assert.equal(writes.at(-1).payload.profile_id,other);assert.ok(writes.at(-1).filters.some(([key,value])=>key==="id"&&value===row));
  assert.equal((await save({id:row,remove:"true"})).ok,true);assert.equal(writes.at(-1).operation,"delete");
  active=false;assert.equal((await save({profile_id:other,platform:"Instagram",account:"user"})).ok,false);
  active=true;assert.ok((await save({platform:"Instagram",account:"instagram.com/p/post"})).fieldErrors.account);
  fail=true;assert.equal((await save({platform:"Instagram",account:"user"})).ok,false);
});
