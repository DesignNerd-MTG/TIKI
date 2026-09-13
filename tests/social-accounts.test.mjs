import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeSocialAccount as normalize, presentSocialAccount, canManageSocial, socialPlatforms } from "../src/lib/social-accounts.ts";

for(const [platform,inputs,url] of [
  ["Instagram",["mtgdesigns","@mtgdesigns","  @MTGdesigns  ","instagram.com/mtgdesigns","www.instagram.com/mtgdesigns","https://instagram.com/mtgdesigns","https://www.instagram.com/mtgdesigns/"],"https://www.instagram.com/mtgdesigns/"],
  ["TikTok",["mtgdesigns","@mtgdesigns","  @MTGdesigns  ","tiktok.com/@mtgdesigns","www.tiktok.com/@mtgdesigns","https://www.tiktok.com/@mtgdesigns/"],"https://www.tiktok.com/@mtgdesigns"],
]) for(const input of inputs) it(`${platform} normalizes ${input}`,()=>assert.deepEqual(normalize(platform,input),{label:platform,url,display:"@mtgdesigns"}));
for(const input of ["mtgdesigns.net","www.mtgdesigns.net","https://mtgdesigns.net","http://mtgdesigns.net/path"]) it(`website normalizes ${input}`,()=>{
  const result=normalize("Personal Website",input);assert.match(result.url,/^https?:\/\//); assert.match(result.display,/mtgdesigns.net$/);
  if(!input.startsWith("http:"))assert.match(result.url,/^https:/);
});
for(const [platform,inputs] of [
  ["Instagram",["https://instagram.com/p/abc","https://instagram.com/reel/abc","https://evil.com/user","user/name","@bad name","https://instagram.com/accounts/","https://instagram.com:444/user"]],
  ["TikTok",["https://tiktok.com/@user/video/123","https://vm.tiktok.com/abc","https://tiktok.com/share","https://tiktok.com/user","bad..user"]],
  ["Personal Website",["javascript:alert(1)","https://user:pass@example.com","not-a-domain","https://","a b.com","https://example.com\\evil"]],
]) it(`${platform} rejects invalid account inputs`,()=>{for(const input of inputs)assert.throws(()=>normalize(platform,input));});
it("rejects malformed Unicode, controls, empty input and unsupported platforms",()=>{
  for(const platform of socialPlatforms)for(const value of ["","\ud800","abc\0","abc\n"])assert.throws(()=>normalize(platform,value));
  assert.throws(()=>normalize("Other","example.com"));
});
it("preserves ambiguous legacy rows without guessing or rewriting",()=>{
  const row={label:"Old custom resource",url:"https://example.com/path"};
  assert.equal(presentSocialAccount(row).legacy,true);assert.equal(presentSocialAccount(row).url,row.url);
  assert.equal(presentSocialAccount({label:"Personal",url:"https://instagram.com/user"}).platform,"Instagram");
});
it("viewers own their accounts, admins manage others, other roles cannot choose someone else",()=>{
  for(const role of ["viewer","contributor","editor"]){assert.equal(canManageSocial(role,"a","a"),true);assert.equal(canManageSocial(role,"a","b"),false);}
  assert.equal(canManageSocial("admin","a","b"),true);
});
it("keeps navigation, importer protection, and canonical version source",async()=>{
  const read=path=>readFile(new URL(path,import.meta.url),"utf8");
  const shell=await read("../src/components/app-shell.tsx");
  assert.match(shell,/label: "Reference Hub"[^\n]+\n\s*\{ href: "\/links\/social", label: "Social Directory"/);
  assert.match(shell,/import \{ version \} from "\.\.\/\.\.\/package.json"/);assert.match(shell,/T\.I\.K\.I\. v\{version\}/);assert.doesNotMatch(shell,/T\.I\.K\.I\. v\d/);
  const hub=await read("../src/components/reference-hub.tsx");assert.doesNotMatch(hub,/href="\/links\/(social|import)"/);assert.match(hub,/Add Reference/);
  assert.match(await read("../src/app/(portal)/links/import/page.tsx"),/requireActiveProfile\("admin"\)/);
});
