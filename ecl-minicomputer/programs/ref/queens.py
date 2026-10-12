"""Reference for programs/queens.s: number of N-queens solutions, N = 1..11.

Plain recursive bitmask search over all first-row columns (no symmetry trick),
so it is independent of the assembly's half-board search.
"""


def count(n):
    full = (1 << n) - 1

    def go(cols, left, right):
        if cols == full:
            return 1
        total = 0
        avail = full & ~(cols | left | right)
        while avail:
            bit = avail & -avail
            avail ^= bit
            total += go(cols | bit, ((left | bit) << 1) & full, (right | bit) >> 1)
        return total

    return go(0, 0, 0)


KNOWN = [1, 0, 0, 2, 10, 4, 40, 92, 352, 724, 2680]   # OEIS A000170

for n in range(1, 12):
    c = count(n)
    assert c == KNOWN[n - 1]
    print(f"N={n}: {c}")
