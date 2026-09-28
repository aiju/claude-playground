// Generates the narration with Gemini TTS, one clip per line of script.md.
//   node tts.js [--voice Charon] [--lines N1,N3] [--out out/voice] [--takes 4 | --no-check] [--force]
//
// Writes <out>/N1.wav … and <out>/manifest.json with each clip's length and
// where the speech starts and ends in it, so the timeline can be laid out from
// the measured clips. Each clip is transcribed and compared with the script,
// and a take that doesn't match is thrown away and generated again.
// Lines that already have a clip that passed are skipped; --force redoes them.
//
// The API key comes from GEMINI_API_KEY. In an environment whose proxy adds
// the key to requests itself, leave it unset and run with NODE_USE_ENV_PROXY=1
// so Node's fetch goes through the proxy.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pcm16, parseWav, wav } from './src/audio/wav.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
  const next = process.argv[i + 1];
  args[a.slice(2)] = next && !next.startsWith('--') ? process.argv[++i] : true;
}
const MODEL = args.model || 'gemini-3.8-flash-tts';
const VOICE = args.voice || 'Charon';
const OUT = path.resolve(here, args.out || 'out/voice');
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
    const file = path.join(OUT, `${line.id}.wav`);
    const have = !args.force && fs.existsSync(file) && same(manifest.lines[line.id], line);
    if (have && (args['no-check'] || manifest.lines[line.id].check?.ok)) {
      console.log(`${line.id}: have it`);
      continue;
    }
    // A clip from an earlier run that was never checked gets checked first.
    let audio = have && !manifest.lines[line.id].check ? parseWav(fs.readFileSync(file)) : null;
    for (let take = 1; take <= TAKES; take++) {
      if (!audio) audio = await synthesize(line.text);
      const entry = { text: line.text, model: MODEL, voice: VOICE, ...measure(audio) };
      if (!args['no-check']) entry.check = await check(line.text, audio);
      fs.writeFileSync(file, wav(audio));
      manifest.lines[line.id] = entry;
      save();
      if (args['no-check'] || entry.check.ok) {
        console.log(`${line.id}: ${summary(entry)}`);
        break;
      }
      console.warn(`${line.id}: take ${take} failed the check (${summary(entry)}): ${entry.check.problems.join('; ')}`);
      if (take === TAKES) failed++;
      audio = null;
    }
  }
}));

save();
console.log(`${Object.keys(manifest.lines).length}/${lines.length} lines, ${manifest.speechSeconds} s of speech`);
if (failed) {
  console.error(`${failed} line(s) still fail the check; see "check" in ${path.relative(here, manifestFile)}`);
  process.exitCode = 1;
}
