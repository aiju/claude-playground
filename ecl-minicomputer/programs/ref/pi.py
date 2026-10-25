"""Reference for programs/pi.s: pi to 500 decimal places, "3." then ten lines
of 50 digits.

Computed with the Gauss-Legendre AGM in the decimal module (not Machin's
formula, which the assembly uses), and cross-checked against Machin's
formula in plain integers.
"""
from decimal import Decimal, getcontext

DIGITS = 500
getcontext().prec = DIGITS + 30


def agm_pi():
    a, b, t, p = Decimal(1), Decimal(1) / Decimal(2).sqrt(), Decimal(1) / 4, Decimal(1)
    for _ in range(12):                      # 2^12 >> 530 digits
        a, b, t, p = (a + b) / 2, (a * b).sqrt(), t - p * ((a - b) / 2) ** 2, 2 * p
    return (a + b) ** 2 / (4 * t)


def machin_pi(digits):
    one = 10 ** (digits + 10)

    def atan_inv(x):
        total = term = one // x
        k, x2 = 1, x * x
        while term:
            term //= x2
            total += (-1) ** k * (term // (2 * k + 1))
            k += 1
        return total

    return (16 * atan_inv(5) - 4 * atan_inv(239)) // 10 ** 10


decimals = str(agm_pi()).split(".")[1][:DIGITS]
assert decimals == str(machin_pi(DIGITS + 5))[1:DIGITS + 1]
print("3.")
for i in range(0, DIGITS, 50):
    print(decimals[i:i + 50])
