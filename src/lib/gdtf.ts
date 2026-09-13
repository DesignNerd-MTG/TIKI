// Server-only dependency graph: imported only by the authenticated upload action/tests.
// No filesystem extraction, network access, resource execution, or archive persistence.
import { fromBuffer, type Entry, type ZipFile } from "yauzl";
import { crc32 } from "node:zlib";
import type { Readable } from "node:stream";
import { SaxesParser } from "saxes";
import { kilogramsToPounds, validFixtureWeight } from "./fixture-physical.ts";
import type { GdtfMode, GdtfReview } from "./gdtf-review.ts";
import { gdtfUploadLimit, validateGdtfUpload } from "./gdtf-review.ts";

export const gdtfLimits = { upload: gdtfUploadLimit, xml: 1024 * 1024, entries: 1024, expanded: 32 * 1024 * 1024, ratio: 200, nodes: 20000, depth: 64, modes: 128, milliseconds: 3000 };
export class GdtfError extends Error {}
const reject = (message: string): never => { throw new GdtfError(message); };

function archivePayload(buffer: Buffer, wrapper: boolean, budget: { expanded: number; entries: number }): Promise<Buffer> {
  return new Promise((resolve, rejectPromise) => {
    let zip: ZipFile | undefined;
    let stream: Readable | undefined;
    let settled = false;
    const finish = (error?: Error, data?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream?.destroy();
      zip?.close();
      if (error) rejectPromise(error); else resolve(data!);
    };
    const timer = setTimeout(() => finish(new GdtfError("GDTF archive inspection timed out. Try a smaller file.")), gdtfLimits.milliseconds);
    fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, opened) => {
      if (settled) { opened?.close(); return; }
      if (error || !opened) { finish(new GdtfError("This is not a readable GDTF ZIP archive.")); return; }
      zip = opened;
      zip.on("error", () => finish(new GdtfError("The GDTF archive is damaged or unsafe.")));
      if (zip.entryCount > gdtfLimits.entries) { finish(new GdtfError("GDTF contains too many archive entries.")); return; }
      let description: Entry | undefined;
      let payloadCount = 0;
      const names = new Set<string>();
      zip.on("entry", (entry: Entry) => {
        if (settled) return;
        const name = entry.fileName;
        const unixType = (entry.externalFileAttributes >>> 16) & 0xf000;
        budget.expanded += entry.uncompressedSize;
        budget.entries += 1;
        if (name.length > 512 || !name.isWellFormed() || /[\\:\u0000-\u001f]/.test(name) || name.startsWith("/") || name.split("/").some((part) => part === ".." || part === ".") || unixType === 0xa000 || names.has(name.toLowerCase())) {
          finish(new GdtfError("GDTF contains unsafe or duplicate archive paths.")); return;
        }
        names.add(name.toLowerCase());
        if (budget.entries > gdtfLimits.entries || budget.expanded > gdtfLimits.expanded || entry.uncompressedSize > Math.max(1, entry.compressedSize) * gdtfLimits.ratio) {
          finish(new GdtfError("GDTF archive expansion exceeds the safety limit.")); return;
        }
        if ((entry.generalPurposeBitFlag & 1) || ![0, 8].includes(entry.compressionMethod)) {
          finish(new GdtfError("Encrypted or unsupported GDTF archives are not accepted.")); return;
        }
        if (wrapper && /\.zip$/i.test(name)) { finish(new GdtfError("Only one outer ZIP wrapper is supported; nested ZIPs are not allowed.")); return; }
        if (wrapper ? /\.gdtf$/i.test(name) : name === "description.xml") { description = entry; payloadCount += 1; }
        zip!.readEntry();
      });
      zip.on("end", () => {
        if (settled) return;
        if (!description) { finish(new GdtfError(wrapper ? "Wrapper ZIP must contain exactly one .gdtf payload." : "GDTF must contain description.xml at the archive root.")); return; }
        if (payloadCount !== 1) { finish(new GdtfError("Wrapper ZIP contains multiple GDTFs. Choose a package with exactly one fixture.")); return; }
        const limit = wrapper ? gdtfLimits.upload : gdtfLimits.xml;
        if (description.uncompressedSize > limit) { finish(new GdtfError(wrapper ? "The inner GDTF exceeds the 4 MB safety limit." : "GDTF description.xml exceeds the 1 MB limit.")); return; }
        const expected = description;
        zip!.openReadStream(expected, (error, openedStream) => {
          if (settled) { openedStream?.destroy(); return; }
          if (error || !openedStream) { finish(new GdtfError("GDTF description.xml could not be read.")); return; }
          stream = openedStream;
          const chunks: Buffer[] = [];
          let size = 0;
          stream.on("error", () => finish(new GdtfError("GDTF description.xml is damaged.")));
          stream.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > limit) { finish(new GdtfError("GDTF payload expansion exceeds the safety limit.")); return; }
            chunks.push(chunk);
          });
          stream.on("end", () => {
            if (settled) return;
            const data = Buffer.concat(chunks);
            if (size !== expected.uncompressedSize || crc32(data) !== expected.crc32) finish(new GdtfError("GDTF description.xml failed its integrity check."));
            else finish(undefined, data);
          });
        });
      });
      zip.readEntry();
    });
  });
}

