; crc32: zlib's CRC-32 (reflected, polynomial 0xEDB88320) of "123456789"
; and of a 256 KB buffer filled by a 32-bit LCG.
;
; Method: 32 bits at a time with three tables. With f the one-bit CRC step,
; processing a word w is c = F(c ^ w) where F = f^32 is linear over GF(2),
; so F splits over bit fields of its argument. The fields are picked so
; that the indexes, which LWX needs as byte offsets (4 times the entry
; number), are cheap to make:
;   bits 2-12               c & 0x1FFC                       one ANDI
;   bits 13-23              (c >> 11) & 0x1FFC               two
;   bits 24-31 and 0-1      ror(c, 22) & 0xFFC               two
; T0[v] = F(v << 2), T1[v] = F(v << 13), T2[v] = F((v & 0xFF) << 24 | v >> 8):
; 2048 + 2048 + 1024 entries, 20 KB. That is 12 instructions a word (load,
; xor, five for the indexes, three indexed loads, two xors). Byte-at-a-time
; Sarwate is about 6 instructions a byte (24 a word) and the usual
; slicing-by-4 or -8 with byte tables 17 a word; two 16-bit tables would be
; 9 a word, but their 512 KB take more to build (~450K cycles) than they
; save on a 256 KB buffer.
;
; The tables are built at run time. Each is linear, so after its basis
; values (F of single bits) every entry is one xor: T[2^k + j] = T[j] ^ B[k].
; F(1 << k) = f^(32-k)(1), so one run of 32 bit steps from 1 gives every
; basis value. A byte step needs f^8(v) = F(v << 24) = T2[v].

        .include "lib/start.s"
        .include "lib/print.s"

POLY   = 0xEDB88320
LCG_A  = 1664525
LCG_C  = 1013904223
LCG_A2 = 0x17385ca9         ; LCG_A ** 2 mod 2**32: two steps at once
LCG_C2 = 0x47502932         ; LCG_C * (LCG_A + 1) mod 2**32
BUF    = 0x40000            ; the 256 KB buffer, 0x40000-0x7FFFF
BUFLEN = 0x40000

main:   addi    sp, sp, -4
        sw      lr, [sp]
        call    crc_init
        la      r2, check               ; "123456789"
        li      r3, 9
        call    crc32
        call    print_hex
        call    space
        la      r1, check
        call    puts
        call    newline
        li      r1, BUF                 ; 256 KB of LCG output, seed 1
        li      r2, BUFLEN / 4
        li      r3, 1
        call    lcg_fill
        li      r2, BUF
        li      r3, BUFLEN
        call    crc32
        call    print_hex
        call    space
        la      r1, lab_lcg
        call    puts
        call    newline
        lw      lr, [sp]
        addi    sp, sp, 4
        ret

; crc32: r1 = CRC-32 of the r3 bytes at r2 (r2 a multiple of 4).
; Leaf; uses r1-r15.
;   r1 CRC register   r2 pointer   r4 r5 r6 tables T0 T1 T2
crc32:  li      r1, -1                  ; initial value 0xFFFFFFFF
        la      r4, crc_t0
        la      r5, crc_t1
        la      r6, crc_t2
        srli    r7, r3, 4               ; 16-byte groups
        beqz    r7, .words
        ; main loop: 4 words per pass, no stalls
.g4:    lw      r12, [r2]
        lw      r13, [r2 + 4]
        lw      r14, [r2 + 8]
        lw      r15, [r2 + 12]
        addi    r2, r2, 16
        xor     r1, r1, r12             ; word 0
        andi    r9, r1, 0x1FFC          ; bits 2-12, times 4
        srli    r10, r1, 11
        andi    r10, r10, 0x1FFC        ; bits 13-23, times 4
        rori    r11, r1, 22
        andi    r11, r11, 0xFFC         ; bits 24-31 and 0-1, times 4
        lwx     r9, [r4 + r9]
        lwx     r10, [r5 + r10]
        lwx     r11, [r6 + r11]
        xor     r1, r9, r10
        xor     r1, r1, r11
        xor     r1, r1, r13             ; word 1
        andi    r9, r1, 0x1FFC
        srli    r10, r1, 11
        andi    r10, r10, 0x1FFC
        rori    r11, r1, 22
        andi    r11, r11, 0xFFC
        lwx     r9, [r4 + r9]
        lwx     r10, [r5 + r10]
        lwx     r11, [r6 + r11]
        xor     r1, r9, r10
        xor     r1, r1, r11
        xor     r1, r1, r14             ; word 2
        andi    r9, r1, 0x1FFC
        srli    r10, r1, 11
        andi    r10, r10, 0x1FFC
        rori    r11, r1, 22
        andi    r11, r11, 0xFFC
        lwx     r9, [r4 + r9]
        lwx     r10, [r5 + r10]
        lwx     r11, [r6 + r11]
        xor     r1, r9, r10
        xor     r1, r1, r11
        xor     r1, r1, r15             ; word 3
        andi    r9, r1, 0x1FFC
        srli    r10, r1, 11
        andi    r10, r10, 0x1FFC
        rori    r11, r1, 22
        andi    r11, r11, 0xFFC
        lwx     r9, [r4 + r9]
        lwx     r10, [r5 + r10]
        lwx     r11, [r6 + r11]
        xor     r1, r9, r10
        xor     r1, r1, r11
        dbnz    r7, .g4
        ; up to 3 more words
