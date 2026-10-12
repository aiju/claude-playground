"""Generates programs/aes.s: AES-128 CTR (T-table rounds, counter-mode caching of rounds 0-2).

The assembler has no macros, so the unrolled code is written by this
script. Run it from anywhere: python3 programs/gen/aes.py
"""

import os

out = []
P = out.append

S = ["r1", "r2", "r3", "r4"]
T = ["r5", "r6", "r7", "r8"]
X = ["r9", "r10", "r11", "r12"]
TE = ["r13", "r14", "r15", "r16"]

def round_(src, dst, rkoff, label):
    P(f"        ; {label}")
    for j in range(4):
        a, b, c, d = src[j], src[(j + 1) % 4], src[(j + 2) % 4], src[(j + 3) % 4]
        o = dst[j]
        P(f"        lw      {o}, [r17 + {rkoff + 4 * j}]{'':9}; column {j}: round key")
        P(f"        slli    r9, {a}, 2")
        P(f"        andi    r9, r9, 0x3FC           ; row 0 of column {j}")
        P(f"        srli    r10, {b}, 6")
        P(f"        andi    r10, r10, 0x3FC         ; row 1 of column {(j + 1) % 4}")
        P(f"        srli    r11, {c}, 14")
        P(f"        andi    r11, r11, 0x3FC         ; row 2 of column {(j + 2) % 4}")
        P(f"        srli    r12, {d}, 22")
        P(f"        andi    r12, r12, 0x3FC         ; row 3 of column {(j + 3) % 4}")
        P(f"        lwx     r9, [r13 + r9]")
        P(f"        lwx     r10, [r14 + r10]")
        P(f"        lwx     r11, [r15 + r11]")
        P(f"        lwx     r12, [r16 + r12]")
        P(f"        xor     {o}, {o}, r9")
        P(f"        xor     {o}, {o}, r10")
        P(f"        xor     {o}, {o}, r11")
        P(f"        xor     {o}, {o}, r12")

def final(src, dst, rkoff):
    P("        ; round 10: SubBytes and ShiftRows through the S-box, no MixColumns")
    for j in range(4):
        a, b, c, d = src[j], src[(j + 1) % 4], src[(j + 2) % 4], src[(j + 3) % 4]
        o = dst[j]
        P(f"        lw      {o}, [r17 + {rkoff + 4 * j}]{'':9}; column {j}")
        P(f"        andi    r9, {a}, 0xFF")
        P(f"        srli    r10, {b}, 8")
        P(f"        andi    r10, r10, 0xFF")
        P(f"        srli    r11, {c}, 16")
        P(f"        andi    r11, r11, 0xFF")
        P(f"        srli    r12, {d}, 24")
        P(f"        lbux    r9, [r19 + r9]")
        P(f"        lbux    r10, [r19 + r10]")
        P(f"        lbux    r11, [r19 + r11]")
        P(f"        lbux    r12, [r19 + r12]")
        P(f"        slli    r10, r10, 8")
        P(f"        slli    r11, r11, 16")
        P(f"        slli    r12, r12, 24")
        P(f"        xor     {o}, {o}, r9")
        P(f"        xor     {o}, {o}, r10")
        P(f"        xor     {o}, {o}, r11")
        P(f"        xor     {o}, {o}, r12")

