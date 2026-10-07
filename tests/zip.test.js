// tests/zip.test.js — the zip writer is valid by construction AND by real unzip.
// Note: execFileSync with argument arrays (never exec/shell strings) — no shell,
// no injection surface; the only dynamic value is our own mkdtemp path.
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { zipBuild, crc32 } = require("../api/lib/zip.js");

test("crc32 matches the known check value", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xCBF43926); // the canonical CRC-32 check
});

test("zipBuild produces a zip real unzip accepts (CRC verified)", () => {
  const zip = zipBuild([
    { name: "pkg/INGEST.md", data: "# manifest\n\nfingerprint `abc123def4567890`\n" },
    { name: "pkg/docs/report.md", data: "# report\nthe tale, told once.\n" },
    { name: "pkg/data/numbers.csv", data: "a,b\n1,2\n" },
  ]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-zip-"));
  const zf = path.join(tmp, "t.zip");
  fs.writeFileSync(zf, zip);
  const out = execFileSync("unzip", ["-t", zf]).toString(); // CRC check every entry
  assert.match(out, /No errors detected/);
  // and python zipfile agrees (independent implementation)
  const py = execFileSync("python3", [
    "-c",
    "import zipfile, sys; z=zipfile.ZipFile(sys.argv[1]); print(sorted(z.namelist())); print(z.testzip())",
    zf,
  ]).toString();
  assert.match(py, /docs\/report\.md/);
  assert.match(py, /None/); // testzip() → None = no bad file
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("zipBuild is deterministic — same entries, byte-identical output", () => {
  const entries = [{ name: "a/x.txt", data: "same bytes" }];
  const z1 = zipBuild(entries);
  const z2 = zipBuild(entries);
  assert.ok(z1.equals(z2));
});