.words: srli    r7, r3, 2
        andi    r7, r7, 3
        beqz    r7, .bytes
.w1:    lw      r12, [r2]
        addi    r2, r2, 4
        xor     r1, r1, r12
        andi    r9, r1, 0x1FFC
        srli    r10, r1, 11
        andi    r10, r10, 0x1FFC
        rori    r11, r1, 22
        andi    r11, r11, 0xFFC
        lwx     r9, [r4 + r9]
        lwx     r10, [r5 + r10]
        lwx     r11, [r6 + r11]
        xor     r1, r9, r10
        xor     r1, r1, r11
        dbnz    r7, .w1
        ; up to 3 more bytes: c = (c >> 8) ^ f^8(low byte of c ^ b)
.bytes: andi    r7, r3, 3
        beqz    r7, .done
.b1:    lbu     r12, [r2]
        addi    r2, r2, 1
        xor     r12, r12, r1
        andi    r12, r12, 0xFF
        slli    r12, r12, 2             ; T2 index v, times 4
        lwx     r12, [r6 + r12]
        srli    r1, r1, 8
        xor     r1, r1, r12
        dbnz    r7, .b1
.done:  not     r1, r1                  ; final xor with 0xFFFFFFFF
        ret

; crc_init: build T0, T1, T2. Uses r1-r10.
crc_init:
        ; basis: g(m) = f^m(1) for m = 1..32 and B[k] = g(32 - k)
        la      r1, crc_basis + 128
        li      r2, 1
        li      r3, POLY
        li      r4, 32
.bit:   andi    r5, r2, 1
        neg     r5, r5
        and     r5, r5, r3
        srli    r2, r2, 1
        xor     r2, r2, r5              ; one bit step
        addi    r1, r1, -4
        sw      r2, [r1]                ; crc_basis[32 - m] = g(m)
        dbnz    r4, .bit
        lw      r2, [crc_basis]         ; T2's basis runs B[24..31], B[0], B[1]
        sw      r2, [crc_basis + 128]
        lw      r2, [crc_basis + 4]
        sw      r2, [crc_basis + 132]
        ; build each table from its basis values
        la      r1, crc_t0
        la      r2, crc_basis + 8
        li      r3, 11
        mov     r9, lr
        call    build
        la      r1, crc_t1
        la      r2, crc_basis + 52
        li      r3, 11
        call    build
        la      r1, crc_t2
        la      r2, crc_basis + 96
        li      r3, 10
        call    build
        jr      r9

; build: r1 = table, r2 = its basis values, r3 = index bits.
; T[0] = 0, then for k = 0 .. bits-1: T[2^k + j] = T[j] ^ B[k], j < 2^k.
; Leaf; uses r1-r8, r10.
build:  sw      r0, [r1]
        li      r4, 1                   ; entries so far
.k:     lw      r5, [r2]                ; B[k]
        addi    r2, r2, 4
        mov     r6, r1                  ; source T[j]
        slli    r7, r4, 2
        add     r7, r7, r1              ; destination T[2^k + j]
        mov     r8, r4
.j:     lw      r10, [r6]
        addi    r6, r6, 4
        xor     r10, r10, r5
        sw      r10, [r7]
        addi    r7, r7, 4
        dbnz    r8, .j
        slli    r4, r4, 1
        dbnz    r3, .k
        ret

; lcg_fill: store r2 words (even, 2 or more) of x = LCG_A x + LCG_C at r1,
; starting from the seed r3 (x1 first). Leaf; uses r1-r10.
; The multiplier is slow and can't overlap itself, so the work is split:
; it makes every other word, two steps ahead (x[n+2] = LCG_A2 x[n] + LCG_C2),
; while the ALU makes the word in between with shifts and adds
; (LCG_A = 25 * 139 * 479) in the multiply's shadow.
lcg_fill:
        li      r4, LCG_A2
        li      r5, LCG_C2
        li      r7, LCG_C
        li      r8, LCG_A
        multu   r3, r8
        mflo    r6
        add     r6, r6, r7              ; x1
        srli    r2, r2, 1               ; pairs
.loop:  multu   r6, r4                  ; x[n+2], meanwhile x[n+1] = A x[n] + C:
        slli    r8, r6, 4
        slli    r9, r6, 3
        add     r8, r8, r9
        add     r8, r8, r6              ; x * 25
        slli    r9, r8, 7
        slli    r10, r8, 3
        add     r9, r9, r10
        slli    r10, r8, 1
        add     r9, r9, r10
        add     r8, r9, r8              ; * 139
        slli    r9, r8, 9
        slli    r10, r8, 5
        sub     r9, r9, r10
        sub     r8, r9, r8              ; * 479
        add     r8, r8, r7              ; + C
        sw      r6, [r1]
        sw      r8, [r1 + 4]
        addi    r1, r1, 8
        mflo    r6
        add     r6, r6, r5
        dbnz    r2, .loop
        ret

        .data
check:  .asciz  "123456789"
lab_lcg:
        .asciz  "lcg-256k"
        .align  4
crc_basis:
        .space  136
crc_t0: .space  8192
crc_t1: .space  8192
crc_t2: .space  4096
