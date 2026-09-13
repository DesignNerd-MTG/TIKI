import assert from 'node:assert/strict';
import {it} from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {groupSocialAccounts,directoryName} from '../src/lib/social-directory.ts';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
it('sorts actual names and repeated accounts deterministically independent of viewing identity',()=>{
  const row=(id,profile_id,display_name,label,url)=>({id,profile_id,display_name,label,url});
  const rows=[row('z','2','alice','Personal Website','https://z.com'),row('b','2','alice','Instagram','https://instagram.com/z'),row('a','2','alice','Instagram','https://instagram.com/a'),row('t','2','alice','TikTok','https://tiktok.com/@a'),row('1','1','Alice','Instagram','https://instagram.com/b'),row('3','3','Bob','Instagram','https://instagram.com/c')];
  const grouped=groupSocialAccounts(rows);
  assert.deepEqual(grouped.map(g=>g.id),['1','2','3']);
  assert.deepEqual(grouped[1].accounts.map(r=>r.id),['a','b','t','z']);
  assert.deepEqual(groupSocialAccounts([...rows].reverse()),grouped);
  assert.equal(directoryName('  Mike Grabowski '),'Mike Grabowski');
  assert.equal(directoryName('  '),'T.I.K.I. member');assert.equal(directoryName(null),'T.I.K.I. member');
});
it('Card/List uses SSR Card default, browser persistence, same records and resilient disabled storage',async()=>{
  const source=await read('../src/components/reference-results.tsx');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={},stored=new Map();let server=true,blocked=false,fallback=null;const listeners=new Map();
  const window={localStorage:{getItem:k=>{if(blocked)throw Error();return stored.get(k);},setItem:(k,v)=>{if(blocked)throw Error();stored.set(k,v);}},addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n),dispatchEvent:()=>{}};
  const jsx=(type,props)=>({type,props});
  vm.runInNewContext(compiled,{exports,window,Event:class{},require(name){
    if(name==='react')return {useState:()=>[fallback,value=>{fallback=value;}],useSyncExternalStore:(subscribe,get,ssr)=>{if(server)return ssr();subscribe(()=>{});return get();}};
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name.endsWith('reference-card'))return {ReferenceCard:'Card'};throw Error(name);
  }});
  const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
  const props={records:[{id:'filtered-search-record',status:'archived'}],tags:{'filtered-search-record':['tag']}};
  const render=()=>nodes(exports.ReferenceResults(props));
  const button=label=>render().find(n=>n.type==='button'&&n.props.children===label);
  assert.equal(button('Card').props['aria-pressed'],true);
  stored.set(exports.referenceViewKey,'list');assert.equal(button('Card').props['aria-pressed'],true);
  server=false;assert.equal(button('List').props['aria-pressed'],true);
  for(const mode of ['Card','List']) {
    button(mode).props.onClick();assert.equal(button(mode).props['aria-pressed'],true);
    const card=render().find(n=>n.type==='Card');assert.equal(card.props.record,props.records[0]);assert.equal(card.props.tags,props.tags['filtered-search-record']);
  }
  blocked=true;button('Card').props.onClick();assert.equal(button('Card').props['aria-pressed'],true);
});
it('compact layouts are scoped to index; queries, filters and privacy gates remain intact',async()=>{
  const css=await read('../src/app/globals.css');assert.match(css,/\.reference-index \.reference-card__notes[^}]+line-clamp: 2/);assert.match(css,/@media\(max-width: 600px\)/);
  const card=await read('../src/components/reference-card.tsx');for(const field of ['label','site_name','collection_id','link_health','date_added','url'])assert.ok(card.includes(field));assert.match(card,/!list && image/);
  const hub=await read('../src/components/reference-hub.tsx');assert.match(hub,/selected_collection: selected\?\.id/);assert.match(hub,/search_text: query/);assert.match(hub,/ReferenceResults records=\{records.slice\(0,50\)\}/);
  for(const path of ['../src/app/(portal)/layout.tsx','../src/app/preview/page.tsx'])assert.match(await read(path),/requireActiveProfile\(/);
  const proxy=await read('../src/app/(portal)/links/image/route.ts');assert.match(proxy,/if \(!identity \|\| !profile\?\.active\)/);
  const signup=await read('../src/app/login/actions.ts');assert.match(signup,/redirect\("\/pending"\)/);
  const search=await read('../src/app/(portal)/search/page.tsx');assert.match(search,/select\("user_id,name"\)/);assert.doesNotMatch(search,/select\([^\n]*travel_details/);
});
