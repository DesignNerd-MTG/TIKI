import assert from "node:assert/strict";
import { it } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as reviewHelpers from "../src/lib/gdtf-review.ts";
import * as parser from "../src/lib/gdtf.ts";
import { gdtfXml, gdtfZip } from "./gdtf-fixture.mjs";

async function load(path, dependencies, globals = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, File, Buffer, Error, ...globals, require(name) { if (name in dependencies) return dependencies[name]; throw Error(name); } });
  return exports;
}
const nodes = (node) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];

it("actual creation flow reviews upload, explicitly selects mode, then prefills the normal editor without saving", async () => {
  const hooks = []; let cursor = 0, task, uploads = 0, fail = false;
  const react = {
    useState(initial) { const slot = cursor++; if (!(slot in hooks)) hooks[slot] = initial; return [hooks[slot], (value) => { hooks[slot] = value; }]; },
    useTransition() { return [false, (fn) => { task = fn(); }]; },
  };
  const jsx = (type, props) => ({ type, props });
  function Editor() {}
  const review = { name: "Sample", manufacturer: "HES", description: "Review notes", version: "1.2", weightLb: 53.6, warnings: ["Check IP Rating"], modes: [{ name: "35ch", footprint: 35, warning: "" }, { name: "49ch", footprint: 49, warning: "" }] };
  const component = await load("src/components/fixture-create.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "@/components/content-editor": { ContentEditor: Editor },
    "@/lib/gdtf-review": reviewHelpers,
    "@/app/(portal)/fixtures/new/gdtf-action": { reviewGdtfAction: async () => { uploads++; if (fail) throw Error("network failure"); return { review }; } },
  }, { window: { confirm: () => true } });
  const props = { statuses: ["draft"], manufacturers: [{ id: "hes", name: "High End Systems", active: true, aliases: ["HES"] }], canAddManufacturer: false };
  const render = () => { cursor = 0; return component.FixtureCreate(props); };
  const find = (test) => nodes(render()).find(test);
  assert.ok(find((n) => n.type === Editor)); assert.equal(uploads, 0);
  find((n) => n.props.children === "Import GDTF").props.onClick();
  assert.equal(find((n) => n.type === Editor), undefined);
  find((n) => n.type === "form").props.action(new FormData()); await task;
  assert.equal(uploads, 1); assert.equal(find((n) => n.type === Editor), undefined);
  assert.equal(find((n) => n.type === "select").props.value, "");
  assert.equal(find((n) => n.props.children === "Confirm mode choice & edit fields").props.disabled, true);
  find((n) => n.type === "select").props.onChange({ target: { value: "1" } });
  find((n) => n.props.children === "Confirm mode choice & edit fields").props.onClick();
  const editor = find((n) => n.type === Editor);
  assert.equal(editor.props.initialValues.preferred_mode, "49ch"); assert.equal(editor.props.initialValues.dmx_footprint, 49);
  assert.equal(editor.props.initialValues.manufacturer_id, "hes"); assert.equal(editor.props.initialValues.weight_lb, 53.6);
  assert.equal(editor.props.initialValues.ip_rating, ""); assert.equal(editor.props.record, undefined);
  assert.equal(find((n) => n.props.name === "gdtf"), undefined);
  find((n) => n.props.children === "Add Manually").props.onClick(); assert.ok(find((n) => n.type === Editor));
  find((n) => n.props.children === "Import GDTF").props.onClick(); fail = true;
  find((n) => n.type === "form").props.action(new FormData()); await task;
  assert.match(find((n) => n.props.role === "alert").props.children, /could not be completed/);
  assert.equal(find((n) => n.type === Editor), undefined);
});

it("actual upload action denies unauthorized roles before reading bytes and reports errors without persistence", async () => {
  let allowed = true, calls = 0;
  const action = await load("src/app/(portal)/fixtures/new/gdtf-action.ts", {
    "@/lib/auth": { requireActiveProfile: async (minimum) => { assert.equal(minimum, "contributor"); if (!allowed) throw Error("Denied"); } },
    "@/lib/gdtf": { ...parser, parseGdtf: async (...args) => { calls++; return parser.parseGdtf(...args); } },
  });
  const form = new FormData(); form.set("gdtf", new File([gdtfZip(gdtfXml())], "sample.gdtf"));
  assert.equal((await action.reviewGdtfAction(form)).review.name, "Synthetic"); assert.equal(calls, 1);
  allowed = false; await assert.rejects(() => action.reviewGdtfAction(form), /Denied/); assert.equal(calls, 1);
  allowed = true;
  form.set("gdtf", new File([Buffer.alloc(parser.gdtfLimits.upload + 1)], "big.gdtf"));
  assert.match((await action.reviewGdtfAction(form)).error, /2 MB/); assert.equal(calls, 1);
  form.set("gdtf", new File(["bad"], "bad.gdtf")); assert.match((await action.reviewGdtfAction(form)).error, /ZIP archive/);
  form.delete("gdtf"); assert.match((await action.reviewGdtfAction(form)).error, /non-empty/);
});
