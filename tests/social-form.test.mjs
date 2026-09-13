import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as social from "../src/lib/social-accounts.ts";

it("actual social form switches fields, preserves row identity, and adds another independently",async()=>{
  const source=await readFile(new URL("../src/components/social-accounts.tsx",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  let hooks=[],cursor=0;const submitted=[];
  const react={useId:()=>"test-error",useEffect:()=>{},
    useState(initial){const slot=cursor++;if(!(slot in hooks))hooks[slot]=initial;return [hooks[slot],value=>{hooks[slot]=value;}];},
    useActionState(fn,initial){const slot=cursor++;if(!(slot in hooks))hooks[slot]=initial;return [hooks[slot],async form=>{hooks[slot]=await fn(hooks[slot],form);},false];},
  };
  const jsx=(type,props)=>({type,props});const exports={};
  vm.runInNewContext(compiled,{exports,require(name){
    if(name==="react")return react;
    if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
    if(name==="next/navigation")return {useRouter:()=>({refresh(){}})};
    if(name.endsWith("social-accounts"))return social;
    if(name.endsWith("social/actions"))return {saveSocialAccountAction:async(_state,form)=>{submitted.push(Object.fromEntries(form));return {ok:true,message:"Saved"};}};
    throw Error(name);
  }});
  function nodes(node){return !node||typeof node!=="object"?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
  const render=props=>{cursor=0;return exports.SocialAccountEditor(props);};
  const find=(tree,test)=>nodes(tree).find(test);
  const item={id:"row-1",profile_id:"owner",label:"Instagram",url:"https://www.instagram.com/original/",display_name:"Owner"};
  let props={item,actorId:"owner"};
  find(render(props),n=>n.type==="button").props.onClick();
  assert.equal(find(render(props),n=>n.props.name==="id").props.value,"row-1");
  assert.equal(find(render(props),n=>n.props.name==="account").props.value,"@original");
  find(render(props),n=>n.props.name==="platform").props.onChange({target:{value:"TikTok"}});
  assert.equal(find(render(props),n=>n.props.name==="account").props.placeholder,"@mtgdesigns");
  find(render(props),n=>n.props.name==="platform").props.onChange({target:{value:"Personal Website"}});
  assert.equal(find(render(props),n=>n.props.name==="account").props.placeholder,"mtgdesigns.net");
  assert.equal(find(render(props),n=>n.props.name==="profile_id"),undefined);
  hooks=[];props={actorId:"owner"};
  for(let i=0;i<2;i++){
    find(render(props),n=>n.type==="button").props.onClick();
    find(render(props),n=>n.props.name==="account").props.onChange({target:{value:"account"+i}});
    assert.equal(find(render(props),n=>n.props.name==="id"),undefined);
    const form=new FormData();form.set("platform","Instagram");form.set("account","account"+i);
    await find(render(props),n=>n.type==="form").props.action(form);
    assert.equal(find(render(props),n=>n.type==="button").props.children,"+ Add another account");
  }
  assert.deepEqual(submitted.map(row=>row.account),["account0","account1"]);
  hooks=[];props={actorId:"admin",targets:[{profile_id:"owner",display_name:"Owner"}]};
  find(render(props),n=>n.type==="button").props.onClick();
  assert.ok(find(render(props),n=>n.props.name==="profile_id"));
});