P(r'''; aes: AES-128 encryption.
;  1. FIPS-197 appendix C.1 (prints the ciphertext).
;  2. CTR mode over 16 KB of LCG output, key and initial counter block from
;     NIST SP 800-38A F.5.1, the counter block incremented as a 128-bit
;     big-endian number. Prints a checksum of the ciphertext: over its
;     little-endian words w, chk = rotl(chk, 5) + w.
;
; The state is four little-endian column words (row 0 in the low byte).
; A round is the usual T-table form: each output column is
;   Te0[row 0 of column j] ^ Te1[row 1 of column j+1]
;     ^ Te2[row 2 of column j+2] ^ Te3[row 3 of column j+3] ^ round key
; which does SubBytes, ShiftRows, MixColumns and AddRoundKey together:
; 17 instructions a column (8 to pull out and scale the four bytes, four
; indexed loads, the key load, four xors), no stalls, 68 a round. The last
; round uses the S-box instead (18 a column). In CTR mode only the last
; byte of the counter block changes within a run of 256 blocks, so most of
; rounds 1 and 2 is worked out once per run (see aes_ctr): a block costs
; about 600 instructions instead of 730.
;
; All tables are built at run time: exp/log tables over GF(2^8) give the
; inverses, the affine map gives the S-box, and Te1-Te3 are Te0 rotated.

        .include "lib/start.s"
        .include "lib/print.s"

LCG_A  = 1664525
LCG_C  = 1013904223
LCG_A2 = 0x17385ca9         ; LCG_A ** 2 mod 2**32: two steps at once
LCG_C2 = 0x47502932         ; LCG_C * (LCG_A + 1) mod 2**32
BUF    = 0x10000            ; the 16 KB CTR buffer, encrypted in place
NBLK   = 1024

main:   addi    sp, sp, -4
        sw      lr, [sp]
        call    aes_tables
        ; FIPS-197 C.1
        la      r1, key_c1
        call    aes_setkey
        lw      r1, [pt_c1]
        lw      r2, [pt_c1 + 4]
        lw      r3, [pt_c1 + 8]
        lw      r4, [pt_c1 + 12]
        call    aes_encrypt
        call    print_block
        la      r1, lab_c1
        call    puts
        call    newline
        ; CTR over 16 KB
        li      r1, BUF
        li      r2, NBLK * 4
        li      r3, 1
        call    lcg_fill
        la      r1, key_ctr
        call    aes_setkey
        li      r1, BUF
        li      r2, NBLK
        call    aes_ctr
        call    print_hex
        call    space
        la      r1, lab_ctr
        call    puts
        call    newline
        lw      lr, [sp]
        addi    sp, sp, 4
        ret

; print_block: print the 16 bytes in r1-r4 (little-endian words) in hex,
; then a space.
print_block:
        addi    sp, sp, -20
        sw      lr, [sp + 16]
        sw      r2, [sp + 12]
        sw      r3, [sp + 8]
        sw      r4, [sp + 4]
        call    .one
        lw      r1, [sp + 12]
        call    .one
        lw      r1, [sp + 8]
        call    .one
        lw      r1, [sp + 4]
        call    .one
        call    space
        lw      lr, [sp + 16]
        addi    sp, sp, 20
        ret
.one:   li      r9, 0x00FF00FF          ; byte-swap, then print as a number
        rori    r7, r1, 8
        rori    r8, r1, 24
        andn    r7, r7, r9
        and     r8, r8, r9
        or      r1, r7, r8
        j       print_hex

''')
P("; aes_encrypt: encrypt the block in r1-r4 with the key schedule at rkeys.\n; Result in r1-r4. Uses r1-r19.\naes_encrypt:\n        addi    sp, sp, -4\n        sw      lr, [sp]\n        la      r13, te0\n        la      r14, te1\n        la      r15, te2\n        la      r16, te3\n        la      r19, sbox\n        call    aes_r12\n        la      r17, rkeys + 32\n        call    aes_rounds3\n        lw      lr, [sp]\n        addi    sp, sp, 4\n        ret\n\n; The rounds come in two pieces with a private convention:\n;   r13-r16 = te0-te3, r19 = sbox; r5-r12, r17, r18 are scratch.\n; aes_r12: AddRoundKey and rounds 1-2. In: r1-r4. Out: round 1's result in\n; r5-r8, round 2's in r1-r4.\naes_r12:\n        la      r17, rkeys\n        lw      r5, [r17]               ; round 0: AddRoundKey\n        lw      r6, [r17 + 4]\n        lw      r7, [r17 + 8]\n        lw      r8, [r17 + 12]\n        xor     r1, r1, r5\n        xor     r2, r2, r6\n        xor     r3, r3, r7\n        xor     r4, r4, r8")
round_(S, T, 16, 'round 1: r1-r4 -> r5-r8')
round_(T, S, 32, 'round 2: r5-r8 -> r1-r4')
P('        ret\n\n; aes_rounds3: rounds 3-10. In: r1-r4, r17 = rkeys + 32. Out: r1-r4.\naes_rounds3:\n        li      r18, 3\n.rounds:')
round_(S, T, 16, 'odd round: r1-r4 -> r5-r8')
round_(T, S, 32, 'even round: r5-r8 -> r1-r4')
P('        addi    r17, r17, 32\n        dbnz    r18, .rounds')
round_(S, T, 16, 'round 9: r1-r4 -> r5-r8')
final(T, S, 32)
P("        ret\n\n; aes_ctr: encrypt r2 blocks at r1 in place in CTR mode, counter block\n; ctr0, key schedule at rkeys. Returns the checksum in r1.\n;\n; Counter-mode caching: the counter block changes only in its last byte\n; except once every 256 blocks. Round 1 output column j takes one byte from\n; each input column, and only column 0 takes byte 15, so within a run of\n; 256 blocks round 1 changes only in column 0:\n;   t0 = P0 ^ Te3[byte 15 ^ round key 0 byte 15]\n; Round 2 output column j takes exactly one byte of t0, so\n;   u0 = Q0 ^ Te0[row 0 of t0]   u1 = Q1 ^ Te3[row 3 of t0]\n;   u2 = Q2 ^ Te2[row 2 of t0]   u3 = Q3 ^ Te1[row 1 of t0]\n; P0 and Q0-Q3 are worked out at the start of each run. A block then costs\n; 21 instructions for rounds 0-2 instead of 144.\n;   r20 P0   r21-r24 Q0-Q3   r25 round key 0 byte 15   r26 counter low word\n;   r27 buffer pointer   r28 checksum   r29 blocks left in this run\n;   ctr_blk: the counter block's words 0-2 (as loaded), ctr_left: blocks\n;   left after this run\naes_ctr:\n        addi    sp, sp, -60\n        sw      lr, [sp + 56]\n        sw      r16, [sp + 52]\n        sw      r17, [sp + 48]\n        sw      r18, [sp + 44]\n        sw      r19, [sp + 40]\n        sw      r20, [sp + 36]\n        sw      r21, [sp + 32]\n        sw      r22, [sp + 28]\n        sw      r23, [sp + 24]\n        sw      r24, [sp + 20]\n        sw      r25, [sp + 16]\n        sw      r26, [sp + 12]\n        sw      r27, [sp + 8]\n        sw      r28, [sp + 4]\n        sw      r29, [sp]\n        mov     r27, r1\n        sw      r2, [ctr_left]\n        la      r13, te0\n        la      r14, te1\n        la      r15, te2\n        la      r16, te3\n        la      r19, sbox\n        lw      r1, [ctr0]              ; working copy of counter words 0-2\n        lw      r2, [ctr0 + 4]\n        lw      r3, [ctr0 + 8]\n        sw      r1, [ctr_blk]\n        sw      r2, [ctr_blk + 4]\n        sw      r3, [ctr_blk + 8]\n        lw      r1, [ctr0 + 12]         ; counter bytes 12-15, little-endian ...\n        call    bswap\n        mov     r26, r1                 ; ... as a number\n        lw      r25, [rkeys + 12]\n        srli    r25, r25, 24            ; round key 0, byte 15\n        li      r28, 0\n\n        ; start a run: up to 256 blocks in which only byte 15 changes\n.run:   andi    r29, r26, 0xFF\n        sub     r29, r0, r29\n        addi    r29, r29, 256           ; blocks until byte 15 wraps\n        lw      r1, [ctr_left]\n        bgeu    r1, r29, .full\n        mov     r29, r1                 ; (fewer left than that)\n.full:  sub     r1, r1, r29\n        sw      r1, [ctr_left]\n        mov     r1, r26\n        call    bswap\n        mov     r4, r1\n        lw      r1, [ctr_blk]\n        lw      r2, [ctr_blk + 4]\n        lw      r3, [ctr_blk + 8]\n        call    aes_r12                 ; rounds 1-2 of the run's first block\n        andi    r9, r26, 0xFF           ; take byte 15's terms back out\n        xor     r9, r9, r25\n        slli    r9, r9, 2\n        lwx     r9, [r16 + r9]\n        xor     r20, r5, r9             ; P0\n        slli    r9, r5, 2\n        andi    r9, r9, 0x3FC\n        srli    r10, r5, 22\n        andi    r10, r10, 0x3FC\n        srli    r11, r5, 14\n        andi    r11, r11, 0x3FC\n        srli    r12, r5, 6\n        andi    r12, r12, 0x3FC\n        lwx     r9, [r13 + r9]\n        lwx     r10, [r16 + r10]\n        lwx     r11, [r15 + r11]\n        lwx     r12, [r14 + r12]\n        xor     r21, r1, r9             ; Q0\n        xor     r22, r2, r10            ; Q1\n        xor     r23, r3, r11            ; Q2\n        xor     r24, r4, r12            ; Q3\n\n        ; one block\n.blk:   andi    r9, r26, 0xFF           ; rounds 0-1: column 0 only\n        xor     r9, r9, r25\n        slli    r9, r9, 2\n        lwx     r9, [r16 + r9]\n        xor     r5, r20, r9             ; t0\n        slli    r9, r5, 2               ; round 2: one term per column\n        andi    r9, r9, 0x3FC\n        srli    r10, r5, 22\n        andi    r10, r10, 0x3FC\n        srli    r11, r5, 14\n        andi    r11, r11, 0x3FC\n        srli    r12, r5, 6\n        andi    r12, r12, 0x3FC\n        lwx     r9, [r13 + r9]\n        lwx     r10, [r16 + r10]\n        lwx     r11, [r15 + r11]\n        lwx     r12, [r14 + r12]\n        xor     r1, r21, r9\n        xor     r2, r22, r10\n        xor     r3, r23, r11\n        xor     r4, r24, r12\n        la      r17, rkeys + 32\n        call    aes_rounds3\n        lw      r5, [r27]               ; xor the keystream into the data\n        lw      r6, [r27 + 4]\n        lw      r7, [r27 + 8]\n        lw      r8, [r27 + 12]\n        xor     r1, r1, r5\n        xor     r2, r2, r6\n        xor     r3, r3, r7\n        xor     r4, r4, r8\n        sw      r1, [r27]\n        sw      r2, [r27 + 4]\n        sw      r3, [r27 + 8]\n        sw      r4, [r27 + 12]\n        rori    r28, r28, 27            ; checksum: rotl 5, add\n        add     r28, r28, r1\n        rori    r28, r28, 27\n        add     r28, r28, r2\n        rori    r28, r28, 27\n        add     r28, r28, r3\n        rori    r28, r28, 27\n        add     r28, r28, r4\n        addi    r27, r27, 16\n        addi    r26, r26, 1             ; next counter block\n        dbnz    r29, .blk\n\n        lw      r1, [ctr_left]\n        beqz    r1, .done\n        bnez    r26, .run\n        ; the low word wrapped: carry into words 2, 1, 0 (big-endian)\n        la      r9, ctr_blk + 8\n.carry: lw      r1, [r9]\n        call    bswap\n        addi    r1, r1, 1\n        mov     r10, r1\n        call    bswap\n        sw      r1, [r9]\n        addi    r9, r9, -4\n        beqz    r10, .carry\n        j       .run\n.done:  mov     r1, r28\n        lw      r29, [sp]\n        lw      r28, [sp + 4]\n        lw      r27, [sp + 8]\n        lw      r26, [sp + 12]\n        lw      r25, [sp + 16]\n        lw      r24, [sp + 20]\n        lw      r23, [sp + 24]\n        lw      r22, [sp + 28]\n        lw      r21, [sp + 32]\n        lw      r20, [sp + 36]\n        lw      r19, [sp + 40]\n        lw      r18, [sp + 44]\n        lw      r17, [sp + 48]\n        lw      r16, [sp + 52]\n        lw      lr, [sp + 56]\n        addi    sp, sp, 60\n        ret\n\n; bswap: reverse the bytes of r1. Leaf; uses r1, r6-r8.\nbswap:  li      r6, 0x00FF00FF\n        rori    r7, r1, 8\n        rori    r8, r1, 24\n        andn    r7, r7, r6\n        and     r8, r8, r6\n        or      r1, r7, r8\n        ret\n\n")
P(r'''; aes_setkey: expand the 16-byte key at r1 (word-aligned) into rkeys.
; Leaf; uses r1-r12. Words are little-endian, so RotWord is a rotate right
; by 8 and Rcon goes into the low byte.
aes_setkey:
        lw      r2, [r1]
        lw      r3, [r1 + 4]
        lw      r4, [r1 + 8]
        lw      r5, [r1 + 12]
        la      r6, rkeys
        la      r7, sbox
        li      r8, 1                   ; rcon
        li      r9, 10
        sw      r2, [r6]
        sw      r3, [r6 + 4]
        sw      r4, [r6 + 8]
        sw      r5, [r6 + 12]
.key:   rori    r10, r5, 8              ; RotWord
        andi    r11, r10, 0xFF          ; SubWord, a byte at a time
        lbux    r1, [r7 + r11]
        srli    r11, r10, 8
        andi    r11, r11, 0xFF
        lbux    r11, [r7 + r11]
        slli    r11, r11, 8
        xor     r1, r1, r11
        srli    r11, r10, 16
        andi    r11, r11, 0xFF
        lbux    r11, [r7 + r11]
        slli    r11, r11, 16
        xor     r1, r1, r11
        srli    r11, r10, 24
        lbux    r11, [r7 + r11]
        slli    r11, r11, 24
        xor     r1, r1, r11
        xor     r1, r1, r8              ; Rcon
        slli    r8, r8, 1               ; next Rcon = xtime(rcon)
        srli    r12, r8, 8
        neg     r12, r12
        andi    r12, r12, 0x11B
        xor     r8, r8, r12
        xor     r2, r2, r1
        xor     r3, r3, r2
        xor     r4, r4, r3
        xor     r5, r5, r4
        addi    r6, r6, 16
        sw      r2, [r6]
        sw      r3, [r6 + 4]
        sw      r4, [r6 + 8]
        sw      r5, [r6 + 12]
        dbnz    r9, .key
        ret

; aes_tables: build exp/log over GF(2^8) (generator 3), the S-box and
; Te0-Te3. Leaf; uses r1-r15.
aes_tables:
        la      r1, gexp
        la      r2, glog
        li      r3, 1                   ; p = 3^i
        li      r4, 0                   ; i
        li      r5, 255
.el:    add     r6, r1, r4
        sb      r3, [r6]                ; exp[i] = p
        add     r6, r2, r3
        sb      r4, [r6]                ; log[p] = i
        slli    r6, r3, 1               ; p *= 3: p ^ xtime(p)
        srli    r7, r3, 7
        neg     r7, r7
        andi    r7, r7, 0x11B
        xor     r6, r6, r7
        xor     r3, r3, r6
        addi    r4, r4, 1
        dbnz    r5, .el
        li      r3, 1
        sb      r3, [r1 + 255]          ; exp[255] = exp[0], for inv(1)
        la      r3, sbox
        la      r8, te0
        li      r4, 0                   ; x
        li      r5, 256
.sb:    lbux    r6, [r2 + r4]           ; log x
        sub     r6, r0, r6
        addi    r6, r6, 255
        lbux    r6, [r1 + r6]           ; x^-1 = exp[255 - log x] ...
        sltu    r7, r0, r4
        neg     r7, r7
        and     r6, r6, r7              ; ... and 0 for x = 0
        slli    r7, r6, 8               ; affine map: b ^ rotl(b, 1..4) ^ 0x63
        or      r7, r7, r6              ; b doubled up, so rotl8(b, k) = (bb >> (8-k)) & 0xFF
        srli    r9, r7, 7
        xor     r6, r6, r9
        srli    r9, r7, 6
        xor     r6, r6, r9
        srli    r9, r7, 5
        xor     r6, r6, r9
        srli    r9, r7, 4
        xor     r6, r6, r9
        andi    r6, r6, 0xFF
        xori    r6, r6, 0x63            ; s = S[x]
        add     r9, r3, r4
        sb      r6, [r9]
        slli    r9, r6, 1               ; 2s
        srli    r10, r6, 7
        neg     r10, r10
        andi    r10, r10, 0x11B
        xor     r9, r9, r10
        xor     r10, r9, r6             ; 3s
        slli    r11, r6, 8
        or      r9, r9, r11
        slli    r11, r6, 16
        or      r9, r9, r11
        slli    r10, r10, 24
        or      r9, r9, r10             ; Te0[x] = (2s, s, s, 3s)
        sw      r9, [r8]
        rori    r10, r9, 24
        sw      r10, [r8 + 1024]        ; Te1 = rotl(Te0, 8)
        rori    r10, r9, 16
        sw      r10, [r8 + 2048]        ; Te2 = rotl(Te0, 16)
        rori    r10, r9, 8
        sw      r10, [r8 + 3072]        ; Te3 = rotl(Te0, 24)
        addi    r8, r8, 4
        addi    r4, r4, 1
        dbnz    r5, .sb
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
        .align  4
key_c1: .byte   0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07
        .byte   0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f
pt_c1:  .byte   0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77
        .byte   0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff
key_ctr:
        .byte   0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6
        .byte   0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c
ctr0:   .byte   0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7
        .byte   0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff
rkeys:  .space  176
ctr_blk: .space 12
ctr_left: .space 4
te0:    .space  1024                    ; te0-te3 must be consecutive
te1:    .space  1024
te2:    .space  1024
te3:    .space  1024
sbox:   .space  256
gexp:   .space  256
glog:   .space  256
lab_c1: .asciz  "fips-197-c1"
lab_ctr:
        .asciz  "ctr-16k-checksum"''')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'aes.s'), 'w').write("\n".join(["; Generated by programs/gen/aes.py: edit that, not this file.", ";"] + out) + "\n")
