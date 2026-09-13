import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile } from "node:fs/promises";
import { vendorSort, normalizeVendorContacts, validVendorEmail } from "../src/lib/vendor-directory.ts";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

it("keeps the exact top-level sidebar order and one compact Napkins group", async () => {
  const shell = await read("src/components/app-shell.tsx");
  const labels = [...shell.matchAll(/href: "[^"]+", label: "([^"]+)"[^\n]+(?:group: true)?/g)].map((match) => match[1]);
  assert.deepEqual(labels.slice(0, 12), ["Dashboard","Shows","Fixtures","Locations","Vendors / Manufacturers","Reference Hub","Social Directory","Napkins","Drinks","My Account","Travel Prefs","Admin"]);
  assert.equal(labels.filter((label) => label === "Napkins").length, 1);
  for (const token of ["aria-expanded={napkinsExpanded}","onClick={() =>","nav-link--child","setOpen(false)"]) assert.ok(shell.includes(token));
  assert.match(shell, /hasMinimumRole\(role, item\.minimum\)/);
  assert.match(shell, /href="\/account"[^>]+aria-label="Open My Account"/);
});

it("orders and labels all Napkin children while preserving routes", async () => {
  const shell = await read("src/components/app-shell.tsx");
  const block = shell.slice(shell.indexOf("export const napkinNavigation"), shell.indexOf("type AppShellProps"));
  const rows = [...block.matchAll(/href: "([^"]+)", label: "([^"]+)"/g)].map((match) => match.slice(1));
  assert.deepEqual(rows, [["/napkin","Add a Napkin"],["/napkin/pile","Stack O' Napkins"],["/napkin/queue","Napkins to Review"],["/napkin/pinned","Pinned Napkins"]]);
  assert.match(await read("src/app/(portal)/napkin/pile/page.tsx"), /title: "Stack O' Napkins"/);
  assert.match(await read("src/app/(portal)/napkin/queue/page.tsx"), /title: "Napkins to Review"/);
});

it("uses canonical protected identity for My Account, Social, and Pinned Napkins", async () => {
  const account = await read("src/app/(portal)/account/page.tsx");
  assert.match(account,/requireActiveProfile\(\)/); assert.match(account,/title="My Account"/); assert.match(account,/<DirectoryName/); assert.match(account,/<AvatarEditor/);
  const pinned = await read("src/app/(portal)/napkin/pinned/page.tsx");
  assert.match(pinned,/napkin_poster_identities/); assert.match(pinned,/<MemberAvatar id=\{authorId\} name=\{name\}/); assert.match(pinned,/href=\{`\/napkin\/\$\{record\.id\}`\}/);
  assert.doesNotMatch(pinned,/avatar_url|travel_profiles|email/);
});

it("keeps pin state independent and pin mutations owner/role checked", async () => {
  const migration = await read("supabase/migrations/202609140016_napkins_vendor_directory.sql");
  assert.match(migration,/pinned boolean not null default false/); assert.doesNotMatch(migration,/set status.*pinned|urgent.*=/);
  const action = await read("src/app/(portal)/napkin/actions.ts"); assert.match(action,/canEditContent/); assert.match(action,/update\(\{ pinned \}\)/);
});

it("normalizes vendor sort/contact inputs and validates optional email", () => {
  assert.equal(vendorSort(),"name-asc"); assert.equal(vendorSort("city-desc"),"city-desc"); assert.equal(vendorSort("bad"),"name-asc");
  assert.equal(validVendorEmail(""),true); assert.equal(validVendorEmail("sales@example.com"),true); assert.equal(validVendorEmail("bad@"),false);
  assert.deepEqual(normalizeVendorContacts([{name:" Jane ",title:" Sales ",email:" ",cell:" +44 20 1234 ",is_primary:true,sort_order:9}]),[{name:"Jane",title:"Sales",email:null,cell:"+44 20 1234",is_primary:true,sort_order:0}]);
});

it("excludes private Travel data from global search and preserves Flighty behavior", async () => {
  const search=await read("src/app/(portal)/search/page.tsx"); assert.doesNotMatch(search,/travel_profiles|matchesTravelProfileName|travel_details/);
  const travel=await read("src/app/(portal)/travel/page.tsx"); assert.match(travel,/title: "Travel Prefs"/); assert.match(travel,/flighty_url/); assert.match(travel,/visible only to your signed-in account/);
});

it("implements complete-set vendor search/sort before offset and limit", async () => {
  const sql=await read("supabase/migrations/202609140016_napkins_vendor_directory.sql");
  for(const field of ["c.name ilike","c.title","c.email","v.city","v.name"]) assert.ok(sql.includes(field));
  assert.ok(sql.indexOf("order by\n    case when sort_order") < sql.indexOf("offset greatest"));
  assert.match(sql,/unique index[^\n]+vendor_contacts_one_primary_idx[^\n]+where is_primary/);
  assert.doesNotMatch(sql,/fixture_manufacturers/);
});
