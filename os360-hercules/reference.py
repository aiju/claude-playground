#!/usr/bin/env python3
"""The Mandelbrot picture from jobs/mandel.jcl, in Python.

    reference.py                 print the picture
    reference.py PRINTOUT        compare it with the one in a printout

The sums are the same as the assembler program's, in the same order, but
in IEEE double precision rather than System/360 hexadecimal floating point.
"""

import sys

COLS, ROWS, MIDROW, MAXITER = 120, 57, 28, 64
DX = 0.025
DY = 0.04166666666666667
XLEFT = -2.2375

# How many iterations each character stands for, as in SHADES
SHADES = ''.join(c * n for c, n in [
    (' ', 4), ('.', 1), (',', 1), (':', 1), (';', 2), ('-', 2), ('=', 3),
    ('+', 4), ('*', 6), ('X', 9), ('%', 12), ('#', 19), ('@', 1)])
assert len(SHADES) == MAXITER + 1


def picture():
    ytop = MIDROW * DY
    lines = []
    for row in range(ROWS):
        y = ytop - row * DY
        line = ''
        for col in range(COLS):
            x = col * DX + XLEFT
            zr = zi = 0.0
            left = MAXITER
            while True:
                zrsq, zisq = zr * zr, zi * zi
                if zrsq + zisq > 4:
                    break
                zi = 2 * zr * zi + y
                zr = zrsq - zisq + x
                left -= 1
                if left == 0:
                    break
            line += SHADES[MAXITER - left]
        lines.append(line.rstrip())
    return lines


def from_printout(path):
    """The picture from the last run of MANDEL in a printer file."""
    lines = open(path, encoding='latin-1').read().replace('\r', '').split('\n')
    heading = [i for i, l in enumerate(lines)
               if 'HEXADECIMAL FLOATING POINT' in l and 'DATE' in l]
    if not heading:
        sys.exit(f'{path}: no MANDEL output in it')
    first = heading[-1] + 2
    return [l[6:].rstrip() for l in lines[first:first + ROWS]]


def main():
    ours = picture()
    if len(sys.argv) < 2:
        print('\n'.join(ours))
        return
    theirs = from_printout(sys.argv[1])
    different = 0
    for row, (a, b) in enumerate(zip(ours, theirs)):
        for col in range(COLS):
            if a[col:col + 1] != b[col:col + 1]:
                different += 1
                print(f'line {row + 1}, column {col + 1}: '
                      f'{b[col:col + 1]!r} in the printout, {a[col:col + 1]!r} here')
    print(f'{different} of {ROWS * COLS} points differ')
    sys.exit(1 if different else 0)


if __name__ == '__main__':
    main()
