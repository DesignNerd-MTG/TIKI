import { crc32, deflateRawSync } from "node:zlib";

// Synthetic ZIPs only. No manufacturer packages or downloaded copyrighted assets.
export function zipFixture(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? "");
    const compressed = entry.deflate ? deflateRawSync(data) : data;
    const checksum = entry.crc ?? crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(entry.flags ?? 0, 6); header.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(entry.size ?? data.length, 22); header.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(0x314, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(entry.flags ?? 0, 8); directory.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(entry.size ?? data.length, 24); directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(entry.attributes ?? 0, 38); directory.writeUInt32LE(offset, 42);
    local.push(header, name, compressed); central.push(directory, name);
    offset += header.length + name.length + compressed.length;
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}
export const gdtfXml = (body = "", attributes = 'Name="Synthetic" Manufacturer="HES"', version = "1.2") => `<?xml version="1.0" encoding="UTF-8"?><GDTF DataVersion="${version}"><FixtureType ${attributes}>${body}</FixtureType></GDTF>`;
export const gdtfZip = (xml, options = {}) => zipFixture([{ name: "description.xml", data: xml, ...options }]);
export const modeXml = (name, channels) => `<DMXMode Name="${name}"><DMXChannels>${channels}</DMXChannels></DMXMode>`;
export const channelXml = (offset, dmxBreak = "1") => `<DMXChannel Offset="${offset}" DMXBreak="${dmxBreak}"/>`;
