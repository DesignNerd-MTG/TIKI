import assert from 'node:assert/strict';
import {it} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import * as avatars from '../src/lib/avatar.ts';
import sharp from 'sharp';
async function load(path,dependencies) {
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};vm.runInNewContext(compiled,{exports,File,Buffer,Uint8Array,Response,Error,require(name){if(name in dependencies)return dependencies[name];throw Error(name);}});return exports;
}
it('actual avatar action gates members, ignores forged owner, validates files and handles storage failures',async()=>{
  let allowed=true,fail=false;const writes=[];
  const bucket={upload:async(path,bytes,options)=>{writes.push({path,bytes,options});return {error:fail};},remove:async(paths)=>{writes.push({paths});return {error:fail};}};
  const action=await load('src/app/(portal)/profile/actions.ts',{
    'next/cache':{revalidatePath(){}},'@/lib/auth':{requireActiveProfile:async()=>{if(!allowed)throw Error('Denied');return {identity:{id:'owner'}};}},
    '@/lib/supabase/server':{createClient:async()=>({storage:{from:name=>{assert.equal(name,'tiki-avatars');return bucket;}},rpc:async(name,args)=>{writes.push({name,args});return {error:null};}})},'@/lib/avatar':avatars,
  });
  const png=await sharp({create:{width:10,height:20,channels:3,background:'red'}}).png().toBuffer();
  const form=new FormData();form.set('avatar',new File([png],'safe.png',{type:'image/png'}));form.set('profile_id','victim');
  assert.equal((await action.changeAvatar({},form)).message,'Avatar saved.');assert.equal(writes[0].path,'owner/avatar.webp');assert.equal(writes[0].options.upsert,true);
  assert.equal((await sharp(writes[0].bytes).metadata()).format,'webp');
  assert.deepEqual(JSON.parse(JSON.stringify(writes[1])),{name:'set_profile_avatar',args:{enabled:true}});
  form.set('intent','remove');assert.equal((await action.changeAvatar({},form)).message,'Avatar removed.');assert.deepEqual(Array.from(writes[2].paths),['owner/avatar.webp']);
  const count=writes.length;allowed=false;await assert.rejects(()=>action.changeAvatar({},form),/Denied/);assert.equal(writes.length,count);allowed=true;
  form.set('intent','save');form.set('avatar',new File(['<svg/>'],'fake.png',{type:'image/png'}));assert.match((await action.changeAvatar({},form)).message,/could not be read/);assert.equal(writes.length,count);
  form.set('avatar',new File([Buffer.alloc(avatars.avatarLimit+1)],'large.png',{type:'image/png'}));assert.match((await action.changeAvatar({},form)).message,/2 MB/);assert.equal(writes.length,count);
  fail=true;form.set('intent','remove');assert.match((await action.changeAvatar({},form)).message,/Could not remove/);
});
it('avatar route denies anonymous/pending, checks target path and serves only decoded private images',async()=>{
  let identity=null,profile=null,path=null,file=null,reads=0;
  const id='11111111-1111-4111-8111-111111111111';
  const route=await load('src/app/(portal)/profile/avatar/[id]/route.ts',{
    '@/lib/auth':{getIdentityAndProfile:async()=>({identity,profile})},'@/lib/avatar':avatars,
    '@/lib/supabase/server':{createClient:async()=>({rpc:async()=>{reads++;return {data:path,error:null};},storage:{from:()=>({download:async()=>({data:file,error:null})})}})},
  });
  const get=()=>route.GET(new Request('https://example.test/profile/avatar/'+id),{params:Promise.resolve({id})});
  assert.equal((await get()).status,401);identity={id};profile={active:false};assert.equal((await get()).status,401);assert.equal(reads,0);
  profile.active=true;assert.equal((await get()).status,404);path='https://external.invalid/image';assert.equal((await get()).status,404);
  path=avatars.avatarPath(id);file=new Blob(['bad'],{type:'image/webp'});assert.equal((await get()).status,404);
  file=new Blob([await sharp({create:{width:10,height:20,channels:3,background:'blue'}}).webp().toBuffer()]);
  const response=await get();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width,256);
});
