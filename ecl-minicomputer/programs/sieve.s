; sieve: count the primes below 1,000,000, with their sum mod 2^32 and
; the largest one.
;
; One flag byte per odd number: flag[i] is 1 if 2i+1 is prime, else 0
; (500,000 bytes). The work goes in three phases:
;
; 1. Pre-sieve by copying. Multiples of 3, 5, 7 and 11 repeat every
;    3*5*7*11 = 1155 odd numbers, so one 1155-word (4 x 1155 byte) period
;    is built by hand and copied forward 12 times; multiples of 13 are
;    then struck from those 15015 words, which hold one period of
;    3*5*7*11*13, and that period is copied over the rest of the array.
;    A copy costs ~0.6 cycles a byte where striking 3..13 would cost
;    ~1.9 cycles a byte.
; 2. Strike multiples of the remaining primes 17 <= p <= 997 from p^2 on,
;    but only p*m with m coprime to 30: multiples of 3 and 5 are gone
;    already. Those m fall in 8 residue classes mod 30, so 8 pointers,
;    one per class, all step by 30p: 8 of every 15 odd multiples are
;    struck, one SB and one ADD each.
; 3. Count and sum without looking at single bytes. Words are added up in
;    blocks of 20 words with SWAR byte lanes: R = sum of the words, and
;    C = sum of the running values of R, which weights word j of the block
;    by 20 - j. Each block folds R and C into scalar totals; see scan
;    for the arithmetic. This is ~1 instruction a byte instead of ~5.
        .include "lib/start.s"
        .include "lib/print.s"

N       = 1000000
HALF    = N / 2                 ; flags
FLAGS   = 0x1000                ; flag array: reachable as [reg + FLAGS]
FEND    = FLAGS + HALF
P1      = 4 * 1155              ; bytes in a 3*5*7*11 period, word aligned
P2      = 13 * P1               ; ... and in a 3*5*7*11*13 period
BLOCK   = 80                    ; bytes per scan block (20 words)
NBLOCKS = HALF / BLOCK          ; 6250, exactly

main:   addi    sp, sp, -32
        sw      lr, [sp + 28]
        sw      r16, [sp + 24]
        sw      r17, [sp + 20]
        sw      r18, [sp + 16]
        sw      r19, [sp + 12]
        sw      r20, [sp + 8]

; ---- phase 1: pre-sieve 3, 5, 7, 11, 13 by copying ----------------------

        li      r1, FLAGS               ; first period: all candidates
        li      r2, 0x01010101
        li      r3, 1155 / 5
.fill:  sw      r2, [r1]
        sw      r2, [r1 + 4]
        sw      r2, [r1 + 8]
        sw      r2, [r1 + 12]
        sw      r2, [r1 + 16]
        addi    r1, r1, 20
        dbnz    r3, .fill

        li      r16, 3                  ; strike 3, 5, 7, 11 and their odd
.pre:   srli    r1, r16, 1              ; multiples from the first period
        addi    r1, r1, FLAGS           ; (p itself too: fixed up below)
        mov     r2, r16
        li      r3, FLAGS + P1
        call    mark
        addi    r16, r16, 2
        li      r1, 9
        bne     r16, r1, .pre1          ; 3, 5, 7, then 11
        li      r16, 11
.pre1:  li      r1, 13
        bne     r16, r1, .pre

        li      r1, FLAGS + P1          ; copy the 1155-word period forward
        li      r2, FLAGS
        li      r3, FLAGS + P2
        call    copy

        li      r1, FLAGS + 6           ; strike 13 from one 15015-word period
        li      r2, 13
        li      r3, FLAGS + P2
        call    mark

        li      r1, FLAGS + P2          ; and copy that over the rest
        li      r2, FLAGS
        li      r3, FEND
        call    copy

        li      r1, 1                   ; 3, 5, 7, 11 and 13 are prime; 1 isn't
        sb      r0, [FLAGS + 0]
        sb      r1, [FLAGS + 1]
        sb      r1, [FLAGS + 2]
        sb      r1, [FLAGS + 3]
        sb      r1, [FLAGS + 5]
        sb      r1, [FLAGS + 6]

; ---- phase 2: strike multiples of 17 .. 997 ------------------------------

        li      r16, 17                 ; p, stepping over numbers coprime to 30
        li      r17, 4                  ; its wheel position: 17 = WHEEL[4]
        li      r18, 1000               ; p^2 < N
        li      r19, FEND
