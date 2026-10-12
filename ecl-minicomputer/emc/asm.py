"""Assembler core: lexing, expressions, labels, sections, directives,
includes and size relaxation.

Adapted from the ttl-minicomputer assembler. The differences: two sections
with their own location counters (`.text` is instruction space, `.data` is
data space), and instructions are 32-bit words. Instructions are handed to
`emc.isa.assemble(mnemonic, operands, ctx)`, which returns a list of words
(pseudo-instructions like `li` may need two).

Size relaxation: in early passes unknown symbols evaluate to 0, so short
forms get picked. A statement that grows is marked "sticky long" and never
shrinks again, so the passes always converge.
"""

import os
import re

# --------------------------------------------------------------------------
# Errors


class AsmError(Exception):
    def __init__(self, msg, where=None):
        super().__init__(msg)
        self.msg = msg
        self.where = where

    def __str__(self):
        if self.where:
            return f"{self.where[0]}:{self.where[1]}: {self.msg}"
        return self.msg


class Unresolved(Exception):
    """Raised during evaluation when a symbol isn't defined (yet)."""


# --------------------------------------------------------------------------
# Lexer

TOKEN_RE = re.compile(r"""
    (?P<ws>\s+)
  | (?P<str>"(?:[^"\\]|\\.)*")
  | (?P<chr>'(?:[^'\\]|\\.)')
  | (?P<num>0[xX][0-9a-fA-F_]+|0[bB][01_]+|[0-9][0-9_]*)
  | (?P<id>[A-Za-z_.][A-Za-z0-9_.]*)
  | (?P<op><<|>>|[-+*/%&|^~!()\[\],#:=$])
""", re.VERBOSE)

ESCAPES = {"n": 10, "r": 13, "t": 9, "0": 0, "\\": 92, "'": 39, '"': 34, "e": 27}


def unescape(body):
    out = []
    i = 0
    while i < len(body):
        ch = body[i]
        if ch == "\\" and i + 1 < len(body):
            nxt = body[i + 1]
            if nxt == "x":
                out.append(int(body[i + 2:i + 4], 16))
                i += 4
                continue
            if nxt not in ESCAPES:
                raise AsmError(f"unknown escape \\{nxt}")
            out.append(ESCAPES[nxt])
            i += 2
        else:
            out.append(ord(ch))
            i += 1
    return out


def tokenize(text):
    """Turn one source line (comment already stripped) into tokens:
    ('num', int), ('id', str), ('str', list of bytes), ('op', str)."""
    toks = []
    pos = 0
    while pos < len(text):
        m = TOKEN_RE.match(text, pos)
        if not m:
            raise AsmError(f"unexpected character {text[pos]!r}")
        pos = m.end()
        kind = m.lastgroup
        val = m.group(kind)
        if kind == "ws":
            continue
        if kind == "num":
            v = val.replace("_", "")
            toks.append(("num", int(v, 0) if v[:2].lower() in ("0x", "0b") else int(v, 10)))
        elif kind == "chr":
            toks.append(("num", unescape(val[1:-1])[0]))
        elif kind == "str":
            toks.append(("str", unescape(val[1:-1])))
        else:
            toks.append((kind, val))
    return toks


