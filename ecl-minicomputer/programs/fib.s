; fib: naive doubly recursive fib(n) for n = 0..24, one value per line.
; A call/return benchmark: every fib(k) evaluation is a real call, leaves
; included (242,759 calls in all).
        .include "lib/start.s"
        .include "lib/print.s"

main:   addi    sp, sp, -12
        sw      lr, [sp + 8]
        sw      r16, [sp + 4]
        sw      r17, [sp]
        li      r16, 0                  ; n
        li      r17, 25                 ; values to print
.next:  mov     r1, r16
        li      r3, 2                   ; fib's constant
        call    fib
        call    print_udec
        call    newline
        addi    r16, r16, 1
        dbnz    r17, .next
        lw      r17, [sp]
        lw      r16, [sp + 4]
        lw      lr, [sp + 8]
        addi    sp, sp, 12
        ret

; fib: r1 = n -> r1 = fib(n). Clobbers r2; needs r3 = 2 (and keeps it).
;
; About half the calls are leaves (n < 2). The leaf test is a forward
; branch (predicted not taken), so a leaf costs a mispredict; predicting
; leaves instead would cost a taken bubble on every leaf and a mispredict
; on every inner call, which is worse at a 50/50 split. Comparing with a
; register that holds 2 saves an SLTI on every call.
;
; Inner calls keep a 3-word frame: lr, n-2 and fib(n-1). Loading n-2
; straight into r1 after saving fib(n-1) saves a move, and every load is
; at least two instructions ahead of its use.
fib:    blt     r1, r3, .leaf           ; fib(0) = 0, fib(1) = 1: r1 already
        addi    sp, sp, -12
        sw      lr, [sp + 8]
        addi    r2, r1, -2
        sw      r2, [sp + 4]            ; n-2 for the second call
        addi    r1, r1, -1
        call    fib                     ; r1 = fib(n-1)
        sw      r1, [sp]
        lw      r1, [sp + 4]
        call    fib                     ; r1 = fib(n-2)
        lw      r2, [sp]
        lw      lr, [sp + 8]
        addi    sp, sp, 12
        add     r1, r1, r2
        ret
.leaf:  ret
