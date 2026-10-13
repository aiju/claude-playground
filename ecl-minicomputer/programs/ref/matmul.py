"""Reference for programs/matmul.s: C = A B for 48 x 48 integer matrices.

A and B hold LCG values in -1000..1000: A takes the first 2304, B the next
2304, row by row. Prints the sum of C (mod 2^32, as a signed number), a
fold of C in row order (rotate left 5, xor) and three elements.
"""

M32 = 0xFFFFFFFF
N = 48
SEED = 1


def lcg_values(count, x):
    out = []
    for _ in range(count):
        x = (1664525 * x + 1013904223) & M32
        out.append(((x >> 16) * 2001 >> 16) - 1000)     # -1000 .. 1000
    return out


def signed(v):
    v &= M32
    return v - (1 << 32) if v >> 31 else v


def main():
    vals = lcg_values(2 * N * N, SEED)
    a = [vals[i * N:(i + 1) * N] for i in range(N)]
    b = [vals[N * N + i * N:N * N + (i + 1) * N] for i in range(N)]
    c = [[sum(a[i][k] * b[k][j] for k in range(N)) for j in range(N)] for i in range(N)]
    total, h = 0, 0
    for row in c:
        for v in row:
            total += v
            h = ((h << 5) | (h >> 27)) & M32
            h ^= v & M32
    print(f"C = A B, {N} x {N}")
    print(f"sum {signed(total)}")
    print(f"fold {h:08x}")
    print(f"C[0][0] {c[0][0]} C[17][31] {c[17][31]} C[47][47] {c[47][47]}")


if __name__ == "__main__":
    main()
