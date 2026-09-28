// Reading and writing 16-bit mono PCM WAV files (Node only). Audio is passed
// around as { rate, samples }, with samples an Int16Array.

// Copies into a fresh ArrayBuffer, since a Buffer's offset may be odd.
export const pcm16 = (buf) => new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + (buf.length & ~1)));

export function parseWav(buf) {
  let rate = 24000;
  for (let off = 12; off + 8 <= buf.length; ) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      if (buf.readUInt16LE(off + 8) !== 1 || buf.readUInt16LE(off + 10) !== 1 || buf.readUInt16LE(off + 22) !== 16) throw new Error('expected 16-bit mono PCM');
      rate = buf.readUInt32LE(off + 12);
    }
    if (id === 'data') {
      // Streamed WAVs can carry a placeholder size, so clamp to what's there.
      return { rate, samples: pcm16(buf.subarray(off + 8, Math.min(buf.length, off + 8 + size))) };
    }
    off += 8 + size + (size & 1);
  }
  throw new Error('WAV has no data chunk');
}

export function wav({ rate, samples }) {
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + samples.byteLength, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(samples.byteLength, 40);
  return Buffer.concat([head, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)]);
}
