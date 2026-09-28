// MP3 in and out through ffmpeg (Node only), for the clips that get committed.

import { spawnSync } from 'child_process';
import { parseWav, wav } from './wav.js';

function ffmpeg(args, input) {
  const r = spawnSync('ffmpeg', ['-v', 'error', ...args], { input, maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`can't run ffmpeg (${r.error.code}); install it first`);
  if (r.status) throw new Error(`ffmpeg failed: ${r.stderr.toString().trim()}`);
  return r.stdout;
}

// VBR around 80 kbit/s for 24 kHz mono speech. ffmpeg writes the encoder
// delay into the file and trims it when decoding, so the timing survives.
export const writeMp3 = (file, audio) => ffmpeg(['-y', '-f', 'wav', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-q:a', '3', file], wav(audio));

export const readMp3 = (file) => parseWav(ffmpeg(['-i', file, '-ac', '1', '-c:a', 'pcm_s16le', '-bitexact', '-f', 'wav', 'pipe:1']));
