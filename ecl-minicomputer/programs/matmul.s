; matmul: C = A B for 48 x 48 integer matrices, with MULT/MADD.
;
; A and B hold LCG values in -1000..1000 (A the first 2304, B the next
; 2304, row by row). Prints the sum of C, a rotate/xor fold of C in row
; order and three elements; see programs/ref/matmul.py.
;
; A MADD occupies the multiplier for 8 cycles, so with MADD alone an
; element of C takes 48 x 8 = 384 cycles while the loads use only 2 of
; the 7 issue slots in each MADD's shadow. This version fills the other
; 5 by doing 18 of the 48 products of each element without the
; multiplier, by quarter squares:
;
;     a b = Q(a + b) - Q(a - b),   Q(x) = floor(x^2 / 4) from a table
;
; (exact for integers: a + b and a - b have the same parity). That costs
; 8 instructions a product (2 loads, ADD, SUB, 2 indexed table loads,
; ADD, SUB) against the multiplier's 8 cycles, so 30 MADDs plus 18
; table products fill the 240 cycles of the 30 MADDs almost exactly:
; ~244 cycles an element instead of ~385.
;
; - The matrices are stored times 4, so a + b is directly the byte
;   offset into the word table, and the MADDs sum 16 a b: MFHL ..., 4
;   divides it back out.
; - The dot product is unrolled 48 times with constant offsets (A along
;   a row at +4k, B down a column at +192k): no pointer arithmetic.
; - The table products run as a software pipeline, two products in
;   flight, so no load result is used by the next instruction.
; - Storing and folding an element happen under the next element's
;   multiplies: its MFHL comes right before the next element's MULT.
; The schedule was generated; MADD k = 0..29, table products k = 30..47.
        .include "lib/start.s"
        .include "lib/print.s"

N       = 48
SEED    = 1
LCG_A   = 1664525
LCG_C   = 1013904223
A       = 0x1000                ; 48 x 48 words each, row by row, times 4
B       = A + 4 * N * N
C       = B + 4 * N * N + 4     ; with a dummy word in front of it
QT      = 0x10000 + 4 * 2000    ; centre of the table Q(x), x = -2000..2000

main:   addi    sp, sp, -48
        sw      lr, [sp + 44]
        sw      r16, [sp + 40]
        sw      r20, [sp + 36]
        sw      r21, [sp + 32]
        sw      r22, [sp + 28]
        sw      r23, [sp + 24]
        sw      r24, [sp + 20]
        sw      r25, [sp + 16]
        sw      r26, [sp + 12]
        sw      r27, [sp + 8]

; ---- A and B: value = ((x >> 16) * 2001 >> 16) - 1000 ----------------------
; 2001h = 2048h - 48h + h with shifts, under the next LCG multiply.

        li      r1, SEED
        li      r2, LCG_A
        li      r3, LCG_C
        li      r4, A
        li      r5, 2 * N * N
        multu   r1, r2
.gen:   mflo    r1
        add     r1, r1, r3              ; x
        multu   r1, r2                  ; product for the next x
        srli    r6, r1, 16              ; h
        slli    r7, r6, 1
        add     r7, r7, r6
        slli    r7, r7, 4               ; 48h
        slli    r8, r6, 11
        sub     r8, r8, r7
        add     r8, r8, r6              ; 2001h
        srli    r8, r8, 16
        addi    r8, r8, -1000
        slli    r8, r8, 2               ; stored times 4
        sw      r8, [r4]
        addi    r4, r4, 4
        dbnz    r5, .gen

; ---- the table Q(x) = floor(x^2 / 4), Q(x + 1) = Q(x) + (x + 1) / 2 -------

        li      r1, QT                  ; &Q(x)
        li      r2, QT                  ; &Q(-x)
        li      r3, 0                   ; x
        li      r4, 0                   ; Q(x)
        li      r5, 2001
.qt:    sw      r4, [r1]
        sw      r4, [r2]
        addi    r3, r3, 1
        srli    r6, r3, 1
        add     r4, r4, r6
        addi    r1, r1, 4
        addi    r2, r2, -4
        dbnz    r5, .qt