.prime: srli    r1, r16, 1
        lbu     r1, [r1 + FLAGS]
        beqz    r1, .notp               ; composite p: nothing to do
        mult    r16, r16
        mov     r2, r16
        mov     r3, r19
        mov     r4, r17
        mflo    r1
        srli    r1, r1, 1               ; index of p^2 is (p^2 - 1) / 2
        addi    r1, r1, FLAGS
        call    mark30
.notp:  lbu     r1, [r17 + GAPS4]       ; next p on the wheel
        addi    r17, r17, 1
        andi    r17, r17, 7
        srli    r1, r1, 1
        add     r16, r16, r1
        bltu    r16, r18, .prime

; ---- phase 3: count and sum ----------------------------------------------

        call    scan                    ; r1 = count of odd primes,
        mov     r16, r1                 ; r2 = sum of their indexes i
        slli    r17, r2, 1              ; sum of 2i + 1, plus 2
        add     r17, r17, r1
        addi    r17, r17, 2
        addi    r16, r16, 1             ; count 2 as well

        li      r1, FEND - 1            ; largest prime: last flag set
.last:  lbu     r2, [r1]
        addi    r1, r1, -1
        beqz    r2, .last
        addi    r1, r1, 1 - FLAGS
        slli    r18, r1, 1
        addi    r18, r18, 1

; ---- output --------------------------------------------------------------

        la      r1, s_head
        call    puts
        li      r1, N
        call    print_udec
        la      r1, s_count
        call    puts
        mov     r1, r16
        call    print_udec
        la      r1, s_sum
        call    puts
        mov     r1, r17
        call    print_udec
        la      r1, s_large
        call    puts
        mov     r1, r18
        call    print_udec
        call    newline

        lw      r20, [sp + 8]
        lw      r19, [sp + 12]
        lw      r18, [sp + 16]
        lw      r17, [sp + 20]
        lw      r16, [sp + 24]
        lw      lr, [sp + 28]
        addi    sp, sp, 32
        ret

; mark: clear the bytes at r1, r1 + r2, r1 + 2*r2, ... below r3.
; Eight pointers step by 8*r2, so a strike is one SB and one ADD.
; Clobbers r1-r12.
mark:   add     r4, r1, r2
        add     r5, r4, r2
        add     r6, r5, r2
        add     r7, r6, r2
        add     r8, r7, r2
        add     r9, r8, r2
        add     r10, r9, r2
        slli    r11, r2, 3              ; step
        bgeu    r10, r3, .tail          ; fewer than 8 to strike
.loop:  sb      r0, [r1]
        sb      r0, [r4]
        sb      r0, [r5]
        sb      r0, [r6]
        sb      r0, [r7]
        sb      r0, [r8]
        sb      r0, [r9]
        sb      r0, [r10]
        add     r1, r1, r11
        add     r4, r4, r11
        add     r5, r5, r11
        add     r6, r6, r11
        add     r7, r7, r11
        add     r8, r8, r11
        add     r9, r9, r11
        add     r10, r10, r11
        bltu    r10, r3, .loop
.tail:  bgeu    r1, r3, .done           ; up to 7 more, in increasing order
        sb      r0, [r1]
        bgeu    r4, r3, .done
        sb      r0, [r4]
        bgeu    r5, r3, .done
        sb      r0, [r5]
        bgeu    r6, r3, .done
        sb      r0, [r6]
        bgeu    r7, r3, .done
        sb      r0, [r7]
        bgeu    r8, r3, .done
        sb      r0, [r8]
        bgeu    r9, r3, .done
        sb      r0, [r9]
.done:  ret

; mark30: strike the flags of p*m for m = p and every larger m coprime to
; 30, below r3. r1 = &flag of p^2, r2 = p, r3 = end, r4 = wheel position
; of p. Pointer j starts at the j-th such m (gaps from GAPS4) and steps by
; 15p bytes (30p in numbers). Clobbers r1-r14.
mark30: add     r5, r2, r2
        sw      r2, [PM + 4]            ; PM[g] = p * g for g = 1, 2, 3
        add     r6, r5, r2
        sw      r5, [PM + 8]
        sw      r6, [PM + 12]
        lbu     r13, [r4 + GAPS4]       ; 4 * half gaps from position k on
        lbu     r14, [r4 + GAPS4 + 1]
        slli    r12, r2, 4
        lw      r13, [r13 + PM]
        lbu     r6, [r4 + GAPS4 + 2]
        lw      r14, [r14 + PM]
        add     r5, r1, r13             ; pointers r1, r5 .. r11
        lbu     r7, [r4 + GAPS4 + 3]
        lw      r13, [r6 + PM]
        add     r6, r5, r14
        lbu     r8, [r4 + GAPS4 + 4]
        lw      r14, [r7 + PM]
        add     r7, r6, r13
        lbu     r9, [r4 + GAPS4 + 5]
        lw      r13, [r8 + PM]
        add     r8, r7, r14
        lbu     r10, [r4 + GAPS4 + 6]
        lw      r14, [r9 + PM]
        add     r9, r8, r13
        lw      r13, [r10 + PM]
        add     r10, r9, r14
        sub     r12, r12, r2            ; step 15p
        add     r11, r10, r13
        bgeu    r11, r3, .tail          ; fewer than 8 to strike
