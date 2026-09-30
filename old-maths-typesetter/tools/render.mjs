#!/usr/bin/env node
// Typeset a source file from the command line, one SVG per page.
//
//   node tools/render.mjs samples/hardy-divergent-series.tex out/

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTypesetter } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [input, outDir = "out"] = process.argv.slice(2);
if (!input) {
  console.error("usage: node tools/render.mjs <source.tex> [output-dir]");
  process.exit(1);
}

const ts = await createTypesetter(async (name) => JSON.parse(await readFile(join(root, "fonts", `${name}.json`), "utf8")));
const t0 = performance.now();
const { pages, warnings } = ts.typeset(await readFile(input, "utf8"));
for (const w of warnings) console.warn("warning:", w);
const t1 = performance.now();
await mkdir(outDir, { recursive: true });
for (const page of pages) {
  const file = join(outDir, `page-${String(page.number).padStart(3, "0")}.svg`);
  await writeFile(file, ts.render(page));
}
console.log(`${pages.length} pages in ${Math.round(t1 - t0)} ms -> ${outDir}/`);
