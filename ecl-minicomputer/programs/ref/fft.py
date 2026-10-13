"""Reference for programs/fft.s: a 1024-point fixed-point radix-2 FFT and its
inverse.

Data are Q15 integers, twiddles Q15 with 1.0 = 32768. Written as a plain
decimation-in-time FFT; the integer operations are the ones the assembly
program does:

- Twiddles W^k = cos(2 pi k/N) - i sin(2 pi k/N) come from a quarter-wave
  table Q[m] = round(32768 sin(2 pi m/N)), m = 0..256 (printed by
  `--table` and included in fft.s as data).
- A butterfly with twiddle index k on (u, x) computes t = W^k x and gives
  (u' + t, u' - t). Forward: u' = u >> 1 and t is scaled by 1/2 as well,
  so each stage halves and the result is DFT/N. Inverse: no scaling.
- W^0 = 1 and W^(N/4) = -i are done exactly: t = x >> s, or
  t = (xi >> s, (-xr) >> s), s = 1 forward, 0 inverse.
- Every other twiddle uses three products (Gauss):
      k1 = c (xr + xi) >> sh,  tr = k1 - ((c - s) xi >> sh),
      ti = k1 - ((c + s) xr >> sh),       sh = 16 forward, 15 inverse.
  All shifts are floor shifts (arithmetic). Subtracting both floored
  terms from k1 cancels their rounding bias on average; adding the
  first one instead doubles the forward error.
- The inverse is the forward algorithm, unscaled, on the data with real
  and imaginary parts swapped, swapped back after: swap(DFT(swap(X))) is
  N times the inverse DFT.
"""

import math
import sys

N = 1024
LOGN = 10
M32 = 0xFFFFFFFF

Q = [round(32768 * math.sin(2 * math.pi * m / N)) for m in range(N // 4 + 1)]


def sin_q15(m):
    """32768 sin(2 pi m / N) from the quarter-wave table."""
    m %= N
    quad, r = divmod(m, N // 4)
    v = Q[r] if quad % 2 == 0 else Q[N // 4 - r]
    return v if quad < 2 else -v


def cos_q15(m):
    return sin_q15(m + N // 4)


def twiddle_mul(xr, xi, k, forward):
    s1 = 1 if forward else 0
    if k == 0:
        return xr >> s1, xi >> s1
    if k == N // 4:
        return xi >> s1, (-xr) >> s1
    sh = 15 + s1
    c, s = cos_q15(k), sin_q15(k)
    k1 = (c * (xr + xi)) >> sh
    return k1 - (((c - s) * xi) >> sh), k1 - (((c + s) * xr) >> sh)


def bitrev(i):
    return int(format(i, f"0{LOGN}b")[::-1], 2)


def fft(re, im, forward):
    """Radix-2 DIT FFT; returns new lists."""
    s1 = 1 if forward else 0
    re = [re[bitrev(i)] for i in range(N)]
    im = [im[bitrev(i)] for i in range(N)]
    h = 1
    while h < N:
        for start in range(0, N, 2 * h):
            for j in range(h):
                k = j * (N // (2 * h))
                i0, i1 = start + j, start + j + h
                tr, ti = twiddle_mul(re[i1], im[i1], k, forward)
                ur, ui = re[i0] >> s1, im[i0] >> s1
                re[i0], im[i0] = ur + tr, ui + ti
                re[i1], im[i1] = ur - tr, ui - ti
        h *= 2
    return re, im


def inverse(re, im):
    yi, yr = fft(im, re, forward=False)
    return yr, yi


def lcg_noise(count, x):
    out = []
    for _ in range(count):
        x = (1664525 * x + 1013904223) & M32
        out.append((x >> 24) - 128)                     # -128 .. 127
    return out


def signal():
    noise = lcg_noise(2 * N, 7)
    re = [(sin_q15(50 * n) >> 1) + (sin_q15(129 * n + 100) >> 2) + noise[2 * n]
          for n in range(N)]
    im = [(cos_q15(300 * n) >> 2) + (sin_q15(-77 * n) >> 3) + noise[2 * n + 1]
          for n in range(N)]
    return re, im


def fold(h, v):
    h = ((h << 5) | (h >> 27)) & M32
    return h ^ (v & M32)


def main():
    if sys.argv[1:] == ["--table"]:
        for i in range(0, len(Q), 16):
            print("        .half   " + ", ".join(str(v) for v in Q[i:i + 16]))
        return
    xr, xi = signal()
    Xr, Xi = fft(xr, xi, forward=True)
    print(f"{N}-point FFT, Q15, scaled by 1/2 a stage")
    power = [Xr[k] ** 2 + Xi[k] ** 2 for k in range(N)]
    top = sorted(range(N), key=lambda k: (-power[k], k))[:8]
    for k in top:
        print(f"bin {k}: {Xr[k]} {Xi[k]}")
    h = 0
    for k in range(N):
        h = fold(fold(h, Xr[k]), Xi[k])
    print(f"spectrum fold {h:08x}")
    yr, yi = inverse(Xr, Xi)
    err = [a - b for a, b in zip(yr + yi, xr + xi)]
    print(f"round trip: max |error| {max(abs(e) for e in err)}, "
          f"sum |error| {sum(abs(e) for e in err)} over {2 * N} values")


if __name__ == "__main__":
    main()
