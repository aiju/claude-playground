// Packages the live player into out/preview/ as a self-contained folder
// (for hosting it as a web page): the player markup, the modules, the fonts
// and an mp3 copy of the song, which every browser can decode.
//
//   node tools/build-preview.mjs      (needs ffmpeg, or FFMPEG=/path/to/ffmpeg)

import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const OUT = 'out/preview';
await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/audio`, { recursive: true });
await cp('src', `${OUT}/src`, { recursive: true });
await cp('fonts', `${OUT}/fonts`, { recursive: true });

// the page body only; the host supplies the document shell
const html = await readFile('index.html', 'utf8');
const body = html.slice(html.indexOf('<!-- player-start -->'), html.indexOf('<!-- player-end -->'));
await writeFile(`${OUT}/index.html`, `<title>Prajñā Preview</title>\n<style>:root { color-scheme: dark; }</style>\n<script>window.MV_AUDIO = ['audio/song.mp3'];</script>\n${body}`);

execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', 'audio/song.m4a', '-c:a', 'libmp3lame', '-b:a', '192k', `${OUT}/audio/song.mp3`]);
console.log(`wrote ${OUT}`);
