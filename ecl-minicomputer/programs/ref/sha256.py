"""Reference for programs/sha256.s: SHA-256 digests of four messages.

The fourth message is 16 KB from the 32-bit LCG x = 1664525 x + 1013904223
(mod 2**32), seed 1: the words x1, x2, ... stored little-endian.
Digests come from hashlib.
"""
import hashlib
import struct


def lcg_bytes(nwords, seed):
    x, out = seed, []
    for _ in range(nwords):
        x = (1664525 * x + 1013904223) & 0xFFFFFFFF
        out.append(x)
    return struct.pack(f"<{nwords}I", *out)


messages = [
    ("empty", b""),
    ("abc", b"abc"),
    ("fips-56", b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    ("lcg-16k", lcg_bytes(4096, 1)),
]

for label, msg in messages:
    print(hashlib.sha256(msg).hexdigest(), label)
