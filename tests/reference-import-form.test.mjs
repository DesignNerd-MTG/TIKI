import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

it("keeps the actual import component's controlled manifest through validation, batches and errors",async()=>{
  const source=await readFile(new URL("../src/components/reference-controls.tsx",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const hooks=[];
  let cursor=0;
  const submissions=[];
  const responses=[{ok:true,message:"12 ready"},{ok:true,message:"10 imported; 2 remain"},{ok:false,message:"Retry"},{ok:true,message:"2 imported; 0 remain"}];
  const action=async (_state,form)=>{
    submissions.push({mode:form.get("mode"),manifest:form.get("manifest")});
    return responses.shift();
  };
  // Tiny hook/JSX harness exercises the real component without new browser dependencies.
  // A React form reset cannot replace the value supplied by controlled component state.
  const react={
    useState(initial){const slot=cursor++;if(!(slot in hooks))hooks[slot]=initial;return [hooks[slot],value=>{hooks[slot]=value;}];},
    useActionState(fn,initial){const slot=cursor++;if(!(slot in hooks))hooks[slot]=initial;return [hooks[slot],async form=>{hooks[slot]=await fn(hooks[slot],form);},false];},
  };
  const jsx=(type,props)=>({type,props});
  const exports={};
  vm.runInNewContext(compiled,{exports,require(name){
    if(name==="react")return react;
    if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
    if(name==="next/navigation")return {};
    if(name.endsWith("reference-actions"))return {importNotionAction:action};
    throw new Error("Unexpected import: "+name);
  }});
  const render=()=>{cursor=0;return exports.NotionImportForm();};
  function find(node,type){
    if(!node||typeof node!=="object")return null;
    if(node.type===type)return node;
    for(const child of [node.props?.children].flat(Infinity)){const found=find(child,type);if(found)return found;}
    return null;
  }
  const manifest='{"bookmarks":[{"title":"Keep my source snapshot"}]}';
  find(render(),"textarea").props.onChange({target:{value:manifest}});
  for(const mode of ["preview","import","import","import"]){
    const form=render();
    assert.equal(find(form,"textarea").props.value,manifest);
    const data=new FormData();data.set("manifest",find(form,"textarea").props.value);data.set("mode",mode);
    await form.props.action(data);
    assert.equal(find(render(),"textarea").props.value,manifest);
  }
  assert.deepEqual(submissions.map(row=>row.manifest),Array(4).fill(manifest));
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
