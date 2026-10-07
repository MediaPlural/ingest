// lib/zip.js — a minimal, deterministic ZIP writer (STORED entries, no deps).
// Exists because the resolver never touches the filesystem and the one-click
// install lane needs /<slug>/archive.zip served from the embedded table.
// Uncompressed STORE is fine: manifests and docs are text; sizes are modest.
// Validated by unzip -t / python zipfile (CRC32 checked) in tests/zip.test.js.

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// Deterministic timestamp: 1980-01-01 00:00 (the DOS epoch) — same zip bytes
// for the same package content, every build.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

/**
 * zipBuild(entries) -> Buffer
 *   entries: [{ name: "dir/file.txt", data: Buffer }]
 * Names may contain "/" (implicit directories — unzip recreates paths).
 */
function zipBuild(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data);
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);   // local file header signature PK\x03\x04
    lh.writeUInt16LE(20, 4);          // version needed (2.0 — stored)
    lh.writeUInt16LE(0, 6);           // flags
    lh.writeUInt16LE(0, 8);           // method: 0 = stored
    lh.writeUInt16LE(DOS_TIME, 10);
    lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); // compressed size
    lh.writeUInt32LE(data.length, 22); // uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);           // extra len
    locals.push(lh, nameBuf, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);  // central dir signature PK\x01\x02
    ch.writeUInt16LE(20, 4);          // version made by
    ch.writeUInt16LE(20, 6);          // version needed
    ch.writeUInt16LE(0, 8);           // flags
    ch.writeUInt16LE(0, 10);          // method
    ch.writeUInt16LE(DOS_TIME, 12);
    ch.writeUInt16LE(DOS_DATE, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);          // extra
    ch.writeUInt16LE(0, 32);          // comment
    ch.writeUInt16LE(0, 34);          // disk start
    ch.writeUInt16LE(0, 36);          // internal attrs
    ch.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs (regular file 0644) — >>> 0 keeps the shifted value unsigned
    ch.writeUInt32LE(offset, 42);     // local header offset
    centrals.push(ch, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);  // EOCD signature PK\x05\x06
  eocd.writeUInt16LE(0, 4);           // disk
  eocd.writeUInt16LE(0, 6);           // start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);     // central dir offset
  eocd.writeUInt16LE(0, 20);          // comment len

  return Buffer.concat([...locals, centralBuf, eocd]);
}

module.exports = { zipBuild, crc32 };