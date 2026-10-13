"""Reference for programs/sieve.s: the primes below 1,000,000.

Prints the number of primes, their sum mod 2^32 and the largest one.
"""

N = 1_000_000


def main():
    is_prime = bytearray([1]) * N
    is_prime[0] = is_prime[1] = 0
    for p in range(2, int(N ** 0.5) + 1):
        if is_prime[p]:
            is_prime[p * p::p] = bytes(len(range(p * p, N, p)))
    primes = [i for i in range(N) if is_prime[i]]
    print("primes below", N)
    print("count", len(primes))
    print("sum mod 2^32", sum(primes) % (1 << 32))
    print("largest", primes[-1])


if __name__ == "__main__":
    main()
