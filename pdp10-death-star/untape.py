#!/usr/bin/env python3
"""Pull the PPM image off a punched paper tape image and save it as PNG.

The TOPS-10 punch driver puts blank leader and trailer (NULs) round the
data, so skip to the "P6" header and take exactly width*height*3 bytes.
"""
import sys, zlib, struct

def read_ppm_from_tape(data):
    start = data.index(b"P6")
    fields, pos = [], start + 2
    while len(fields) < 3:
        while data[pos:pos+1].isspace():
            pos += 1
        end = pos
        while not data[end:end+1].isspace():
            end += 1
        fields.append(int(data[pos:end]))
        pos = end
    pos += 1                                   # single whitespace after maxval
    w, h, maxval = fields
    pixels = data[pos:pos + w*h*3]
    if len(pixels) != w*h*3:
        sys.exit(f"tape too short: {len(pixels)} of {w*h*3} bytes")
    return w, h, pixels

def write_png(path, w, h, rgb):
    raw = b"".join(b"\0" + rgb[y*w*3:(y+1)*w*3] for y in range(h))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)

if __name__ == "__main__":
    tape = open(sys.argv[1], "rb").read()
    w, h, rgb = read_ppm_from_tape(tape)
    write_png(sys.argv[2], w, h, rgb)
    print(f"{sys.argv[2]}: {w}x{h}")
