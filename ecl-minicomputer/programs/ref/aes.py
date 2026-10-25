"""Reference for programs/aes.s: AES-128.

1. FIPS-197 appendix C.1: key 000102..0f, plaintext 00112233..ff.
2. CTR mode over 16 KB: key 2b7e151628aed2a6abf7158809cf4f3c, initial
   counter block f0f1f2..ff (both from NIST SP 800-38A F.5.1), the counter
   block incremented as a 128-bit big-endian integer per block. Plaintext:
   16 KB from the 32-bit LCG x = 1664525 x + 1013904223 (mod 2**32), seed 1
   (words x1, x2, ... little-endian).
   Checksum of the ciphertext, read as little-endian 32-bit words w:
       chk = 0;  chk = rotl(chk, 5) + w  (mod 2**32)  for each word in order

Plain-Python AES (byte-oriented, from the FIPS-197 description), checked
against the published vectors and, if installed, the `cryptography` package.
"""
import struct


def xtime(b):
    b <<= 1
    return b ^ 0x11B if b & 0x100 else b


def gmul(a, b):
    r = 0
    while b:
        if b & 1:
            r ^= a
        a = xtime(a)
        b >>= 1
    return r


def make_sbox():
    sbox = []
    for x in range(256):
        inv = next((y for y in range(1, 256) if gmul(x, y) == 1), 0)
        s = 0x63
        for i in range(5):                      # b ^ rotl(b,1..4)
            s ^= ((inv << i) | (inv >> (8 - i))) & 0xFF
        sbox.append(s)
    return sbox


SBOX = make_sbox()
assert SBOX[0] == 0x63 and SBOX[0x53] == 0xED


def expand_key(key):
    w = [list(key[4 * i:4 * i + 4]) for i in range(4)]
    rcon = 1
    for i in range(4, 44):
        t = list(w[i - 1])
        if i % 4 == 0:
            t = [SBOX[b] for b in t[1:] + t[:1]]
            t[0] ^= rcon
            rcon = xtime(rcon)
        w.append([a ^ b for a, b in zip(w[i - 4], t)])
    return [sum(w[4 * r:4 * r + 4], []) for r in range(11)]


def encrypt_block(rks, block):
    s = [b ^ k for b, k in zip(block, rks[0])]
    for r in range(1, 11):
        s = [SBOX[b] for b in s]
        s = [s[(i + 4 * (i % 4)) % 16] for i in range(16)]       # ShiftRows
        if r < 10:
            out = []
            for c in range(4):
                a = s[4 * c:4 * c + 4]
                out += [gmul(a[0], 2) ^ gmul(a[1], 3) ^ a[2] ^ a[3],
                        a[0] ^ gmul(a[1], 2) ^ gmul(a[2], 3) ^ a[3],
                        a[0] ^ a[1] ^ gmul(a[2], 2) ^ gmul(a[3], 3),
                        gmul(a[0], 3) ^ a[1] ^ a[2] ^ gmul(a[3], 2)]
            s = out
        s = [b ^ k for b, k in zip(s, rks[r])]
    return bytes(s)


def ctr(key, counter, data):
    rks = expand_key(key)
    out = bytearray()
    for i in range(0, len(data), 16):
        ks = encrypt_block(rks, counter.to_bytes(16, "big"))
        out += bytes(a ^ b for a, b in zip(data[i:i + 16], ks))
        counter = (counter + 1) % (1 << 128)
    return bytes(out)


def lcg_bytes(nwords, seed):
    x, out = seed, []
    for _ in range(nwords):
        x = (1664525 * x + 1013904223) & 0xFFFFFFFF
        out.append(x)
    return struct.pack(f"<{nwords}I", *out)


# 1. FIPS-197 C.1
c1 = encrypt_block(expand_key(bytes(range(16))), bytes.fromhex("00112233445566778899aabbccddeeff"))
assert c1.hex() == "69c4e0d86a7b0430d8cdb78070b4c55a"

# 2. CTR, checked first on SP 800-38A F.5.1
KEY = bytes.fromhex("2b7e151628aed2a6abf7158809cf4f3c")
CTR0 = int("f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff", 16)
sp_pt = bytes.fromhex("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51"
                      "30c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710")
sp_ct = ("874d6191b620e3261bef6864990db6ce9806f66b7970fdff8617187bb9fffdff"
         "5ae4df3edbd5d35e5b4f09020db03eab1e031dda2fbe03d1792170a0f3009cee")
assert ctr(KEY, CTR0, sp_pt).hex() == sp_ct

pt = lcg_bytes(4096, 1)
ct = ctr(KEY, CTR0, pt)
try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    enc = Cipher(algorithms.AES(KEY), modes.CTR(CTR0.to_bytes(16, "big"))).encryptor()
    assert enc.update(pt) + enc.finalize() == ct
except ImportError:
    pass

chk = 0
for (w,) in struct.iter_unpack("<I", ct):
    chk = (((chk << 5) | (chk >> 27)) + w) & 0xFFFFFFFF

print(c1.hex(), "fips-197-c1")
print(f"{chk:08x} ctr-16k-checksum")
