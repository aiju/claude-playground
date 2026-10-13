; print: number output. All routines are leaves and use only r1-r9.

; print_udec: print r1 as an unsigned decimal number
print_udec:
        addi    sp, sp, -12             ; up to 10 digits, built backwards
        addi    r3, sp, 12              ; r3: write pointer (one past the end)
        li      r4, 0xCCCCCCCD          ; x / 10 = (x * 0xCCCCCCCD) >> 35
.digit: multu   r1, r4
        mfhi    r5
        srli    r5, r5, 3               ; r5 = r1 / 10
        sll     r6, r5, 2
        add     r6, r6, r5
        sll     r6, r6, 1               ; r6 = 10 * (r1 / 10)
        sub     r6, r1, r6              ; the digit
        addi    r6, r6, '0'
        addi    r3, r3, -1
        sb      r6, [r3]
        mov     r1, r5
        bnez    r1, .digit
        addi    r7, sp, 12
.out:   lbu     r6, [r3]
        addi    r3, r3, 1
        sb      r6, [CONSOLE]
        bne     r3, r7, .out
        addi    sp, sp, 12
        ret

; print_dec: print r1 as a signed decimal number
print_dec:
        bgez    r1, print_udec
        li      r2, '-'
        sb      r2, [CONSOLE]
        neg     r1, r1
        j       print_udec

; print_hex: print r1 as 8 hex digits
print_hex:
        li      r3, 8
.loop:  srli    r4, r1, 28
        slli    r1, r1, 4
        sltiu   r5, r4, 10
        addi    r4, r4, '0'
        bnez    r5, .num
        addi    r4, r4, 'a' - '0' - 10
.num:   sb      r4, [CONSOLE]
        dbnz    r3, .loop
        ret

; newline: print '\n'
newline:
        li      r1, '\n'
        sb      r1, [CONSOLE]
        ret

; space: print ' '
space:
        li      r1, ' '
        sb      r1, [CONSOLE]
        ret