type XmlNode = { name: string; attributes: Record<string, string>; children: XmlNode[] };
const children = (node: XmlNode | undefined, name: string) => node?.children.filter((child) => child.name === name) ?? [];
const child = (node: XmlNode | undefined, name: string) => children(node, name)[0];

function parseXml(data: Buffer) {
  let xml: string;
  try { xml = new TextDecoder("utf-8", { fatal: true }).decode(data); }
  catch { return reject("GDTF XML must be valid UTF-8."); }
  const parser = new SaxesParser({ xmlns: false });
  let root: XmlNode | undefined;
  const stack: XmlNode[] = [];
  let count = 0;
  const deadline = Date.now() + gdtfLimits.milliseconds;
  parser.on("doctype", () => reject("XML document types and external entities are not allowed."));
  parser.on("processinginstruction", () => reject("XML processing instructions are not allowed."));
  parser.on("error", () => reject("GDTF description.xml is malformed. Re-export the fixture and try again."));
  parser.on("opentag", (tag) => {
    if (++count > gdtfLimits.nodes || stack.length >= gdtfLimits.depth || Object.keys(tag.attributes).length > 64 || Date.now() > deadline) reject("GDTF XML complexity exceeds the safety limit.");
    const node: XmlNode = { name: tag.name, attributes: tag.attributes, children: [] };
    if (stack.length) stack[stack.length - 1].children.push(node); else root = node;
    stack.push(node);
  });
  parser.on("closetag", () => { stack.pop(); });
  parser.write(xml).close();
  if (!root || (root as XmlNode).name !== "GDTF") return reject("XML does not contain a GDTF root.");
  return root as XmlNode;
}

// Bound by UTF-16 field limits without splitting supplementary Unicode characters.
function metadata(value: string | undefined, limit: number) {
  let result = "";
  for (const point of (value ?? "").toWellFormed().trim()) {
    if (result.length + point.length > limit) break;
    result += point;
  }
  return result;
}

function containsReference(node: XmlNode | undefined): boolean {
  return Boolean(node && (node.name === "GeometryReference" || node.children.some(containsReference)));
}

