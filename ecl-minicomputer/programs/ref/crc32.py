"""Reference for programs/crc32.s: zlib CRC-32 of "123456789" and of a 256 KB
buffer from the 32-bit LCG x = 1664525 x + 1013904223 (mod 2**32), seed 1
(words x1, x2, ... stored little-endian). CRCs come from zlib.crc32.
"""
import struct
import zlib


def lcg_bytes(nwords, seed):
    x, out = seed, []
    for _ in range(nwords):
        x = (1664525 * x + 1013904223) & 0xFFFFFFFF
        out.append(x)
    return struct.pack(f"<{nwords}I", *out)


check = zlib.crc32(b"123456789")
assert check == 0xCBF43926
print(f"{check:08x} 123456789")
print(f"{zlib.crc32(lcg_bytes(65536, 1)):08x} lcg-256k")
