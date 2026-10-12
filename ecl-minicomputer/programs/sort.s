; sort: sort 20,000 LCG words (unsigned), check the order, print a
; checksum (rotate-left-5/xor fold over the sorted words) and three
; elements.
;
; LSD radix sort, three passes of 11, 11 and 10 bits, A -> B -> A -> B.
; Nothing in it branches on the data, so nothing mispredicts; a
; comparison sort would mispredict about every other comparison.
;
; - All three histograms are counted while the words are generated: the
;   LCG's multiply runs in the shadow of the counting.
; - The count tables sit in the first 32 KB, so a scaled digit d is the
;   base register: lw p, [d + T0]. They count in bytes (4 per word), and
;   the prefix sums turn them into destination addresses.
; - A scatter step is 7 instructions: load, extract the digit (2), load
;   the destination pointer, store, bump the pointer, store it back.
        .include "lib/start.s"
        .include "lib/print.s"

N       = 20000
SEED    = 12345
LCG_A   = 1664525
LCG_C   = 1013904223
T0      = 0x2000                ; 2048 pointers for bits 0-10
T1      = 0x4000                ; 2048 for bits 11-21
T2      = 0x6000                ; 1024 for bits 22-31
A       = 0x10000               ; the words, and the result of pass 1
B       = 0x30000               ; results of passes 0 and 2

main:   addi    sp, sp, -4
        sw      lr, [sp]

; ---- generate the words and count all three digits ------------------------

        li      r1, SEED
        li      r2, LCG_A
        li      r3, LCG_C
        li      r4, A
        li      r5, N / 2
        multu   r1, r2
        mflo    r1
        add     r1, r1, r3              ; first word
        multu   r1, r2                  ; and the product for the second
.gen:   sw      r1, [r4]
        slli    r6, r1, 2               ; the three digits, times 4
        srli    r7, r1, 9
        srli    r8, r1, 20
        andi    r6, r6, 0x1FFC
        andi    r7, r7, 0x1FFC
        andi    r8, r8, 0xFFC
        lw      r9, [r6 + T0]
        lw      r10, [r7 + T1]
        lw      r11, [r8 + T2]
        addi    r9, r9, 4
        addi    r10, r10, 4
        addi    r11, r11, 4
        sw      r9, [r6 + T0]
        sw      r10, [r7 + T1]
        sw      r11, [r8 + T2]
        mflo    r1                      ; next word
        add     r1, r1, r3
        multu   r1, r2
        sw      r1, [r4 + 4]            ; the same for the second word
        slli    r6, r1, 2
        srli    r7, r1, 9
        srli    r8, r1, 20
        andi    r6, r6, 0x1FFC
        andi    r7, r7, 0x1FFC
        andi    r8, r8, 0xFFC
        lw      r9, [r6 + T0]
        lw      r10, [r7 + T1]
        lw      r11, [r8 + T2]
        addi    r9, r9, 4
        addi    r10, r10, 4
        addi    r11, r11, 4
        sw      r9, [r6 + T0]
        sw      r10, [r7 + T1]
        sw      r11, [r8 + T2]
        addi    r4, r4, 8
        mflo    r1
        add     r1, r1, r3
        multu   r1, r2
        dbnz    r5, .gen

; ---- counts -> destination pointers ---------------------------------------

        li      r1, T0
        li      r2, T0 + 4 * 2048
        li      r3, B
        call    prefix
        li      r1, T1
        li      r2, T1 + 4 * 2048
        li      r3, A
        call    prefix
        li      r1, T2
        li      r2, T2 + 4 * 1024
        li      r3, B
        call    prefix

; ---- three scatter passes -------------------------------------------------

        li      r1, A
        li      r2, A + 4 * N
        call    pass0
        li      r1, B
        li      r2, B + 4 * N
        call    pass1
        li      r1, A
        li      r2, A + 4 * N
        call    pass2

; ---- check the order and fold the checksum ---------------------------------

        li      r1, B
        li      r2, B + 4 * N
        li      r3, 0                   ; previous word
        li      r4, 0                   ; checksum
        lw      r6, [r1]
        lw      r7, [r1 + 4]
.check: lw      r8, [r1 + 8]
        bltu    r6, r3, .bad            ; out of line: predicted not taken
        rori    r4, r4, 27
        xor     r4, r4, r6
        lw      r9, [r1 + 12]
        bltu    r7, r6, .bad
        rori    r4, r4, 27
        xor     r4, r4, r7
        lw      r6, [r1 + 16]           ; (reads one pair past the end on the
        bltu    r8, r7, .bad            ; last round, harmlessly)
        rori    r4, r4, 27
        xor     r4, r4, r8
        lw      r7, [r1 + 20]
        bltu    r9, r8, .bad
        rori    r4, r4, 27
        xor     r4, r4, r9
        mov     r3, r9
        addi    r1, r1, 16
        bne     r1, r2, .check

        mov     r16, r4
        la      r1, s_sorted
        call    puts
        li      r1, N
        call    print_udec
        la      r1, s_words
        call    puts
        mov     r1, r16
        call    print_hex
        la      r1, s_first
        call    puts
        li      r1, B
        lw      r1, [r1]
        call    print_udec
        la      r1, s_middle
        call    puts
        li      r1, B + 4 * (N / 2)
        lw      r1, [r1]
        call    print_udec
        la      r1, s_last
        call    puts
        li      r1, B + 4 * (N - 1)
        lw      r1, [r1]
        call    print_udec
        call    newline
        lw      lr, [sp]
        addi    sp, sp, 4
        ret

