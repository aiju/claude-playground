"""Reference for programs/bignum.s: 1000! and Fibonacci(10000), each with its
number of decimal digits and its first and last 50 digits.
Uses Python's integers and math.factorial."""
import math


def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


for name, value in (("1000!", math.factorial(1000)), ("F(10000)", fib(10000))):
    s = str(value)
    print(f"{name} has {len(s)} digits")
    print(f"first 50: {s[:50]}")
    print(f"last 50:  {s[-50:]}")
