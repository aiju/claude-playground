"""Reference for programs/fib.s: fib(n) for n = 0..24, one per line."""


def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)


def main():
    for n in range(25):
        print(fib(n))


if __name__ == "__main__":
    main()
