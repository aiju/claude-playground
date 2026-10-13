; start: set up the stack, call main, halt.
        .text
_start: li      sp, STACK_TOP
        call    main
        halt

STACK_TOP = 0x200000

        .include "console.s"
