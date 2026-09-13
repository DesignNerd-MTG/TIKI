import assert from 'node:assert/strict';
import {it} from 'node:test';
import sharp from 'sharp';
import vm from 'node:vm';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {normalizeAvatar,avatarLimit,saveAvatar,removeAvatar,avatarPath} from '../src/lib/avatar.ts';
import * as config from '../src/lib/avatar-config.ts';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
for(const [format,type] of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]) {
  it(`decodes ${format} avatars into small metadata-free square WebP`,async()=>{
    const input=await sharp({create:{width:30,height:60,channels:3,background:'red'}}).toFormat(format).toBuffer();
    const output=await normalizeAvatar(input,type);
    const meta=await sharp(output).metadata();
    assert.equal(meta.format,'webp');assert.equal(meta.width,256);assert.equal(meta.height,256);
    assert.equal(meta.exif,undefined);assert.equal(meta.xmp,undefined);
  });
}
it('rejects invalid, unsafe, oversized, MIME-spoofed and excessive-pixel images',async()=>{
  const png=await sharp({create:{width:1,height:1,channels:3,background:'red'}}).png().toBuffer();
  for(const [bytes,type] of [[png,'image/svg+xml'],[png,'image/jpeg'],[Buffer.from('<svg/>'),'image/png'],[Buffer.from('not an image'),'image/webp'],[Buffer.alloc(avatarLimit+1),'image/png'],[Buffer.alloc(0),'image/png']])await assert.rejects(()=>normalizeAvatar(bytes,type));
  const big=await sharp({create:{width:4001,height:4000,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(()=>normalizeAvatar(big,'image/png'));
});
it('owner upload and replacement use one fixed file and removal never follows a supplied URL',async()=>{
  const files=new Map();let published=false;const calls=[];
  const store={upload:async(path,bytes)=>{files.set(path,bytes);calls.push(path);return {error:null};},remove:async(path)=>{files.delete(path);calls.push(path);return {error:null};},publish:async(enabled)=>{published=enabled;return {error:null};}};
  assert.equal(await saveAvatar(store,'owner',Buffer.from('one')),'Avatar saved.');assert.equal(published,true);
  assert.equal(await saveAvatar(store,'owner',Buffer.from('two')),'Avatar saved.');assert.equal(files.size,1);assert.equal(files.get(avatarPath('owner')).toString(),'two');
  assert.equal(await removeAvatar(store,'owner'),'Avatar removed.');assert.equal(files.size,0);assert.equal(published,false);
  assert.deepEqual(calls,['owner/avatar.webp','owner/avatar.webp','owner/avatar.webp']);
});
it('storage failures do not publish and profile-sync failures are explicit and bounded',async()=>{
  let called=0;
  const failing={upload:async()=>({error:true}),remove:async()=>({error:true}),publish:async()=>{called++;return {error:null};}};
  assert.match(await saveAvatar(failing,'owner',Buffer.from('x')),/Could not upload/);
  assert.match(await removeAvatar(failing,'owner'),/Could not remove/);assert.equal(called,0);
  const sync={...failing,upload:async()=>({error:null}),remove:async()=>({error:null}),publish:async()=>({error:true})};
  assert.match(await saveAvatar(sync,'owner',Buffer.from('x')),/profile could not be updated/);
  assert.match(await removeAvatar(sync,'owner'),/profile could not be updated/);
});
it('avatar component renders protected images, falls back to initials and retries on profile revision',async()=>{
  const source=await read('src/components/member-avatar.tsx');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};let failed=null;const jsx=(type,props)=>({type,props});
  vm.runInNewContext(compiled,{exports,encodeURIComponent,require(name){
    if(name==='react')return {useState:()=>[failed,v=>{failed=v;}]};
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name==='@/lib/format')return {initials:()=> 'MG'};throw Error(name);
  }});
  const render=(id='owner',version='1')=>exports.MemberAvatar({id,name:'Mike Grabowski',version}).props.children;
  assert.equal(render().type,'img');assert.equal(render().props.src,'/profile/avatar/owner?v=1');
  render().props.onError();assert.equal(render(),'MG');assert.equal(render('owner','2').type,'img');assert.equal(render(null),'MG');
});
it('sidebar/profile/social share canonical name and avatar without widening directory queries or widths',async()=>{
  const shell=await read('src/components/app-shell.tsx');assert.match(shell,/href="\/account"/);assert.match(shell,/<MemberAvatar/);
  const profile=await read('src/app/(portal)/profile/page.tsx');assert.match(profile,/requireActiveProfile\(/);assert.match(profile,/<DirectoryName name=\{profile.full_name/);
  const social=await read('src/app/(portal)/links/social/page.tsx');assert.match(social,/social-member-heading/);assert.match(social,/<MemberAvatar id=\{id\} name=\{name\}/);assert.match(social,/order\("last_name_key"\)/);assert.match(social,/allSocialPages/);
  const css=await read('src/app/globals.css');assert.match(css,/\.social-directory-list[^}]+max-width: 640px/);assert.match(css,/\.member-avatar[^}]+width: 36px/);assert.match(css,/min-height: 44px/);
  const action=await read('src/app/(portal)/profile/actions.ts');assert.match(action,/requireActiveProfile\(/);assert.doesNotMatch(action,/form.get\("(id|user_id|profile_id)"\)/);
  const route=await read('src/app/(portal)/profile/avatar/[id]/route.ts');assert.match(route,/!identity \|\| !profile\?\.active/);assert.match(route,/private, no-store/);assert.match(route,/normalizeAvatar/);assert.doesNotMatch(route,/createSignedUrl|getPublicUrl|fetch\(/);
});
it('avatar editor rejects large selections before submission and removal uses a separate file-free form',async()=>{
  const source=await read('src/components/avatar-editor.tsx');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};let fileError='';const jsx=(type,props)=>({type,props});
  vm.runInNewContext(compiled,{exports,require(name){
    if(name==='react')return {useActionState:()=>[{message:''},'action',false],useState:()=>[fileError,v=>{fileError=v;}],useId:()=> 'upload'};
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name.endsWith('/profile/actions'))return {changeAvatar(){}};
    if(name.endsWith('member-avatar'))return {MemberAvatar:'Avatar'};
    if(name.endsWith('avatar-config'))return config;throw Error(name);
  }});
  const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
  const render=()=>nodes(exports.AvatarEditor({id:'owner',name:'Member',version:'1'}));
  render().find(n=>n.type==='input').props.onChange({currentTarget:{files:[{size:avatarLimit+1,type:'image/png'}]}});
  assert.equal(render().find(n=>n.props.value==='save').props.disabled,true);
  assert.equal(render().find(n=>n.props.value==='remove').props.disabled,false);
  const removeForm=render().find(n=>n.type==='form'&&nodes(n).some(child=>child.props?.value==='remove'));
  assert.equal(nodes(removeForm).some(n=>n.type==='input'),false);
  render().find(n=>n.type==='input').props.onChange({currentTarget:{files:[{size:100,type:'image/png'}]}});
  assert.equal(render().find(n=>n.props.value==='save').props.disabled,false);
});