.loop:  sb      r0, [r1]
        sb      r0, [r5]
        sb      r0, [r6]
        sb      r0, [r7]
        sb      r0, [r8]
        sb      r0, [r9]
        sb      r0, [r10]
        sb      r0, [r11]
        add     r1, r1, r12
        add     r5, r5, r12
        add     r6, r6, r12
        add     r7, r7, r12
        add     r8, r8, r12
        add     r9, r9, r12
        add     r10, r10, r12
        add     r11, r11, r12
        bltu    r11, r3, .loop
.tail:  bgeu    r1, r3, .done           ; up to 7 more, in increasing order
        sb      r0, [r1]
        bgeu    r5, r3, .done
        sb      r0, [r5]
        bgeu    r6, r3, .done
        sb      r0, [r6]
        bgeu    r7, r3, .done
        sb      r0, [r7]
        bgeu    r8, r3, .done
        sb      r0, [r8]
        bgeu    r9, r3, .done
        sb      r0, [r9]
        bgeu    r10, r3, .done
        sb      r0, [r10]
.done:  ret

; copy: copy words from r2 up to r1 until r1 reaches r3 (r2 < r1, so a
; period at r2 is repeated forward). 16 words a round; it may write up to
; 60 bytes past r3. Clobbers r1-r5.
copy:
.loop:  lw      r4, [r2]
        lw      r5, [r2 + 4]
        sw      r4, [r1]                ; a loaded word can be stored by
        lw      r4, [r2 + 8]            ; the next instruction
        sw      r5, [r1 + 4]
        lw      r5, [r2 + 12]
        sw      r4, [r1 + 8]
        lw      r4, [r2 + 16]
        sw      r5, [r1 + 12]
        lw      r5, [r2 + 20]
        sw      r4, [r1 + 16]
        lw      r4, [r2 + 24]
        sw      r5, [r1 + 20]
        lw      r5, [r2 + 28]
        sw      r4, [r1 + 24]
        lw      r4, [r2 + 32]
        sw      r5, [r1 + 28]
        lw      r5, [r2 + 36]
        sw      r4, [r1 + 32]
        lw      r4, [r2 + 40]
        sw      r5, [r1 + 36]
        lw      r5, [r2 + 44]
        sw      r4, [r1 + 40]
        lw      r4, [r2 + 48]
        sw      r5, [r1 + 44]
        lw      r5, [r2 + 52]
        sw      r4, [r1 + 48]
        lw      r4, [r2 + 56]
        sw      r5, [r1 + 52]
        lw      r5, [r2 + 60]
        sw      r4, [r1 + 56]
        addi    r2, r2, 64
        sw      r5, [r1 + 60]
        addi    r1, r1, 64
        bltu    r1, r3, .loop
        ret

; scan: r1 = number of flags set, r2 = sum of their indexes (mod 2^32).
;
; Block b covers flags 80b .. 80b+79, as words j = 0..19 with byte lanes
; k = 0..3, so flag i = 80b + 4j + k. Per block (lanes stay below 256):
;   R = sum_j w_j               lane k: primes in lane k
;   C = sum_j (R after word j)  lane k: sum_j (20 - j) f(j,k)
; and sum of i over the block's primes
;   = sum_k sum_j (80b + 4j + k) f(j,k)
;   = 80 b cnt + 80 cnt - 4 lanesum(C) + sum_k k R_k.
; Over all blocks:
;   CNT = sum of cnt;  W = sum over blocks of CNT so far, so that
;   sum_b b cnt_b = NBLOCKS * CNT - W
;   SC = sum of lanesum(C)
;   AE, AO = R summed in 16-bit lanes (k = 0, 2 and k = 1, 3); a lane
;   only ever holds a count of primes (< 20,000), so it can't overflow.
scan:   li      r1, FLAGS               ; r1 block pointer
        li      r2, FEND
        li      r3, 0x00FF00FF          ; r3 lane mask
        li      r4, 0                   ; r4 CNT
        li      r5, 0                   ; r5 W
        li      r6, 0                   ; r6 SC
        li      r7, 0                   ; r7 AE
        li      r8, 0                   ; r8 AO