function modeSummary(mode: XmlNode, geometries: XmlNode | undefined, knownVersion: boolean): GdtfMode {
  const name = metadata(mode.attributes.Name, 160);
  const uncertain = (warning: string): GdtfMode => ({ name, footprint: null, warning });
  if (!knownVersion) return uncertain("Unsupported GDTF version: verify the footprint manually.");
  // Geometry instances can remap/replicate addresses. Never report a base-template
  // footprint as the final instantiated footprint. This subset intentionally defers them.
  if (containsReference(geometries)) return uncertain("Geometry references may remap addresses: verify the footprint manually.");
  const channels = children(child(mode, "DMXChannels"), "DMXChannel");
  if (!channels.length) return uncertain("No DMX channel definitions found.");
  const breaks = new Map<number, Set<number>>();
  for (const channel of channels) {
    const offset = channel.attributes.Offset?.trim() ?? "None";
    if (offset === "None") continue; // virtual channels consume no addresses
    const dmxBreak = channel.attributes.DMXBreak ?? "1";
    if (!/^\d+$/.test(dmxBreak) || Number(dmxBreak) < 1 || Number(dmxBreak) > 255) return uncertain("Unsupported or malformed DMX break: verify manually.");
    const values = offset.split(",").map((value) => value.trim());
    if (!values.length || values.length > 4 || values.some((value) => !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 512)) return uncertain("Malformed DMX offsets: verify the footprint manually.");
    const addresses = breaks.get(Number(dmxBreak)) ?? new Set<number>();
    for (const value of values) {
      if (addresses.has(Number(value))) return uncertain("Overlapping DMX offsets: verify the footprint manually.");
      addresses.add(Number(value));
    }
    breaks.set(Number(dmxBreak), addresses);
  }
  if (breaks.size !== 1) return uncertain(breaks.size ? "Multiple DMX breaks cannot be represented by one footprint; verify manually." : "Only virtual channels found; enter a footprint only if applicable.");
  return { name, footprint: Math.max(...breaks.values().next().value!), warning: "" };
}

export async function parseGdtf(buffer: Buffer, filename: string): Promise<GdtfReview> {
  const error = validateGdtfUpload({ name: filename, size: buffer.length });
  if (error) return reject(error);
  const budget = { expanded: 0, entries: 0 };
  const inner = /\.gdtf\.zip$/i.test(filename) ? await archivePayload(buffer, true, budget) : buffer;
  const root = parseXml(await archivePayload(inner, false, budget));
  const fixtures = children(root, "FixtureType");
  if (fixtures.length !== 1) return reject("GDTF must describe exactly one FixtureType.");
  const fixture = fixtures[0];
  const version = metadata(root.attributes.DataVersion, 40);
  const knownVersion = ["1.0", "1.1", "1.2"].includes(version);
  const warnings: string[] = [];
  if (!knownVersion) warnings.push("Unknown GDTF version. Names and description are available for review; physical data and footprints are not trusted.");
  const rawName = fixture.attributes.LongName || fixture.attributes.Name;
  const name = metadata(rawName, 160);
  // Do not auto-resolve a truncated manufacturer to a different canonical name.
  const rawManufacturer = fixture.attributes.Manufacturer ?? "";
  const manufacturer = rawManufacturer.trim().length > 120 ? "" : metadata(rawManufacturer, 120);
  const description = metadata(fixture.attributes.Description, 4000);
  if (!name) warnings.push("Fixture name is missing. Enter it during review.");
  if (!manufacturer) warnings.push("Manufacturer is missing or too long. Choose its canonical manufacturer during review.");
  if ((rawName?.trim().length ?? 0) > 160 || (fixture.attributes.Description?.trim().length ?? 0) > 4000) warnings.push("Long name or description was shortened to T.I.K.I. field limits. Review before saving.");
  const rawWeight = child(child(child(fixture, "PhysicalDescriptions"), "Properties"), "Weight")?.attributes.Value;
  const kilograms = rawWeight && /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(rawWeight.trim()) ? Number(rawWeight) : NaN;
  const pounds = kilogramsToPounds(kilograms);
  const weightLb = knownVersion && validFixtureWeight(pounds) ? Number(pounds.toPrecision(12)) : null;
  if (weightLb === null) warnings.push("No reliable fixture weight supplied. Weight is left blank.");
  warnings.push("IP Rating has no reliable standard mapping in this supported GDTF subset. Choose it from an authoritative specification.");
  if (fixture.attributes.Thumbnail) warnings.push("Archive thumbnail is not imported. Embedded images/models are not extracted or displayed.");
  const modeNodes = children(child(fixture, "DMXModes"), "DMXMode");
  if (modeNodes.length > gdtfLimits.modes) return reject("GDTF contains too many modes to review safely (maximum 128).");
  const modes = modeNodes.map((mode) => modeSummary(mode, child(fixture, "Geometries"), knownVersion));
  if (!modes.length) warnings.push("No DMX modes found. Enter preferred mode and footprint manually if known.");
  return { version, name, manufacturer, description, weightLb, modes, warnings };
}
