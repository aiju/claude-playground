; hello: print a string, then count down from 9 with DBNZ
        .include "lib/start.s"

main:   addi    sp, sp, -8
        sw      lr, [sp + 4]
        sw      r16, [sp]
        la      r1, msg
        call    puts
        li      r16, 9
.loop:  addi    r1, r16, '0'
        call    putc
        dbnz    r16, .loop
        li      r1, '\n'
        call    putc
        lw      r16, [sp]
        lw      lr, [sp + 4]
        addi    sp, sp, 8
        ret

        .data
msg:    .asciz  "Hello from the ECL machine!\n"
