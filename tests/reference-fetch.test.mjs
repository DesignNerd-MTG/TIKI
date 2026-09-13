import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicAddress, parseFetchUrl, safeFetch, checkReference, extractMetadata, pinnedRequest } from "../src/lib/reference-fetch.ts";
import https from "node:https";
import { EventEmitter } from "node:events";

const publicAddress = { address: "93.184.216.34", family: 4 };
const reply = (status=200, headers={"content-type":"text/html"}, body="<title>Useful page</title>") => ({status,headers,body:Buffer.from(body)});
const dependencies = (request) => ({resolve:async()=>[publicAddress],request});

describe("Reference metadata and SSRF boundary", () => {
  it("blocks private/reserved IPv4 and IPv6, mapped IPv4, metadata and odd encodings", () => {
    for (const ip of ["127.0.0.1","0.0.0.0","10.1.2.3","172.16.0.1","192.168.0.1","100.64.0.1","169.254.169.254","198.18.0.1","192.0.2.1","224.0.0.1","255.255.255.255","::1","::ffff:127.0.0.1","fe80::1","fc00::1","2001:db8::1","2002:7f00:1::1","64:ff9b::7f00:1"]) assert.equal(isPublicAddress(ip),false,ip);
    assert.equal(isPublicAddress("8.8.8.8"),true);
    assert.equal(isPublicAddress("2606:4700:4700::1111"),true);
    for (const url of ["http://localhost","http://127.1","http://2130706433","http://0x7f000001","http://[::1]","http://[::ffff:127.0.0.1]","http://metadata.google.internal","file:///etc/passwd","https://user:pass@public.com","https://public.com:1234"]) assert.throws(()=>parseFetchUrl(url),url);
  });
  it("rejects mixed DNS answers and private redirect targets before connection", async () => {
    let requests=0;
    const mixed = {resolve:async()=>[publicAddress,{address:"10.0.0.1",family:4}],request:async()=>{requests++;return reply();}};
    await assert.rejects(()=>safeFetch("https://public.com",mixed));
    assert.equal(requests,0);
    await assert.rejects(()=>safeFetch("https://public.com",dependencies(async()=>{requests++;return reply(302,{location:"http://169.254.169.254/latest/meta-data"});})));
    assert.equal(requests,1);
  });
  it("checks DNS again at every redirect and pins each connection", async () => {
    let resolutions=0, requests=0;
    const deps={resolve:async()=>{resolutions++;return resolutions===1?[publicAddress]:[{address:"127.0.0.1",family:4}];},request:async(_url,address)=>{assert.deepEqual(address,publicAddress);requests++;return reply(302,{location:"/next"});}};
    await assert.rejects(()=>safeFetch("https://public.com",deps));
    assert.equal(resolutions,2); assert.equal(requests,1);
  });
  it("uses the pinned address in the actual transport lookup without changing TLS host", async () => {
    const original=https.request;
    try {
      https.request=(url,options,callback)=>{
        assert.equal(url.hostname,"public.com");
        assert.equal(options.agent,false);
        options.lookup("public.com",{all:true},(_error,addresses)=>assert.deepEqual(addresses,[publicAddress]));
        options.lookup("public.com",{},(_error,address,family)=>{assert.equal(address,publicAddress.address);assert.equal(family,4);});
        const req=new EventEmitter();
        req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers={};callback(res);res.emit("data",Buffer.from("ok"));res.emit("end");};
        return req;
      };
      const result=await pinnedRequest(new URL("https://public.com"),publicAddress,new AbortController().signal,100);
      assert.equal(result.body.toString(),"ok");
    } finally {https.request=original;}
  });
  it("bounds redirects, response size and total time including stalled DNS", async () => {
    let requests=0;
    await assert.rejects(()=>safeFetch("https://public.com",dependencies(async()=>{requests++;return reply(302,{location:"/again"});})));
    assert.equal(requests,4);
    await assert.rejects(()=>safeFetch("https://public.com",dependencies(async()=>reply(200,{}, "x".repeat(101))),100));
    await assert.rejects(()=>safeFetch("https://public.com",{resolve:()=>new Promise(()=>{}),request:async()=>reply()},100,10),/timed out/);
  });
  it("rejects oversized declared and streamed bodies without an unhandled response error", async () => {
    const original=https.request;
    try {
      for (const declared of [true,false]) {
        https.request=(_url,_options,callback)=>{
          const req=new EventEmitter();
          req.end=()=>{
            const res=new EventEmitter(); res.statusCode=200; res.headers=declared?{"content-length":"101"}:{};
            res.destroy=error=>res.emit("error",error);
            callback(res);
            if(!declared) res.emit("data",Buffer.alloc(101));
          };
          return req;
        };
        await assert.rejects(()=>pinnedRequest(new URL("https://public.com"),publicAddress,new AbortController().signal,100),/too large/);
      }
    } finally {https.request=original;}
  });
  it("extracts normal, Open Graph and Twitter metadata without executable markup", () => {
    const data=extractMetadata('<title>Normal</title><meta property="og:title" content="OG &amp; title"><meta property="og:site_name" content="Site"><meta name="twitter:image" content="/preview.jpg"><link href="/icon.png" rel="shortcut icon">',"https://public.com/page");
    assert.equal(data.fetched_title,"OG & title");
    assert.equal(data.site_name,"Site");
    assert.equal(data.preview_image_url,"https://public.com/preview.jpg");
    assert.equal(data.favicon_url,"https://public.com/icon.png");
    assert.equal(extractMetadata('<meta property="og:image" content="http://127.0.0.1/secret">',"https://public.com").preview_image_url,null);
  });
  it("records redirect health and final URL while retaining saveable failure states", async () => {
    let calls=0;
    const redirect=await checkReference("https://public.com",dependencies(async()=>++calls===1?reply(301,{location:"https://other.com/final"}):reply()));
    assert.equal(redirect.link_health,"redirected");
    assert.equal(redirect.final_url,"https://other.com/final");
    assert.equal(redirect.fetched_title,"Useful page");
    assert.ok(redirect.last_checked_at);
    for(const status of [401,403,429,500]) assert.equal((await checkReference("https://public.com",dependencies(async()=>reply(status)))).link_health,"could_not_verify");
    assert.equal((await checkReference("https://public.com",dependencies(async()=>reply(404)))).link_health,"unavailable");
    assert.equal((await checkReference("https://public.com",dependencies(async()=>{throw new Error("network");}))).link_health,"could_not_verify");
    assert.equal((await checkReference("https://public.com",dependencies(async()=>reply()))).link_health,"healthy");
  });
});