def strip_comment(line):
    """Remove a ';' comment, respecting string and char literals."""
    quote = None
    i = 0
    while i < len(line):
        ch = line[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == ";":
            return line[:i]
        i += 1
    return line


def split_operands(toks):
    """Split a token list on top-level commas."""
    out, cur, depth = [], [], 0
    for t in toks:
        if t in (("op", "("), ("op", "[")):
            depth += 1
        elif t in (("op", ")"), ("op", "]")):
            depth -= 1
        if t == ("op", ",") and depth == 0:
            out.append(cur)
            cur = []
        else:
            cur.append(t)
    if cur or out:
        out.append(cur)
    return out


# --------------------------------------------------------------------------
# Expressions: small tuple trees ('num', v), ('sym', name), ('pc',),
# ('un', op, x), ('bin', op, a, b), ('call', fname, x).

BINARY_PREC = [
    ["|"], ["^"], ["&"], ["<<", ">>"], ["+", "-"], ["*", "/", "%"],
]

FUNCS = {
    "lo16": lambda x: x & 0xFFFF,
    "hi16": lambda x: (x >> 16) & 0xFFFF,
}


class ExprParser:
    def __init__(self, toks, scope):
        self.toks = toks
        self.i = 0
        self.scope = scope

    def peek(self):
        return self.toks[self.i] if self.i < len(self.toks) else (None, None)

    def take(self):
        t = self.peek()
        self.i += 1
        return t

    def parse(self):
        e = self.binary(0)
        if self.i != len(self.toks):
            raise AsmError(f"junk after expression: {self.toks[self.i][1]!r}")
        return e

    def binary(self, level):
        if level == len(BINARY_PREC):
            return self.unary()
        left = self.binary(level + 1)
        while self.peek()[0] == "op" and self.peek()[1] in BINARY_PREC[level]:
            op = self.take()[1]
            right = self.binary(level + 1)
            left = ("bin", op, left, right)
        return left

    def unary(self):
        k, v = self.peek()
        if k == "op" and v in ("-", "~", "+", "!"):
            self.take()
            return ("un", v, self.unary())
        return self.atom()

    def atom(self):
        k, v = self.take()
        if k == "num":
            return ("num", v)
        if k == "op" and v == "$":
            return ("pc",)
        if k == "op" and v == "(":
            e = self.binary(0)
            if self.take() != ("op", ")"):
                raise AsmError("missing ')'")
            return e
        if k == "id":
            if v.lower() in FUNCS and self.peek() == ("op", "("):
                self.take()
                e = self.binary(0)
                if self.take() != ("op", ")"):
                    raise AsmError("missing ')'")
                return ("call", v.lower(), e)
            return ("sym", mangle(v, self.scope))
        if k is None:
            raise AsmError("expression expected")
        raise AsmError(f"unexpected {v!r} in expression")


def mangle(name, scope):
    if name.startswith(".") and len(name) > 1:
        return (scope or "") + name
    return name


def parse_expr(toks, scope):
    return ExprParser(toks, scope).parse()


def eval_expr(e, symbols, pc):
    kind = e[0]
    if kind == "num":
        return e[1]
    if kind == "pc":
        return pc
    if kind == "sym":
        if e[1] not in symbols:
            raise Unresolved(e[1])
        return symbols[e[1]]
    if kind == "un":
        x = eval_expr(e[2], symbols, pc)
        return {"-": -x, "~": ~x, "+": x, "!": int(not x)}[e[1]]
    if kind == "call":
        return FUNCS[e[1]](eval_expr(e[2], symbols, pc))
    a = eval_expr(e[2], symbols, pc)
    b = eval_expr(e[3], symbols, pc)
    op = e[1]
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op in ("/", "%"):
        if b == 0:
            raise AsmError("division by zero")
        q = abs(a) // abs(b) * (1 if (a < 0) == (b < 0) else -1)
        return q if op == "/" else a - q * b
    if op == "<<":
        return a << b
    if op == ">>":
        return a >> b
    if op == "&":
        return a & b
    if op == "|":
        return a | b
    if op == "^":
        return a ^ b
    raise AsmError(f"bad operator {op}")


# --------------------------------------------------------------------------
# Operands handed to the ISA hook


class Reg:
    __slots__ = ("n", "name")

    def __init__(self, n, name):
        self.n, self.name = n, name

    def __repr__(self):
        return f"Reg({self.name})"


class Mem:
    """'[base + disp]' or '[base + index]'. base/index are Regs or None,
    disp an expression or None."""
    __slots__ = ("base", "index", "disp")

    def __init__(self, base, index, disp):
        self.base, self.index, self.disp = base, index, disp


class Expr:
    """A bare expression (immediate, branch target); `imm` is True if it
    was written with '#'."""
    __slots__ = ("expr", "imm")

    def __init__(self, expr, imm=False):
        self.expr, self.imm = expr, imm


class Str:
    __slots__ = ("data",)

    def __init__(self, data):
        self.data = data


# --------------------------------------------------------------------------
# Assembly context passed to the ISA hook


class Ctx:
    def __init__(self, asm, stmt):
        self.asm = asm
        self.stmt = stmt
        self.pc = stmt.addr

    @property
    def final(self):
        return self.asm.final_pass

    @property
    def min_words(self):
        """Once a statement has grown it may never shrink again (so the
        passes converge): pseudo-instructions with several sizes pick a
        form of at least this many words."""
        return self.stmt.size // 4 if self.stmt.sticky_long else 0

    def value(self, expr):
        """Evaluate an expression. Returns (value, known)."""
        try:
            return eval_expr(expr, self.asm.symbols, self.pc), True
        except Unresolved as u:
            if self.asm.final_pass:
                raise AsmError(f"undefined symbol {u.args[0]}")
            return 0, False

    def section_of(self, expr):
        """'text', 'data' or None (a plain number) for a symbol expression."""
        if expr[0] == "sym":
            return self.asm.sym_section.get(expr[1])
        return None

    def error(self, msg):
        raise AsmError(msg)

    def warn(self, msg):
        if self.asm.final_pass:
            self.asm.warnings.append(f"{self.stmt.where[0]}:{self.stmt.where[1]}: {msg}")


# --------------------------------------------------------------------------
# Statements


class Stmt:
    __slots__ = ("where", "text", "kind", "name", "operands", "addr", "size",
                 "words", "data", "sticky_long", "scope", "label", "section")

    def __init__(self, where, text):
        self.where = where
        self.text = text
        self.kind = None      # 'insn', 'dir', 'label', 'section'
        self.name = None
        self.operands = []
        self.addr = 0
        self.size = 0
        self.words = []
        self.data = b""
        self.sticky_long = False
        self.scope = None
        self.label = None
        self.section = "text"


SECTIONS = ("text", "data")


class Assembler:
    def __init__(self, isa):
        self.isa = isa
        self.symbols = {}
        self.sym_section = {}
        self.final_pass = False
        self.warnings = []
        self.stmts = []
        self.reg_names = {k.lower(): v for k, v in isa.REGISTERS.items()}
        self.owner = {}
        self.section = "text"

    # ---- parsing ---------------------------------------------------------

    def load(self, path, text=None, seen=None):
        seen = seen if seen is not None else set()
        path = os.path.abspath(path)
        if path in seen:
            raise AsmError(f"recursive include of {path}")
        seen = seen | {path}
        if text is None:
            with open(path) as f:
                text = f.read()
        scope = self.stmts[-1].scope if self.stmts else None
        for lineno, raw in enumerate(text.splitlines(), 1):
            rel = os.path.relpath(path)
            where = (path if rel.startswith("..") else rel, lineno)
            try:
                scope = self.parse_line(raw, where, scope, path, seen)
            except AsmError as e:
                e.where = e.where or where
                raise

    def new_stmt(self, where, raw, scope):
        st = Stmt(where, raw)
        st.scope = scope
        st.section = self.section
        self.stmts.append(st)
        return st

    def parse_line(self, raw, where, scope, path, seen):
        line = strip_comment(raw)
        toks = tokenize(line)
        if not toks:
            return scope
        while len(toks) >= 2 and toks[0][0] == "id" and toks[1] == ("op", ":"):
            name = toks[0][1]
            if not name.startswith("."):
                scope = name
            st = self.new_stmt(where, raw, scope)
            st.kind = "label"
            st.label = mangle(name, scope)
            toks = toks[2:]
        if not toks:
            return scope
        if len(toks) >= 2 and toks[0][0] == "id" and toks[1] == ("op", "="):
            st = self.new_stmt(where, raw, scope)
            st.kind = "dir"
            st.name = ".equ"
            st.operands = [[toks[0]], toks[2:]]
            return scope
        if toks[0][0] != "id":
            raise AsmError(f"expected mnemonic or directive, got {toks[0][1]!r}")
        name = toks[0][1].lower()
        ops = split_operands(toks[1:])
        if name == ".include":
            if len(ops) != 1 or len(ops[0]) != 1 or ops[0][0][0] != "str":
                raise AsmError(".include needs a quoted file name")
            inc = bytes(ops[0][0][1]).decode()
            self.load(os.path.join(os.path.dirname(path), inc), seen=seen)
            return self.stmts[-1].scope if self.stmts else scope
        if name in (".text", ".data"):
            if ops:
                raise AsmError(f"{name} takes no operands")
            self.section = name[1:]
            return scope
        st = self.new_stmt(where, raw, scope)
        st.name = name
        if name.startswith("."):
            st.kind = "dir"
            st.operands = ops
        else:
            st.kind = "insn"
            st.operands = [self.parse_operand(o, scope) for o in ops]
        return scope

    def reg(self, tok):
        if tok[0] == "id" and tok[1].lower() in self.reg_names:
            return Reg(self.reg_names[tok[1].lower()], tok[1].lower())
        return None

    def parse_operand(self, toks, scope):
        if not toks:
            raise AsmError("empty operand")
        if len(toks) == 1 and self.reg(toks[0]):
            return self.reg(toks[0])
        if toks[0] == ("op", "#"):
            return Expr(parse_expr(toks[1:], scope), imm=True)
        if toks[0] == ("op", "["):
            if toks[-1] != ("op", "]"):
                raise AsmError("missing ']'")
            return self.parse_mem(toks[1:-1], scope)
        if len(toks) == 1 and toks[0][0] == "str":
            return Str(toks[0][1])
        for t in toks:
            if self.reg(t):
                raise AsmError(f"unexpected register in expression: {t[1]}")
        return Expr(parse_expr(toks, scope))

    def parse_mem(self, inner, scope):
        """Inside of [...]: terms joined by + and -, each a register or part
        of the displacement expression."""
        terms, cur, depth = [], [], 0
        sign = "+"
        for t in inner:
            if t == ("op", "("):
                depth += 1
            elif t == ("op", ")"):
                depth -= 1
            if depth == 0 and t in (("op", "+"), ("op", "-")) and cur:
                terms.append((sign, cur))
                sign, cur = t[1], []
            else:
                cur.append(t)
        if cur:
            terms.append((sign, cur))
        regs, disp = [], []
        for sign, tt in terms:
            r = self.reg(tt[0])
            if len(tt) == 1 and r:
                if sign != "+":
                    raise AsmError("a register can't be subtracted")
                regs.append(r)
                continue
            for t in tt:
                if self.reg(t):
                    raise AsmError(f"unexpected register in address: {t[1]}")
            if disp or sign == "-":
                disp.append(("op", sign))
            disp.extend(tt)
        if len(regs) > 2:
            raise AsmError("at most two registers in an address")
        if len(regs) == 2 and disp:
            raise AsmError("[reg + reg] can't have a displacement")
        base = regs[0] if regs else None
        index = regs[1] if len(regs) == 2 else None
        return Mem(base, index, parse_expr(disp, scope) if disp else None)

    # ---- passes ----------------------------------------------------------

    def dir_values(self, st, ops, pc):
        out = []
        for o in ops:
            if len(o) == 1 and o[0][0] == "str":
                out.append(bytes(o[0][1]))
            else:
                e = parse_expr(o, st.scope)
                try:
                    out.append(eval_expr(e, self.symbols, pc))
                except Unresolved as u:
                    if self.final_pass:
                        raise AsmError(f"undefined symbol {u.args[0]}")
                    out.append(0)
        return out

    def run_directive(self, st, pc):
        n = st.name
        ops = st.operands
        st.data = b""
        if n == ".equ":
            name = mangle(ops[0][0][1], st.scope)
            self.define(name, st)
            e = parse_expr(ops[1], st.scope)
            try:
                self.symbols[name] = eval_expr(e, self.symbols, pc)
                self.sym_section[name] = None
            except Unresolved as u:
                if self.final_pass:
                    raise AsmError(f"undefined symbol {u.args[0]}")
            return pc
        if n == ".org":
            (v,) = self.dir_values(st, ops, pc)
            if v < pc and self.final_pass:
                raise AsmError(".org moves backwards")
            if st.section == "text" and v % 4:
                raise AsmError(".org in .text must be a multiple of 4")
            return v
        if n == ".align":
            (v,) = self.dir_values(st, ops, pc)
            pad = (-pc) % v
            if st.section == "text":
                if pad % 4:
                    raise AsmError(".align in .text must be a multiple of 4")
                st.words = [self.isa.NOP] * (pad // 4)
                st.size = pad
            else:
                st.data = bytes(pad)
            return pc + pad
        if st.section == "text" and n != ".word":
            raise AsmError(f"{n} isn't allowed in .text (instruction memory holds only instructions)")
        if n in (".space", ".fill"):
            vals = self.dir_values(st, ops, pc)
            count = vals[0]
            fill = vals[1] if len(vals) > 1 else 0
            st.data = bytes([fill & 0xFF]) * count
            return pc + count
        if n == ".byte":
            buf = bytearray()
            for v in self.dir_values(st, ops, pc):
                if isinstance(v, bytes):
                    buf += v
                else:
                    if self.final_pass and not -128 <= v <= 255:
                        raise AsmError(f".byte value {v} out of range")
                    buf.append(v & 0xFF)
            st.data = bytes(buf)
            return pc + len(buf)
        if n in (".ascii", ".asciz"):
            buf = bytearray()
            for v in self.dir_values(st, ops, pc):
                if not isinstance(v, bytes):
                    raise AsmError(f"{n} needs strings")
                buf += v
            if n == ".asciz":
                buf.append(0)
            st.data = bytes(buf)
            return pc + len(buf)
        if n in (".word", ".half"):
            size = 4 if n == ".word" else 2
            if pc % size:
                raise AsmError(f"{n} at an address that isn't a multiple of {size} (missing .align?)")
            bits = 8 * size
            vals = []
            for v in self.dir_values(st, ops, pc):
                if isinstance(v, bytes):
                    raise AsmError(f"{n} doesn't take strings")
                if self.final_pass and not -(1 << (bits - 1)) <= v < (1 << bits):
                    raise AsmError(f"{n} value {v} out of range")
                vals.append(v & ((1 << bits) - 1))
            if st.section == "text":
                st.words = vals
                st.size = 4 * len(vals)
            else:
                st.data = b"".join(v.to_bytes(size, "little") for v in vals)
            return pc + size * len(vals)
        if n in (".global", ".globl", ".title"):
            return pc
        raise AsmError(f"unknown directive {n}")

    def define(self, sym, st):
        prev = self.owner.setdefault(sym, st)
        if prev is not st:
            raise AsmError(f"{sym} is already defined at {prev.where[0]}:{prev.where[1]}")

    def one_pass(self):
        pcs = {s: 0 for s in SECTIONS}
        changed = False
        for st in self.stmts:
            sec = st.section
            pc = pcs[sec]
            try:
                st.addr = pc
                if st.kind == "label":
                    self.define(st.label, st)
                    if self.symbols.get(st.label) != pc:
                        changed = True
                    self.symbols[st.label] = pc
                    self.sym_section[st.label] = sec
                elif st.kind == "dir":
                    pc = self.run_directive(st, pc)
                    if st.name == ".org":
                        st.addr = pc
                else:
                    if sec != "text":
                        raise AsmError("instructions belong in .text")
                    if pc % 4:
                        raise AsmError("instruction at an address that isn't a multiple of 4")
                    words = self.isa.assemble(st.name, st.operands, Ctx(self, st))
                    if len(words) * 4 < st.size and not self.final_pass:
                        st.sticky_long = True
                        words = self.isa.assemble(st.name, st.operands, Ctx(self, st))
                    if len(words) * 4 != st.size:
                        if st.size:
                            st.sticky_long = True
                        changed = True
                    st.size = len(words) * 4
                    st.words = words
                    pc += st.size
                limit = self.isa.MEM_SIZE[sec]
                if pc > limit:
                    raise AsmError(f".{sec} runs past the end of its memory ({limit:#x} bytes)")
                pcs[sec] = pc
            except AsmError as e:
                e.where = e.where or st.where
                raise
        return changed

    def assemble(self):
        for _ in range(20):
            if not self.one_pass():
                break
        else:
            raise AsmError("assembly did not converge")
        self.final_pass = True
        self.one_pass()
        return self.image()

    def image(self):
        text, data = {}, {}
        for st in self.stmts:
            if st.kind in ("insn", "dir") and st.words:
                for i, w in enumerate(st.words):
                    text[(st.addr >> 2) + i] = w
            elif st.kind == "dir" and st.data:
                for i, b in enumerate(st.data):
                    data[st.addr + i] = b
        return Image(text, data, self.symbols, self.sym_section, self.stmts, self.isa)


class Image:
    """Result of assembly: instruction words by word index, data bytes by
    address, symbols and a listing."""

    def __init__(self, text, data, symbols, sym_section, stmts, isa):
        self.text = text
        self.data = data
        self.symbols = symbols
        self.sym_section = sym_section
        self.stmts = stmts
        self.isa = isa
        self.warnings = []

    def text_words(self):
        n = max(self.text) + 1 if self.text else 0
        return [self.text.get(i, 0) for i in range(n)]

    def code_bytes(self):
        return sum(st.size for st in self.stmts if st.kind == "insn")

    def data_extent(self):
        return (min(self.data), max(self.data) + 1) if self.data else (0, 0)

    def listing(self):
        lines = []
        for st in self.stmts:
            text = st.text.rstrip()
            if st.kind == "insn":
                first = True
                for i, w in enumerate(st.words):
                    a = st.addr + 4 * i
                    dis = self.isa.disassemble(w, a)
                    src = text if first else ""
                    lines.append(f"T {a:06X}  {w:08X}  {dis:<28} {src}")
                    first = False
            elif st.kind == "dir" and (st.data or st.words):
                if st.words:
                    lines.append(f"T {st.addr:06X}  {st.words[0]:08X}  {'':<28} {text}")
                else:
                    d = st.data[:4]
                    hexb = " ".join(f"{b:02X}" for b in d) + (" …" if len(st.data) > 4 else "")
                    lines.append(f"D {st.addr:06X}  {hexb:<38} {text}")
            elif st.kind == "label":
                pass
            else:
                lines.append(f"{'':48} {text}")
        return "\n".join(lines) + "\n"


def assemble_file(isa, path):
    a = Assembler(isa)
    a.load(path)
    img = a.assemble()
    img.warnings = a.warnings
    return img


def assemble_text(isa, text, name="<string>"):
    a = Assembler(isa)
    a.load(name, text=text)
    img = a.assemble()
    img.warnings = a.warnings
    return img