.bad:   la      r1, s_bad
        call    puts
        lw      lr, [sp]
        addi    sp, sp, 4
        ret

; prefix: turn the byte counts at r1 .. r2 into pointers, starting at r3
prefix: lw      r4, [r1]
        lw      r5, [r1 + 4]
        lw      r6, [r1 + 8]
        lw      r7, [r1 + 12]
        sw      r3, [r1]
        add     r3, r3, r4
        sw      r3, [r1 + 4]
        add     r3, r3, r5
        sw      r3, [r1 + 8]
        add     r3, r3, r6
        sw      r3, [r1 + 12]
        add     r3, r3, r7
        addi    r1, r1, 16
        bne     r1, r2, prefix
        ret

; pass0, pass1, pass2: scatter the words r1 .. r2 by digit 0, 1, 2.
; Four words a round; the slot after each pointer load is filled with
; digit work for a later word, so nothing stalls. The pointer loads stay
; in order behind the previous pointer store, since two words can share
; a digit.
pass0:  lw      r3, [r1]
        lw      r4, [r1 + 4]
        lw      r5, [r1 + 8]
        lw      r6, [r1 + 12]
        slli    r7, r3, 2
        andi    r7, r7, 0x1FFC
        slli    r8, r4, 2
        lw      r11, [r7 + T0]
        andi    r8, r8, 0x1FFC
        sw      r3, [r11]
        addi    r11, r11, 4
        sw      r11, [r7 + T0]
        lw      r12, [r8 + T0]
        slli    r9, r5, 2
        sw      r4, [r12]
        addi    r12, r12, 4
        sw      r12, [r8 + T0]
        andi    r9, r9, 0x1FFC
        lw      r11, [r9 + T0]
        slli    r10, r6, 2
        sw      r5, [r11]
        addi    r11, r11, 4
        sw      r11, [r9 + T0]
        andi    r10, r10, 0x1FFC
        lw      r12, [r10 + T0]
        addi    r1, r1, 16
        sw      r6, [r12]
        addi    r12, r12, 4
        sw      r12, [r10 + T0]
        bne     r1, r2, pass0
        ret

pass1:  lw      r3, [r1]
        lw      r4, [r1 + 4]
        lw      r5, [r1 + 8]
        lw      r6, [r1 + 12]
        srli    r7, r3, 9
        andi    r7, r7, 0x1FFC
        srli    r8, r4, 9
        lw      r11, [r7 + T1]
        andi    r8, r8, 0x1FFC
        sw      r3, [r11]
        addi    r11, r11, 4
        sw      r11, [r7 + T1]
        lw      r12, [r8 + T1]
        srli    r9, r5, 9
        sw      r4, [r12]
        addi    r12, r12, 4
        sw      r12, [r8 + T1]
        andi    r9, r9, 0x1FFC
        lw      r11, [r9 + T1]
        srli    r10, r6, 9
        sw      r5, [r11]
        addi    r11, r11, 4
        sw      r11, [r9 + T1]
        andi    r10, r10, 0x1FFC
        lw      r12, [r10 + T1]
        addi    r1, r1, 16
        sw      r6, [r12]
        addi    r12, r12, 4
        sw      r12, [r10 + T1]
        bne     r1, r2, pass1
        ret

pass2:  lw      r3, [r1]
        lw      r4, [r1 + 4]
        lw      r5, [r1 + 8]
        lw      r6, [r1 + 12]
        srli    r7, r3, 20
        andi    r7, r7, 0xFFC
        srli    r8, r4, 20
        lw      r11, [r7 + T2]
        andi    r8, r8, 0xFFC
        sw      r3, [r11]
        addi    r11, r11, 4
        sw      r11, [r7 + T2]
        lw      r12, [r8 + T2]
        srli    r9, r5, 20
        sw      r4, [r12]
        addi    r12, r12, 4
        sw      r12, [r8 + T2]
        andi    r9, r9, 0xFFC
        lw      r11, [r9 + T2]
        srli    r10, r6, 20
        sw      r5, [r11]
        addi    r11, r11, 4
        sw      r11, [r9 + T2]
        andi    r10, r10, 0xFFC
        lw      r12, [r10 + T2]
        addi    r1, r1, 16
        sw      r6, [r12]
        addi    r12, r12, 4
        sw      r12, [r10 + T2]
        bne     r1, r2, pass2
        ret

        .data
s_sorted: .asciz "sorted "
s_words:  .asciz " words\nchecksum "
s_first:  .asciz "\nfirst "
s_middle: .asciz " middle "
s_last:   .asciz " last "
s_bad:    .asciz "NOT SORTED\n"
