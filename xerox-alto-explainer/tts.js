// Generates the narration with Gemini TTS, one clip per line of script.md.
//   node tts.js [--voice Iapetus] [--lines N1,N3] [--out voice] [--takes 4 | --no-check] [--no-align | --realign] [--force]
//
// Writes <out>/N1.mp3 … and <out>/manifest.json with each clip's length and
// where the speech starts and ends in it, so the timeline can be laid out from
// the measured clips. Each clip is transcribed and compared with the script,
// and a take that doesn't match is thrown away and generated again.
// Each clip that passes also gets word timings (--realign redoes them). Lines
// that already have a clip that passed are skipped; --force redoes them.
// The clips in voice/ are committed, because a new run gives different takes.
// Needs ffmpeg for the MP3s.
//
// The API key comes from GEMINI_API_KEY. In an environment whose proxy adds
// the key to requests itself, leave it unset and run with NODE_USE_ENV_PROXY=1
// so Node's fetch goes through the proxy.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pcm16, parseWav, wav } from './src/audio/wav.js';
import { readMp3, writeMp3 } from './src/audio/mp3.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
  const next = process.argv[i + 1];
  args[a.slice(2)] = next && !next.startsWith('--') ? process.argv[++i] : true;
}
const MODEL = args.model || 'gemini-3.8-flash-tts';
const VOICE = args.voice || 'Iapetus';
const OUT = path.resolve(here, args.out || 'voice');
const CHECK_MODEL = args['check-model'] || 'gemini-3.8-flash';
const TAKES = args['no-check'] ? 1 : Number(args.takes || 4);
const CONCURRENCY = Number(args.jobs || 3);

// The style is fixed for every line (script.md, "TTS notes"). This model reads
// a plain "Say this like…" preamble out loud, so the direction goes in the
// labelled sections it understands, and only the transcript gets spoken.
const STYLE = 'Brisk, clear, dry technical narrator with a hint of amusement; like a friendly engineer showing off something clever.';
const prompt = (text) => `# AUDIO PROFILE: The Narrator
A friendly hardware engineer narrating a short explainer video about the Xerox Alto's processor.

### DIRECTOR'S NOTES
Style: ${STYLE}
Pace: brisk, about 175 words per minute, with short natural pauses between sentences.

#### TRANSCRIPT
${text}`;

// Spellings that steer the pronunciation. script.md keeps the written form.
const SPOKEN = [
  [/\bALU\b/g, 'A-L-U'],
  [/\bmicro-PC\b/g, 'micro-P-C'],
];
const spoken = (text) => SPOKEN.reduce((t, [re, s]) => t.replace(re, s), text);

// Narration lines look like "> **N1** April 1973. …" in script.md.
const lines = [...fs.readFileSync(path.join(here, 'script.md'), 'utf8').matchAll(/^> \*\*(N\d+)\*\* (.+)$/gm)]
  .map(([, id, text]) => ({ id, text }));
const wanted = args.lines ? new Set(args.lines.split(',')) : null;
const todo = lines.filter((l) => !wanted || wanted.has(l.id));
if (!todo.length) throw new Error('no matching lines in script.md');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// POSTs to a Gemini model and returns pick(response), retrying while pick
// finds nothing or the model is busy or rate-limited.
async function gemini(model, request, pick) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.GEMINI_API_KEY) headers['x-goog-api-key'] = process.env.GEMINI_API_KEY;
  const body = JSON.stringify(request);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers, body });
    const json = await res.json().catch(() => null);
    const result = res.ok && json ? pick(json) : undefined;
    if (result !== undefined) return result;
    const why = json?.error?.message?.split('\n')[0] || (res.ok ? 'nothing usable in the response' : res.statusText);
    if (attempt === 8 || (res.status >= 400 && res.status < 500 && res.status !== 429)) throw new Error(`${model} ${res.status}: ${why}`);
    // A 429 says how long to wait: the TTS models allow only a few requests a minute.
    const hint = json?.error?.details?.find((d) => d.retryDelay)?.retryDelay;
    const wait = hint ? parseFloat(hint) * 1000 + 1000 : 2000 * 2 ** Math.min(attempt, 5);
    console.warn(`  ${model} ${res.status}, retrying in ${Math.round(wait / 1000)} s: ${why}`);
    await sleep(wait);
  }
}

const synthesize = (text) => gemini(MODEL, {
  contents: [{ parts: [{ text: prompt(spoken(text)) }] }],
  generationConfig: {
    responseModalities: ['AUDIO'],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
  },
}, (json) => {
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  return part && decode(part.inlineData);
});