.blk:   lw      r12, [r1]               ; r9 R, r10 C, r11-r13 words, r14-r15 temp
        lw      r13, [r1 + 4]
        lw      r11, [r1 + 8]
        add     r9, r12, r13
        add     r10, r12, r9
        lw      r12, [r1 + 12]
        add     r9, r9, r11
        add     r10, r10, r9
        lw      r13, [r1 + 16]
        add     r9, r9, r12
        add     r10, r10, r9
        lw      r11, [r1 + 20]
        add     r9, r9, r13
        add     r10, r10, r9
        lw      r12, [r1 + 24]
        add     r9, r9, r11
        add     r10, r10, r9
        lw      r13, [r1 + 28]
        add     r9, r9, r12
        add     r10, r10, r9
        lw      r11, [r1 + 32]
        add     r9, r9, r13
        add     r10, r10, r9
        lw      r12, [r1 + 36]
        add     r9, r9, r11
        add     r10, r10, r9
        lw      r13, [r1 + 40]
        add     r9, r9, r12
        add     r10, r10, r9
        lw      r11, [r1 + 44]
        add     r9, r9, r13
        add     r10, r10, r9
        lw      r12, [r1 + 48]
        add     r9, r9, r11
        add     r10, r10, r9
        lw      r13, [r1 + 52]
        add     r9, r9, r12
        add     r10, r10, r9
        lw      r11, [r1 + 56]
        add     r9, r9, r13
        add     r10, r10, r9
        lw      r12, [r1 + 60]
        add     r9, r9, r11
        add     r10, r10, r9
        lw      r13, [r1 + 64]
        add     r9, r9, r12
        add     r10, r10, r9
        lw      r11, [r1 + 68]
        add     r9, r9, r13
        add     r10, r10, r9
        lw      r12, [r1 + 72]
        add     r9, r9, r11
        add     r10, r10, r9
        lw      r13, [r1 + 76]
        add     r9, r9, r12
        add     r10, r10, r9
        add     r9, r9, r13             ; R complete
        add     r10, r10, r9            ; C complete
        srli    r14, r9, 16             ; cnt = lanesum(R): lanes <= 20
        add     r14, r14, r9
        srli    r15, r14, 8
        add     r14, r14, r15
        andi    r14, r14, 0xFF
        add     r4, r4, r14             ; CNT += cnt
        add     r5, r5, r4              ; W += CNT
        and     r14, r10, r3            ; SC += lanesum(C): lanes <= 210
        srli    r15, r10, 8
        and     r15, r15, r3
        add     r14, r14, r15
        srli    r15, r14, 16
        add     r14, r14, r15
        andi    r14, r14, 0xFFFF
        add     r6, r6, r14
        and     r14, r9, r3             ; AE, AO += R
        add     r7, r7, r14
        srli    r14, r9, 8
        and     r14, r14, r3
        add     r8, r8, r14
        addi    r1, r1, BLOCK
        bne     r1, r2, .blk
        ; sum = 80 * ((NBLOCKS + 1) * CNT - W) - 4 * SC + sum_k k * lane_k
        li      r9, NBLOCKS + 1
        mult    r9, r4
        andi    r10, r8, 0xFFFF         ; lane 1
        srli    r11, r7, 16             ; lane 2
        srli    r12, r8, 16             ; lane 3
        add     r10, r10, r11
        add     r10, r10, r11
        add     r10, r10, r12
        add     r10, r10, r12
        add     r10, r10, r12
        slli    r6, r6, 2
        sub     r10, r10, r6
        li      r11, 80
        mflo    r9
        sub     r9, r9, r5
        mult    r9, r11
        mov     r1, r4
        mflo    r2
        add     r2, r2, r10
        ret

        .data
; the wheel mod 30: residues 1, 7, 11, 13, 17, 19, 23, 29; GAPS4[k] is 4 *
; half the gap from residue k to the next, twice over for wrap-around
GAPS4:  .byte   12, 8, 4, 8, 4, 8, 12, 4, 12, 8, 4, 8, 4, 8, 12, 4
        .align  4
PM:     .space  16                      ; mark30's p * g table
s_head:  .asciz "primes below "
s_count: .asciz "\ncount "
s_sum:   .asciz "\nsum mod 2^32 "
s_large: .asciz "\nlargest "
