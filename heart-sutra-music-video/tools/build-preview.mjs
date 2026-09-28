// Packages a page of the project into a self-contained folder for hosting
// as a web page: the page body, the modules, the fonts and an mp3 copy of
// the song, which every browser can decode.
//
//   node tools/build-preview.mjs          # the player, into out/preview/
//   node tools/build-preview.mjs timing   # the timing editor, into out/timing/
//
// Needs ffmpeg (or FFMPEG=/path/to/ffmpeg).

import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PAGES = {
  index: { file: 'index.html', out: 'out/preview', title: 'Prajñā Preview', head: '<style>:root { color-scheme: dark; }</style>\n' },
  timing: { file: 'timing.html', out: 'out/timing', title: 'Prajñā Timing', head: '', vocals: true },
};
const page = PAGES[process.argv[2] || 'index'];
if (!page) throw new Error(`unknown page; pick one of ${Object.keys(PAGES).join(', ')}`);

await rm(page.out, { recursive: true, force: true });
await mkdir(`${page.out}/audio`, { recursive: true });
await cp('src', `${page.out}/src`, { recursive: true });
await cp('fonts', `${page.out}/fonts`, { recursive: true });

// the page body only (the host supplies the document shell), pointed at the mp3
const html = await readFile(page.file, 'utf8');
const body = html.slice(html.indexOf('<!-- page-start -->'), html.indexOf('<!-- page-end -->'))
  .replace(/\s*<source src="audio\/song\.m4a"[^>]*>/, '');
// the timing editor also offers the separated vocals, when there are any
const vocals = page.vocals && existsSync('audio/vocals.mp3');
if (vocals) await cp('audio/vocals.mp3', `${page.out}/audio/vocals.mp3`);
const globals = `window.MV_AUDIO = ['audio/song.mp3'];${vocals ? " window.MV_VOCALS = ['audio/vocals.mp3'];" : ''}`;
await writeFile(`${page.out}/index.html`, `<title>${page.title}</title>\n${page.head}<script>${globals}</script>\n${body}`);

execFileSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', 'audio/song.m4a', '-c:a', 'libmp3lame', '-b:a', '192k', `${page.out}/audio/song.mp3`]);
console.log(`wrote ${page.out}`);