// Takes sometimes go wrong: the model reads the director's notes aloud, drops
// or repeats words, or stalls. A second model listens to each clip and
// compares it with the script.
const check = (text, audio) => gemini(CHECK_MODEL, {
  contents: [{ parts: [
    { inlineData: { mimeType: 'audio/wav', data: wav(audio).toString('base64') } },
    { text: `This is a text-to-speech clip for an explainer video. It should say exactly this, and nothing else:

${text}

Transcribe what the clip actually says, then compare it with the text. Set "ok" to false if any words are added (for example stage directions or style notes read aloud), missing, repeated or swapped, if a word is clearly mispronounced, or if there's an unnaturally long pause. Numbers and symbols spoken in any sensible way are fine (for example "606 by 808" or "1.36" read out as words). List each problem briefly.` },
  ] }],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: { transcript: { type: 'STRING' }, ok: { type: 'BOOLEAN' }, problems: { type: 'ARRAY', items: { type: 'STRING' } } },
      required: ['transcript', 'ok', 'problems'],
    },
  },
}, (json) => {
  try { return JSON.parse(json.candidates[0].content.parts.map((p) => p.text || '').join('')); } catch { return undefined; }
});

// The API answers with either a WAV file or bare 16-bit PCM ("audio/L16;rate=24000").
function decode({ mimeType, data }) {
  const buf = Buffer.from(data, 'base64');
  if (buf.toString('ascii', 0, 4) === 'RIFF') return parseWav(buf);
  return { rate: Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000), samples: pcm16(buf) };
}

// Where the speech starts and ends: the first and last 10 ms window whose
// peak is above -40 dBFS.
function measure({ rate, samples }) {
  const win = Math.round(rate / 100), loud = 32768 * 10 ** (-40 / 20);
  const peak = (w) => { let m = 0; for (let i = w * win; i < Math.min(samples.length, (w + 1) * win); i++) m = Math.max(m, Math.abs(samples[i])); return m; };
  const n = Math.ceil(samples.length / win);
  let first = 0, last = n - 1;
  while (first < n && peak(first) < loud) first++;
  while (last > first && peak(last) < loud) last--;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return { duration: r3(samples.length / rate), speechStart: r3((first * win) / rate), speechEnd: r3(Math.min(samples.length, (last + 1) * win) / rate) };
}

// Stretches of near-silence (every 10 ms window below -35 dBFS) of 50 ms or
// more inside the speech: the gaps between phrases, and some between words.
function pauses({ rate, samples }, from, to) {
  const win = Math.round(rate / 100), quiet = 32768 * 10 ** (-35 / 20), found = [];
  let run = null;
  for (let w = Math.floor(from * 100); w < Math.ceil(to * 100); w++) {
    let m = 0;
    for (let i = w * win; i < Math.min(samples.length, (w + 1) * win); i++) m = Math.max(m, Math.abs(samples[i]));
    if (m < quiet) run ??= w;
    else if (run !== null) {
      if (w - run >= 5) found.push({ start: run / 100, end: w / 100 });
      run = null;
    }
  }
  return found;
}

