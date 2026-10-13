"""Reference for programs/sort.s: sort 20,000 LCG words (unsigned)."""

M32 = 0xFFFFFFFF
N = 20000
SEED = 12345


def lcg_words(n, x):
    out = []
    for _ in range(n):
        x = (1664525 * x + 1013904223) & M32
        out.append(x)
    return out


def main():
    words = sorted(lcg_words(N, SEED))
    h = 0
    for w in words:                     # fold: rotate left 5, xor
        h = ((h << 5) | (h >> 27)) & M32
        h ^= w
    print(f"sorted {N} words")
    print(f"checksum {h:08x}")
    print(f"first {words[0]} middle {words[N // 2]} last {words[-1]}")


if __name__ == "__main__":
    main()
