// Optional maintainer refresh; runtime uses only the committed local dataset.
import { mkdir, writeFile } from "node:fs/promises";
import yauzl from "yauzl";

const base = "https://download.geonames.org/export/dump/";
async function download(name) {
  const response = await fetch(base + name, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const [archive, admin, countries] = await Promise.all([
  download("cities15000.zip"), download("admin1CodesASCII.txt"), download("countryInfo.txt"),
]);
const source = await new Promise((resolve, reject) => {
  yauzl.fromBuffer(archive, { lazyEntries: true }, (error, zip) => {
    if (error) return reject(error);
    zip.on("error", reject);
    zip.on("entry", (entry) => {
      if (entry.fileName !== "cities15000.txt") return zip.readEntry();
      zip.openReadStream(entry, (error, stream) => {
        if (error) return reject(error);
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => { zip.close(); resolve(Buffer.concat(chunks).toString("utf8")); });
      });
    });
    zip.readEntry();
  });
});
const regions = new Map(admin.toString("utf8").trim().split("\n").map((line) => { const f = line.split("\t"); return [f[0], f[1]]; }));
const countryNames = new Map(countries.toString("utf8").split("\n").filter((line) => line && !line.startsWith("#")).map((line) => { const f = line.split("\t"); return [f[0], f[4]]; }));
// Current populated places only. Exclude sections/neighborhoods (PPLX), historical,
// abandoned places, and all non-populated-place feature classes (venues/addresses).
const allowed = new Set(["PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLA5", "PPLC", "PPLG"]);
const rows = source.trim().split("\n").map((line) => line.split("\t")).filter((f) => f[6] === "P" && allowed.has(f[7])).map((f) => [
  f[0], f[1], regions.get(`${f[8]}.${f[10]}`) || "", f[8] === "US" ? f[10] : "",
  countryNames.get(f[8]) || f[8], f[8], Number(f[4]), Number(f[5]), Number(f[14]), f[2],
]).sort((a, b) => b[8] - a[8]);
await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(new URL("../src/data/show-cities.json", import.meta.url), JSON.stringify(rows));
console.log(`Saved ${rows.length} city records (${new Date().toISOString()}).`);