// When each word starts and ends, so the pictures can move on a given word.
// Gemini's timestamps are close but drift (they run long towards the end of a
// clip), so they're stretched to fit the measured speech, and each boundary
// after punctuation is snapped to the nearest pause.
async function align(text, audio, { speechStart, speechEnd }) {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const got = await gemini(CHECK_MODEL, {
    contents: [{ parts: [
      { inlineData: { mimeType: 'audio/wav', data: wav(audio).toString('base64') } },
      { text: `Align these words to the speech in the audio. For each numbered word, give the time in seconds from the start of the clip at which it starts and ends, to the nearest 10 ms.\n\n${words.map((w, i) => `${i}: ${w}`).join('\n')}` },
    ] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { i: { type: 'INTEGER' }, start: { type: 'NUMBER' }, end: { type: 'NUMBER' } }, required: ['i', 'start', 'end'] },
      },
    },
  }, (json) => {
    try {
      const byIndex = new Map(JSON.parse(json.candidates[0].content.parts.map((p) => p.text || '').join('')).map((w) => [w.i, w]));
      const times = words.map((_, i) => byIndex.get(i));
      return times.every((t) => t && t.end >= t.start) ? times : undefined;
    } catch { return undefined; }
  });
  // Anchors map Gemini's clock to the clip's: the ends of the speech, plus
  // each pause that a boundary after punctuation snaps to. Times between
  // anchors are interpolated.
  const g0 = got[0].start, g1 = got.at(-1).end;
  const rough = (x) => speechStart + ((x - g0) * (speechEnd - speechStart)) / Math.max(0.1, g1 - g0);
  const gaps = pauses(audio, speechStart, speechEnd);
  const anchors = [[g0, speechStart]];
  for (let i = 0; i + 1 < words.length; i++) {
    const at = (rough(got[i].end) + rough(got[i + 1].start)) / 2;
    const punct = /[,.;:!?…—]$/.test(words[i]);
    let best = null;
    for (const g of gaps) {
      const d = Math.abs((g.start + g.end) / 2 - at);
      if (d <= (punct ? 0.3 : 0.12) && (punct || g.end - g.start >= 0.1) && (!best || d < best.d)) best = { ...g, d };
    }
    if (best) anchors.push([got[i].end, best.start], [got[i + 1].start, best.end]);
  }
  anchors.push([g1, speechEnd]);
  const A = anchors.filter((a, i) => i === 0 || (a[0] >= anchors[i - 1][0] && a[1] >= anchors[i - 1][1]));
  // A word that starts exactly where the previous one ended is nudged past a
  // tie in Gemini's clock, so it lands after the pause rather than before.
  const map = (x) => {
    for (let j = 0; j + 1 < A.length; j++) {
      const [x0, y0] = A[j], [x1, y1] = A[j + 1];
      if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * Math.max(0, x - x0)) / (x1 - x0);
    }
    return speechEnd;
  };
  const r2 = (x) => Math.round(x * 100) / 100;
  let prev = speechStart;
  return words.map((w, i) => {
    const start = Math.max(prev, map(got[i].start + 1e-6));
    const end = Math.max(start, map(got[i].end));
    prev = end;
    return { w, start: r2(start), end: r2(end) };
  });
}

fs.mkdirSync(OUT, { recursive: true });
const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { lines: {} };

// Saved after every take, so an interrupted run keeps what it got. Lines are
// kept in script order, with the speech totalled up.
function save() {
  manifest.lines = Object.fromEntries(lines.filter((l) => manifest.lines[l.id]).map((l) => [l.id, manifest.lines[l.id]]));
  manifest.speechSeconds = Math.round(Object.values(manifest.lines).reduce((s, m) => s + m.speechEnd - m.speechStart, 0) * 10) / 10;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
}

const same = (entry, line) => entry?.text === line.text && entry.voice === VOICE && entry.model === MODEL;
const summary = (m) => `${m.duration.toFixed(2)} s (speech ${m.speechStart.toFixed(2)}–${m.speechEnd.toFixed(2)})`;
let failed = 0;

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let line; (line = queue.shift()); ) {
    const file = path.join(OUT, `${line.id}.mp3`);
    let entry = manifest.lines[line.id];
    const have = !args.force && fs.existsSync(file) && same(entry, line);
    const passed = have && (args['no-check'] || entry.check?.ok);
    if (passed && ((entry.words && !args.realign) || args['no-align'])) {
      console.log(`${line.id}: have it`);
      continue;
    }
    let audio = null;
    if (passed) {
      audio = readMp3(file); // a good clip that's only missing its word timings
    } else {
      // A clip from an earlier run that was never checked gets checked first.
      if (have && !entry.check) audio = readMp3(file);
      for (let take = 1; ; take++) {
        if (!audio) audio = await synthesize(line.text);
        entry = { text: line.text, model: MODEL, voice: VOICE, ...measure(audio) };
        if (!args['no-check']) entry.check = await check(line.text, audio);
        writeMp3(file, audio);
        manifest.lines[line.id] = entry;
        save();
        if (args['no-check'] || entry.check.ok || take === TAKES) break;
        console.warn(`${line.id}: take ${take} failed the check (${summary(entry)}): ${entry.check.problems.join('; ')}`);
        audio = null;
      }
      if (entry.check && !entry.check.ok) {
        console.warn(`${line.id}: all ${TAKES} takes failed the check: ${entry.check.problems.join('; ')}`);
        failed++;
        continue;
      }
      console.log(`${line.id}: ${summary(entry)}`);
    }
    if (!args['no-align']) {
      entry.words = await align(line.text, audio, entry);
      save();
      console.log(`${line.id}: aligned ${entry.words.length} words`);
    }
  }
}));

save();
console.log(`${Object.keys(manifest.lines).length}/${lines.length} lines, ${manifest.speechSeconds} s of speech`);
if (failed) {
  console.error(`${failed} line(s) still fail the check; see "check" in ${path.relative(here, manifestFile)}`);
  process.exitCode = 1;
}
