import assert from 'node:assert/strict';
import {it} from 'node:test';
import {readFile} from 'node:fs/promises';
import {allSocialPages} from '../src/lib/social-directory-pages.ts';
import {groupSocialAccounts,directoryLastName} from '../src/lib/social-directory.ts';
import {canManageSocial} from '../src/lib/social-accounts.ts';
it('sorts final name tokens, full-name ties and UUID ties without changing display or account order',()=>{
  const names=['Romi Smith','Sarah Lynn Jakubasz','Mike Grabowski','Jane Adams','zoe adams','jane ADAMS','Prince'];
  const rows=names.map((display_name,i)=>({id:String(i),profile_id:String(i),display_name,label:'Instagram',url:'https://instagram.com/z'}));
  rows.push({...rows[2],id:'99',label:'Instagram',url:'https://instagram.com/a'});
  const groups=groupSocialAccounts(rows.reverse());
  assert.deepEqual(groups.map(g=>g.id),['3','5','4','2','1','6','0']);
  assert.equal(groups.find(g=>g.id==='1').name,'Sarah Lynn Jakubasz');
  assert.deepEqual(groups.find(g=>g.id==='2').accounts.map(a=>a.id),['99','2']);
  assert.equal(directoryLastName(' Sarah  Lynn\tJakubasz  '),'Jakubasz');
  assert.equal(directoryLastName('Prince'),'Prince');
  assert.equal(directoryLastName('  '),'member');
  assert.deepEqual(groupSocialAccounts(rows,true).map(g=>g.id),[...new Set(rows.map(r=>r.profile_id))]);
});
it('loads the complete directory despite lower API caps before grouping and sorting',async()=>{
  const rows=Array.from({length:1205},(_,i)=>({id:String(i).padStart(5,'0'),profile_id:String(i%3),display_name:['Zoe','alice','Bob'][i%3],label:'Instagram',url:`https://instagram.com/user${i}`}));
  const requests=[];
  const result=await allSocialPages(async(from,to)=>{requests.push(from);return {data:rows.slice(from,Math.min(to+1,from+73)),error:null};});
  assert.deepEqual(result.data,rows);assert.equal(result.error,null);
  assert.equal(requests.at(-1),1205);
  const groups=groupSocialAccounts(result.data);
  assert.deepEqual(groups.map(g=>g.name),['alice','Bob','Zoe']);
  assert.equal(groups.reduce((n,g)=>n+g.accounts.length,0),1205);
});
it('fails closed instead of displaying a partial directory after a later page fails',async()=>{
  const result=await allSocialPages(async from=>from?{data:null,error:'failed'}:{data:[{id:'one'}],error:null});
  assert.equal(result.data,null);assert.equal(result.error,'failed');
});
it('compact grouped structure preserves per-row ownership and independent collapsed forms',async()=>{
  const read=path=>readFile(new URL(path,import.meta.url),'utf8');
  const page=await read('../src/app/(portal)/links/social/page.tsx');
  assert.match(page,/social-directory-list/);assert.match(page,/className="panel social-member"/);
  assert.doesNotMatch(page,/reference-grid|detail-panel/);
  assert.match(page,/people.map/);assert.match(page,/accounts.map/);
  assert.match(page,/canManageSocial\(profile.role,identity.id,row.profile_id\)/);
  assert.match(page,/order\("profile_id"\).order\("id"\).range/);
  assert.match(page,/rpc\("social_directory_index"\).order\("last_name_key"\).order\("display_name_key"\).order\("profile_id"\).order\("id"\).range/);
  assert.match(page,/groupSocialAccounts\(rows, true\)/);
  assert.match(page,/allSocialPages<SocialAccount>/);
  for(const role of ['viewer','contributor','editor']) {
    assert.equal(canManageSocial(role,'self','self'),true);
    assert.equal(canManageSocial(role,'self','other'),false);
  }
  assert.equal(canManageSocial('admin','self','other'),true);
  const editor=await read('../src/components/social-accounts.tsx');
  assert.match(editor,/useState\(false\)/);assert.match(editor,/\+ Add another account/);
  const css=await read('../src/app/globals.css');
  assert.match(css,/\.social-member \{ padding: 12px 16px/);
  assert.match(css,/\.social-directory-list \{[^}]*width: 100%; max-width: 640px; justify-self: start/);
  assert.match(css,/min-height: 44px/);
  assert.match(css,/@media\(max-width: 600px\) \{ \.social-member \.social-account-row \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(await read('../src/components/directory-name.tsx'),/<details/);
});
