import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { validateContentInput } from "../src/lib/content-validation.ts";
import { prepareNotionImport } from "../src/lib/notion-import.ts";
import { legacyCollectionMap, referenceCollection, referenceCollections, validCollectionPair } from "../src/lib/references.ts";
import { canEditContent } from "../src/lib/content-rules.ts";

describe("Reference capture and migration",()=>{
  it("allows URL-only capture, defaulting to Unsorted with a title and Date Added",()=>{
    const result=validateContentInput("link","contributor",{url:"https://www.etcconnect.com"});
    assert.equal(result.valid,true);
    assert.equal(result.payload.label,"www.etcconnect.com");
    assert.equal(result.payload.collection_id,"unsorted");
    assert.equal(result.payload.status,"draft");
    assert.ok(result.payload.date_added);
  });
  it("preserves Date Added and accepts only valid collection/subcollection pairs",()=>{
    const input={url:"https://www.etcconnect.com",collection_id:"control-systems",subcollection_id:"consoles",date_added:"2022-03-04T10:30:00Z"};
    const result=validateContentInput("link","admin",input);
    assert.equal(result.valid,true);
    assert.equal(result.payload.date_added,input.date_added);
    assert.equal(result.payload.subcollection_id,"consoles");
    assert.equal(validateContentInput("link","admin",{...input,collection_id:"drafting"}).valid,false);
    assert.equal(validateContentInput("link","admin",{...input,date_added:"yesterday"}).valid,false);
    for (const date_added of ["2022-02-30T10:30:00Z","2022-03-04T10:30:00"]) {
      assert.equal(validateContentInput("link","admin",{...input,date_added}).valid,false);
    }
    assert.equal(validCollectionPair("consoles","nodes-networking"),false);
    assert.equal(referenceCollections.filter(c=>!c.parent_id).length,10);
  });
  it("retires the redundant Fixtures & Firmware collection without losing its references",async()=>{
    const sql=await readFile(new URL("../supabase/migrations/202609140008_retire_fixture_firmware_collection.sql",import.meta.url),"utf8");
    assert.equal(referenceCollection("fixtures-firmware"),undefined);
    assert.equal(legacyCollectionMap["Fixtures & Firmware"],"unsorted");
    assert.match(sql,/update public\.link_items[\s\S]*set collection_id = 'unsorted'/i);
    assert.match(sql,/where collection_id = 'fixtures-firmware'/i);
    assert.match(sql,/delete from public\.reference_collections[\s\S]*id = 'fixtures-firmware'/i);
    assert.match(sql,/disable trigger links_set_updated_at/i);
    assert.match(sql,/enable trigger links_set_updated_at/i);
  });
  it("accepts LDG / LDGE canonical resource links as a top-level collection",()=>{
    const result=validateContentInput("link","contributor",{url:"https://example.com/handbook",collection_id:"ldg-ldge-documents"});
    assert.equal(result.valid,true);
    assert.equal(result.payload.category,"LDG / LDGE Documents");
    assert.equal(validCollectionPair("ldg-ldge-documents",""),true);
    assert.equal(validCollectionPair("ldg-ldge-documents","consoles"),false);
  });
  it("keeps existing legacy links editable and recheck permission identical to edit",()=>{
    const legacy={label:"Old Link",url:"https://public.com",category:"Operations",status:"published"};
    assert.equal(validateContentInput("link","admin",legacy,"published").valid,true);
    const record={created_by:"owner",status:"draft"};
    assert.equal(canEditContent("contributor","owner","link",record),true);
    assert.equal(canEditContent("contributor","other","link",record),false);
    assert.equal(canEditContent("viewer","owner","link",record),false);
    assert.equal(canEditContent("editor","other","link",record),true);
  });
  it("ignores empty rows; never guesses missing bookmark URLs, timestamps, or page IDs",()=>{
    const good={notion_page_id:"11111111-1111-4111-8111-111111111111",title:"ETC",url:"https://www.etcconnect.com/",created_on:"2022-03-04T10:30:00Z",collection:"Consoles/Nodes/Software",tags:["console"]};
    const report=prepareNotionImport({bookmarks:[{},good,{...good,notion_page_id:"22222222222242228222222222222222",url:"",title:"GrandMA Software"},{...good,notion_page_id:"33333333333343338333333333333333",created_on:""},good]});
    assert.equal(report.ignored,1); assert.equal(report.records.length,1); assert.equal(report.issues.length,3);
    assert.equal(report.records[0].date_added,good.created_on);
    assert.equal(report.records[0].subcollection_id,null);
    assert.equal(report.records[0].collection_id,"control-systems");
    assert.equal(report.records[0].import_source,"notion:11111111111141118111111111111111");
    assert.deepEqual(prepareNotionImport({bookmarks:[good]}),prepareNotionImport({bookmarks:[good]}));
    const native=prepareNotionImport({bookmarks:[{...good,url:"",bookmark_url:"https://actual-source.com/"}]});
    assert.equal(native.records[0].url,"https://actual-source.com/");
  });
  it("retains private Travel details exclusion while using Reference Hub search",async()=>{
    const source=await readFile(new URL("../src/app/(portal)/search/page.tsx",import.meta.url),"utf8");
    assert.match(source,/rpc\("search_references"/);
    assert.doesNotMatch(source,/from\("travel_profiles"\)/);
    assert.doesNotMatch(source,/select\("[^"]*(?:passport|seat_preference|preferences|loyalty|date_of_birth)/);
  });
});
