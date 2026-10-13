"""Reference for programs/mandel.s: a fixed-point Mandelbrot set as ASCII art.

Q24 fixed point (24 fraction bits). The iteration uses two products:

    zr' = ((zr + zi) * (zr - zi)) >> 24  + cr
    zi' = (zr * zi) >> 23                + ci      (2*zr*zi)

with floor shifts, as MULT + MFHL compute them. A point has escaped once
|zr| > 2 or |zi| > 2 (a box test: no squares needed). The count of a
pixel is the number of z values computed: z1 = c is the first, and at
most 255. The total of the counts is printed at the end.
"""

FRAC = 24
ONE = 1 << FRAC
TWO = 2 * ONE
MAXIT = 255
COLS, ROWS = 72, 30
DX = 629146                     # ~2.7 / 72: x from -2.1 to 0.6
DY = 1342178                    # ~2.4 / 30: y from -1.2 to 1.2
X0 = -35232154 + DX // 2        # ~-2.1, centre of the first column
Y0 = -(ROWS - 1) * DY // 2      # rows symmetric about y = 0

# escaped after n values: PAL[bit length of n]; never escaped: '@'
PAL = " .:-=+*#"


def count(cr, ci):
    """Returns (n, escaped)."""
    zr, zi = cr, ci
    n = 1
    while True:
        if abs(zr) > TWO or abs(zi) > TWO:
            return n, True
        if n == MAXIT:
            return n, False
        zr, zi = (((zr + zi) * (zr - zi)) >> FRAC) + cr, ((zr * zi) >> (FRAC - 1)) + ci
        n += 1


def main():
    total = 0
    for row in range(ROWS):
        ci = Y0 + row * DY
        line = []
        for col in range(COLS):
            cr = X0 + col * DX
            n, escaped = count(cr, ci)
            total += n
            line.append(PAL[n.bit_length() - 1] if escaped else "@")
        print("".join(line))
    print("iterations", total)


if __name__ == "__main__":
    main()