; ---- C = A B ------------------------------------------------------------------
; r20 row of A, r21 column of B, r22 where the previous element goes,
; r23/r24 loop counts, r25 fold, r26 sum, r13 table centre;
; multiplier products: r1-r4 operands, r5 result;
; table products: r6/r7 operands, r8/r9 sum/difference, r10/r11 Q values,
; r12 their running total

        li      r20, A
        li      r22, C - 4
        li      r25, 0
        li      r26, 0
        li      r13, QT
        li      r12, 0                  ; "previous element" of the first: 0
        mthi    r0
        mtlo    r0
        li      r24, N
.i:     li      r21, B
        li      r23, N
; One element per round. After each MULT/MADD come exactly 7 other
; instructions, which is what its 8 cycles allow: the 2 loads for the
; MADD after next, then 5 from this stream:
;   - the previous element: add its table part (r12) to its MADD part
;     (r5), store it, fold it into the checksum and the sum;
;   - 18 table products (k = 30..47) as a two-stage software pipeline,
;     8 instructions a step: load a and b of product g+1, look up
;     Q(a+b) and Q(a-b) of product g, form a+b and a-b of g+1, add and
;     subtract the Q values of g into r12.
; The last MADD's shadow holds the end of the stream, the loop control
; and the first loads of the next element.
.j:     lw      r1, [r20 + 0]
        lw      r2, [r21 + 0]
        lw      r3, [r20 + 4]
        lw      r4, [r21 + 192]
        mfhl    r5, 4                   ; previous element: multiplier part / 16
        mult    r1, r2
        lw      r1, [r20 + 8]
        lw      r2, [r21 + 384]
        lw      r6, [r20 + 120]
        lw      r7, [r21 + 5760]
        add     r5, r5, r12
        sw      r5, [r22]
        add     r8, r6, r7
        madd    r3, r4
        lw      r3, [r20 + 12]
        lw      r4, [r21 + 576]
        sub     r9, r6, r7
        rori    r25, r25, 27
        xor     r25, r25, r5
        add     r26, r26, r5
        addi    r22, r22, 4
        madd    r1, r2
        lw      r1, [r20 + 16]
        lw      r2, [r21 + 768]
        lw      r6, [r20 + 124]
        lw      r7, [r21 + 5952]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        madd    r3, r4
        lw      r3, [r20 + 20]
        lw      r4, [r21 + 960]
        sub     r9, r6, r7
        mov     r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 128]
        lw      r7, [r21 + 6144]
        madd    r1, r2
        lw      r1, [r20 + 24]
        lw      r2, [r21 + 1152]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        madd    r3, r4
        lw      r3, [r20 + 28]
        lw      r4, [r21 + 1344]
        sub     r12, r12, r11
        lw      r6, [r20 + 132]
        lw      r7, [r21 + 6336]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        madd    r1, r2
        lw      r1, [r20 + 32]
        lw      r2, [r21 + 1536]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 136]
        madd    r3, r4
        lw      r3, [r20 + 36]
        lw      r4, [r21 + 1728]
        lw      r7, [r21 + 6528]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        madd    r1, r2
        lw      r1, [r20 + 40]
        lw      r2, [r21 + 1920]
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 140]
        lw      r7, [r21 + 6720]
        lwx     r10, [r13 + r8]
        madd    r3, r4
        lw      r3, [r20 + 44]
        lw      r4, [r21 + 2112]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        madd    r1, r2
        lw      r1, [r20 + 48]
        lw      r2, [r21 + 2304]
        lw      r6, [r20 + 144]
        lw      r7, [r21 + 6912]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        madd    r3, r4
        lw      r3, [r20 + 52]
        lw      r4, [r21 + 2496]
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 148]
        lw      r7, [r21 + 7104]
        madd    r1, r2
        lw      r1, [r20 + 56]
        lw      r2, [r21 + 2688]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        madd    r3, r4
        lw      r3, [r20 + 60]
        lw      r4, [r21 + 2880]
        sub     r12, r12, r11
        lw      r6, [r20 + 152]
        lw      r7, [r21 + 7296]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        madd    r1, r2
        lw      r1, [r20 + 64]
        lw      r2, [r21 + 3072]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 156]
        madd    r3, r4
        lw      r3, [r20 + 68]
        lw      r4, [r21 + 3264]
        lw      r7, [r21 + 7488]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        madd    r1, r2
        lw      r1, [r20 + 72]
        lw      r2, [r21 + 3456]
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 160]
        lw      r7, [r21 + 7680]
        lwx     r10, [r13 + r8]
        madd    r3, r4
        lw      r3, [r20 + 76]
        lw      r4, [r21 + 3648]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        madd    r1, r2
        lw      r1, [r20 + 80]
        lw      r2, [r21 + 3840]
        lw      r6, [r20 + 164]
        lw      r7, [r21 + 7872]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        madd    r3, r4
        lw      r3, [r20 + 84]
        lw      r4, [r21 + 4032]
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 168]
        lw      r7, [r21 + 8064]
        madd    r1, r2
        lw      r1, [r20 + 88]
        lw      r2, [r21 + 4224]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        madd    r3, r4
        lw      r3, [r20 + 92]
        lw      r4, [r21 + 4416]
        sub     r12, r12, r11
        lw      r6, [r20 + 172]
        lw      r7, [r21 + 8256]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        madd    r1, r2
        lw      r1, [r20 + 96]
        lw      r2, [r21 + 4608]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 176]
        madd    r3, r4
        lw      r3, [r20 + 100]
        lw      r4, [r21 + 4800]
        lw      r7, [r21 + 8448]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        madd    r1, r2
        lw      r1, [r20 + 104]
        lw      r2, [r21 + 4992]
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 180]
        lw      r7, [r21 + 8640]
        lwx     r10, [r13 + r8]
        madd    r3, r4
        lw      r3, [r20 + 108]
        lw      r4, [r21 + 5184]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        madd    r1, r2
        lw      r1, [r20 + 112]
        lw      r2, [r21 + 5376]
        lw      r6, [r20 + 184]
        lw      r7, [r21 + 8832]
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        madd    r3, r4
        lw      r3, [r20 + 116]
        lw      r4, [r21 + 5568]
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        lw      r6, [r20 + 188]
        lw      r7, [r21 + 9024]
        madd    r1, r2
        lwx     r10, [r13 + r8]
        lwx     r11, [r13 + r9]
        add     r8, r6, r7
        sub     r9, r6, r7
        add     r12, r12, r10
        sub     r12, r12, r11
        lwx     r10, [r13 + r8]
        madd    r3, r4
        lwx     r11, [r13 + r9]
        add     r12, r12, r10
        sub     r12, r12, r11
        addi    r21, r21, 4             ; next column
        dbnz    r23, .j
        addi    r20, r20, 4 * N         ; next row
        dbnz    r24, .i
        mfhl    r5, 4                   ; the last element
        add     r5, r5, r12
        sw      r5, [r22]
        rori    r25, r25, 27
        xor     r25, r25, r5
        add     r26, r26, r5

; ---- output -------------------------------------------------------------------

        la      r1, s_head
        call    puts
        mov     r1, r26
        call    print_dec
        la      r1, s_fold
        call    puts
        mov     r1, r25
        call    print_hex
        la      r1, s_c00
        call    puts
        lw      r1, [C]
        call    print_dec
        la      r1, s_c1731
        call    puts
        lw      r1, [C + 4 * (17 * N + 31)]
        call    print_dec
        la      r1, s_c4747
        call    puts
        lw      r1, [C + 4 * (47 * N + 47)]
        call    print_dec
        call    newline

        lw      r27, [sp + 8]
        lw      r26, [sp + 12]
        lw      r25, [sp + 16]
        lw      r24, [sp + 20]
        lw      r23, [sp + 24]
        lw      r22, [sp + 28]
        lw      r21, [sp + 32]
        lw      r20, [sp + 36]
        lw      r16, [sp + 40]
        lw      lr, [sp + 44]
        addi    sp, sp, 48
        ret

        .data
s_head:  .asciz "C = A B, 48 x 48\nsum "
s_fold:  .asciz "\nfold "
s_c00:   .asciz "\nC[0][0] "
s_c1731: .asciz " C[17][31] "
s_c4747: .asciz " C[47][47] "
