# Xerox Alto software ecosystem (1973 to about 1983): OS, languages, applications, screens

Source-access note for the report writer: the network proxy blocked most sites (Wikipedia, computerhistory.org, bitsavers, righto.com, nomodes.com, DigiBarn, ACM DL). I read these **primary sources in full**: Lampson's 1986 Alto software paper (MSR PDF), the **October 1976 Alto User's Handbook** (MSR scan: Non-programmer's Guide, Bravo manual, font samples, Bravo 6.0 summary sheet), Alan Kay's *Early History of Smalltalk* (1993; read from its GitHub mirror), and Larry Tesler's 2012 *Personal History of Modeless Text Editing* (read from a GitHub mirror). I also read the ContrAlto emulator readme, the Maze War VR readme, and a 2026 survey of the CHM archive's file listings. Findings marked "(search snippet)" come only from search-engine summaries of Wikipedia, CHM and similar pages. Treat them as lower confidence.

---

## 1. Alto OS: design, junta, Executive, file system, Scavenger, Swat, boot

### Takeaway
The Alto OS was a small, deliberately "open" BCPL operating system. Butler Lampson designed it and started it in mid-1973. Any program could throw away parts of it (the "junta") and take over the whole 128 KB machine. Its most durable ideas were the robust disk file system, in which every disk block carries a label saying which file and page it belongs to, and the Scavenger, which rebuilds a damaged disk in about a minute. Users saw it through the Executive, a command line with a ">" prompt.

### Cited Findings
- The Alto software effort began in mid-1973. Most of the system was built 1973–1978 and it was considerably extended 1978–1983. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- The OS derives from Stoy and Strachey's OS6 (Oxford). It provides a disk file and directory system, a keyboard handler, a teletype simulator for the screen, a stream abstraction for I/O, a program loader and a free-storage allocator. It has no multiple processes, virtual memory or protection, although software packages later added the first two, "several times, in fact". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- It is written entirely in BCPL. Lampson designed it and built it with Gene McDaniel, Bob Sproull and David Boggs. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- Lampson names three distinctive features. The first is **open design**: any part can be replaced by a client program. The second is **world-swap**, which saves the entire machine state to a disk file and restores another. It takes about 2 seconds and is used for bootstrapping, checkpointing, debugging (switching between a program and the debugger) and switching activities. The third is a **file system** that runs the disk at full speed and uses distributed redundancy for reliability. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Junta**: at startup all OS packages are loaded, but a "junta" procedure can remove any number of them to reclaim their memory, so a program can take over nearly the whole machine. Programs can then re-include any subset, supply their own version, or do without. In Lampson's words, the system offers services but preempts none of the machine's resources. Optional packages add cooperative processes, Pup internet datagrams and byte streams, and overlays. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **File system with labels**: a file is a chain of disk blocks with forward and backward pointers. It transfers consecutive blocks at the full disk rate of 1 Mbit/s. Each block's header "label" holds the file identifier and page number, which is checked on every read and write. Disk addresses are therefore only *hints*, and a wrong address is caught by the label check. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Scavenger**: written by Jim Morris, it checks or restores a whole Alto file system in about a minute and ordinary users ran it routinely. Lampson says losing data other than physically damaged bits was "essentially unheard of". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- Hierarchical directories and file versions were added late and saw little use. A directory is just an ordinary file. The disk format and network protocols set by the BCPL OS did not change after 1976. They were the only things all language environments (BCPL, Mesa, Smalltalk, Lisp) had in common. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Executive**: it processes command lines and invokes other programs. Lampson likens it to the Unix shell but with far more primitive programming facilities. To the OS it is just the program run at boot; to the user it is the visible form of the OS. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Executive screen and commands (1976 handbook)**: after a boot the screen reports the state of the machine at the top, then prints ">" about halfway down. The display has a small area of **six lines at the top** and a large area of **about 20 lines in the middle**. Between them sit a clock and status: Executive and OS versions, the disk's owner and name, the Alto's serial number, and free disk pages. Examples in the handbook:
  - A banner shaped like `--- OS Version x/x --- Alto #xxx --- NoName --- Basic Non-programmer's Disk ---`.
  - Commands such as `>CopyDisk`, `>Install`, `>Type Notes`, `>Delete F1 F2`, `>Scavenger` and `>Quit`.
  - Wildcards `*` and `#`, ESC for file-name completion, `?` or TAB to list matching files, and control-X to expand patterns.
  - BS erases a character. DEL cancels the line and prints "XXX".
  - Command files are run as `>@Alpha.cm@`.
  - File names can carry version numbers, e.g. `Alto.Manual!4`.
  — [Alto User's Handbook, Oct 1976, pp. 2–7](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Swat**: Jim Morris built the Swat debugger. It understands BCPL symbols but is basically a machine-language debugger. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- To abort a program, the user holds the left SHIFT key and strikes the blank key at the lower right of the keyboard (called the **SWAT key**; on an Alto II it is in the upper right corner). Adding CTRL (CTRL+SHIFT+SWAT) drops into Swat, which the handbook calls "of no interest to non-programmers". Control-P resumes. — [Alto User's Handbook, p. 5](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Boot process (user view)**: load the disk pack, flip the drive's white switch from LOAD to RUN, and wait "about a minute" for the yellow RUN light. Then push the **small button on the back of the keyboard** near the cable, which the handbook calls "booting". — [Alto User's Handbook, pp. 2–3](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- A modern emulator readme gives a shorter spin-up: insert a 14" pack into a Diablo 31, wait about 20 seconds, press the Reset button on the back of the keyboard. In the emulator the display turns white, a cursor appears after 5–10 s, and then the Executive banner. — [ContrAlto readme](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/readme.txt)
- **Network boot key combinations**:
  - BS + the top two blank keys while pressing boot fetches the Scavenger over the Ethernet. A "fuzzy cursor" appears in the centre of the screen and the procedure takes about 15 s more.
  - BS alone plus boot gives "the dancing white square of the memory diagnostic".
  - BS + the middle blank key boots FTP over the network.
  - BS + the top blank key gets a fresh copy of the OS.
  — [Alto User's Handbook, pp. 8–10](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- The Scavenger leaves unrecognisable pages in a file called `Garbage.$` and a log in `ScavengerLog`. The handbook advises scavenging once a month. — [Alto User's Handbook, pp. 8–9](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- Later successors: Pilot, a larger OS with virtual memory, processes and a richer file system, replaced the Alto OS in the Xerox 8000/Star products. Cedar eventually went back to a simple nucleus "quite similar in spirit to the Alto OS". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- The archive includes boot files such as `NETEXEC.BOOT`, `COPYDISK`, `FTP`, `DMT` and `SCAVENGER`, and a tree `indigo/altosource` with 1,559 files, 634 of them `.bcpl` ("the OS and utility sources"). — [xerox-dorado archive survey (GitHub, 2026)](https://github.com/alanswx/xerox-dorado/blob/main/docs/xerox-systems-archive-survey.md)

### Inferences
- The junta and world-swap make a good visual metaphor. The OS lays out services like a buffet and then steps aside. Only one program owns the machine at a time, and swapping to another means writing the whole world to disk.
- The label-per-block design explains why the Scavenger could be a routine, non-expert tool. It also suggests a neat animation: each disk block wears a name tag showing its file and page.
- In Lampson's Table 1 (OCR partly garbled), the row "Alto, Exec, Dorado, design automation" lines up with Ed McCreight. That would credit McCreight with the Executive, but the alignment is uncertain.

### Gaps
- I could not verify who wrote the Executive (see the inference above) or the exact date of the first Executive.
- There is no primary description of the "NetExec" user experience beyond the key combinations above.
- Spin-up time conflicts: about 1 minute (1976 handbook, including the RUN light) versus about 20 s (ContrAlto readme).

---

## 2. Languages and environments: BCPL, Mesa, Smalltalk, Lisp / Interlisp-D

### Takeaway
The Alto was a multi-language machine. Each environment (BCPL, Mesa, Smalltalk, Lisp) had its own microcoded instruction set, compiler, debugger and even OS. They shared only the disk format and network protocols. BCPL, the direct ancestor of C, dominated until 1977. Mesa, a strongly typed modular language, took over systems work from 1976–78 and fed into Star, Cedar and Modula-2. Smalltalk-72 and -76 ran on the Alto. Lisp was too big for it and flourished only later as Interlisp-D on the Dorado and Dolphin.

### Cited Findings
- **Per-language microcode.** Each environment has its own language, instruction set, microcode emulator, compiler, loader, runtime, debugger and libraries. The BCPL instruction set is always present. A RAM holds about a thousand microinstructions, enough for one other emulator. Environments communicate only by world-swap and the file system. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **BCPL at PARC.** Lampson calls BCPL "quite similar to C (indeed, it is C's immediate ancestor)". Jim Curry ported its portable compiler to the Data General Nova and then to the Alto, and also wrote the loader, which produced executables or overlays. Most Alto software was BCPL until 1977. By 1978 new programs were written "almost entirely" in other languages. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **BCPL origin.** Martin Richards of Cambridge created BCPL. He wrote the first compiler, for the IBM 7094 under CTSS, while visiting MIT's Project MAC in spring 1967. The reference manual is MIT Project MAC Memo M-352 (1967). — [Wikipedia: BCPL (text read via a GitHub mirror)](https://en.wikipedia.org/wiki/BCPL)
- **Mesa, features.** Mesa descends from Pascal. Its features are:
  - strong type-checking even across separately compiled modules;
  - interfaces defined separately from implementations;
  - cheap built-in concurrency;
  - very compact byte-codes of 1 to 3 bytes, with compiled programs about half the size of comparable C on a VAX;
  - a source-level debugger where you set breakpoints by pointing at the source.
  — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Mesa, history.** Jim Mitchell, Chuck Geschke and Ed Satterthwaite began it in 1971 on a time-sharing computer. It was ported to the Alto in 1975 with Rich Johnsson and John Wick, and in 1976 Xerox's System Development Division (SDD) adopted it for all its products. By 1982 several Mesa systems exceeded 250,000 lines each. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Mesa and Modula-2.** Modula-2's design was influenced by Mesa and the Alto, which Niklaus Wirth saw during a 1976 sabbatical at PARC. — [Wikipedia: Modula-2 (search snippet)](https://en.wikipedia.org/wiki/Modula-2)
- **Mesa and Java.** A claim that Mesa and Cedar "had a major influence" on Java appears on Wikipedia. — [Wikipedia: Mesa (search snippet)](https://en.wikipedia.org/wiki/Mesa_(programming_language)). **Flag:** I could not find a primary source such as a Gosling statement.
- **Smalltalk overview.** Lampson calls Smalltalk "the first" integrated programming environment built for the Alto: language, debugger, object-oriented virtual memory, editor, screen management and UI. It compiles to byte-codes, and a method can be compiled and installed "in a few seconds on an Alto" without disturbing the running system. The system had 100–200 classes. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Smalltalk generations.** There were three: Smalltalk-72, -76 and -80. "The first two run on the Alto, the last on the Dorado" and on VAX, 68000 and 80286 implementations. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Smalltalk-80 on the Alto after all?** The CHM archive contains an installed Alto Smalltalk disk (`Smalltalk14.bfs`) that includes the **December 1980 Smalltalk-80 V1** image. It also contains the Smalltalk-76 release (`Filene/Smalltalk-76`, versions 5.5j/5.5kXM). No Smalltalk-78 appears anywhere in the archive. — [xerox-dorado archive survey](https://github.com/alanswx/xerox-dorado/blob/main/docs/xerox-systems-archive-survey.md). **Flag:** this suggests some Smalltalk-80 bits existed in Alto-disk form, which partly conflicts with Lampson's "Smalltalk-80 on the Dorado".
- **Smalltalk-74 (FastTalk).** It added a real "messenger" object, message dictionaries, and Diana Merry's BitBlt, redesigned by Ingalls and put in microcode. It also introduced the **OOZE** object virtual memory by Ted Kaehler and Dan Ingalls, which swapped objects in 80 KB of working storage and handled about 65K objects. OOZE also served Smalltalk-76. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Smalltalk-76.** Ingalls finished the design in November. He, Dave Robson, Ted Kaehler and Diana Merry implemented it from scratch in seven months. It had about 50 classes in about 180 pages of source, including OS functions, files, printing, Ethernet, windows, editors and painting. It also had Larry Tesler's browsers, one for methods in the class hierarchy and one for live debugging contexts. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Ingalls's HOPL IV paper (2020)** covers six generations, from Smalltalk-72 (which acted as "its own parser") to Smalltalk-76 (keyword syntax and a virtual machine that endure today). It links live in-browser simulations of the early systems. — [Ingalls 2020 abstract (search snippet)](https://dl.acm.org/doi/10.1145/3386335). This is a useful visual source for the video.
- **Lisp on the Alto.** PDP-10 Interlisp users first used the Alto as a graphics terminal. Peter Deutsch and Willie-Sue Haugeland then built a complete Alto Interlisp: runtime in BCPL, byte-coded, with a compact list-cell encoding. It "worked" but was too slow, mainly for lack of memory. It moved to the Dorado and became **Interlisp-D**, which Lampson calls the first Lisp to integrate graphics. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Cedar.** From 1979 CSL built Cedar, a Mesa-based environment on the Dorado. It was usable by early 1982 and had about 400,000 lines by mid-1984. It used tiled windows ("Viewers") and icons. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- The byte-code design of Mesa, Smalltalk and Lisp (compact code interpreted by microcode) anticipates later VM-based languages. This is a good hook that stays within the sourced claims.
- The claimed Mesa-to-Java lineage should be presented as "often cited" rather than fact unless another researcher finds a primary quote.

### Gaps
- There is no primary source for the Java influence claim.
- I have no details of the Mesa debugger's screen or of Mesa's "Tajo" / XDE tool UI on the Alto. Lampson's Table 2 lists "Tajo" and "Copilot", but the OCR is too garbled to date them.

---

## 3. Smalltalk on the Alto: windows, BitBlt, pop-up menus, MVC, icons, and the children's experiments

### Takeaway
The Alto's first software was Smalltalk. According to Kay, the first Alto ("Bilbo") came alive in April 1973, and for months Smalltalk was the only system running on it. Smalltalk introduced overlapping windows, with an early BitBlt by Diana Merry, and the first pop-up menus, which Ingalls built partly inspired by Newman's Markup. The browser came from Tesler. MVC was formalized by Trygve Reenskaug in 1979. The Learning Research Group, with Adele Goldberg leading the teaching, ran Smalltalk classes for Palo Alto children from summer 1973. Some 12–15-year-olds built real tools.

### Cited Findings
- **Origin: the "page of code" bet (Sept 1972).** In a hallway argument, Kay claimed the most powerful language in the world could be defined in "a page of code". Ted Kaehler and Dan Ingalls told him to put up or shut up. Kay worked from 4 to 8 a.m. for about two weeks, and "by morning 8 or so" had a working interpreter design. Days later Ingalls had it running on a Nova, coded **in BASIC**. Ingalls's motto, as Kay quotes it: "You just do it and it's done." — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- It evaluated 3+4 very slowly ("glacial", as Lampson put it) but always answered 7. Over ten years Ingalls made at least 80 major Smalltalk releases. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **First Alto boot and first picture.** Chuck Thacker began the "Interim Dynabook" (the Alto) on 22 Nov 1972. In early April 1973 the first one, "Bilbo", ran. Within minutes the first bitmap picture appeared: the Muppets' **Cookie Monster**, sketched by Kay on the painting system. Ingalls then bootstrapped Smalltalk across, and for many months it was the Alto's only software system. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- Kay's $230K bought 15 of the original 30 projected machines. Kay says about 2,000 Altos were eventually built. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- Lampson called the Smalltalk-72 interpreter on the Alto "majestic", meaning slow. It was still fast enough for many real-time interactive systems. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Overlapping windows.** Kay had the idea (in the shower, pre-Alto) that windows on a bitmap display could look like overlapping documents on a desk, with a refreshed window coming to the top. Early versions ran on character-generator / Nova hardware in 1972. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- On the Alto, overlapping windows were the first project, done with Diana Merry after the keyboard and text code. Merry built an early bit-block transfer (**BitBlt**) for variable-pitch fonts and screen drawing. The first windows were fully draggable "2½D" objects but too slow, so they settled on a cheaper style Kay calls "2¼D". The first practical windows used GRAIL-style "sensitive corners" for moving, resizing, cloning and closing. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **BitBlt** (credited to Dan Ingalls in the Alto system) combines two rectangular bitmaps with modes such as constant black or white, copy source, merge (adding black ink), and xor, plus a 4×4 texture source for grays. It was microcoded and fast. It was used to move windows, scroll, draw rectangles and lines, and paint characters from font bitmaps. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **First with overlapping windows and pop-ups.** Lampson states that Smalltalk "was the first system to use overlapping windows and pop-up menus". His Figure 1 shows overlapping windows **without icons**, a class browser, and a "small skinny window", the pop-up menu. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Where the pop-up menu came from.** Gypsy used dedicated keys for cut, copy, paste and undo. Inspired partly by William Newman's pop-up icon grids in Markup, Dan Ingalls implemented a simple Smalltalk pop-up menu listing those four commands in a column. It evolved into today's right-click context menus. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **Browser.** Tesler developed the Smalltalk Browser, "an ancestor of today's IDEs". Lampson's description: panes show successive levels of the class tree from left to right, and a text pane underneath shows the selected method's code. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf); [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Smalltalk-76 window code.** Ingalls's `Window` class draws a 2-pixel frame outline and puts the title in a `titleframe` that is then **complemented** (inverted), giving a black title tab with white text. A `DocWindow` subclass shows its scrollbar and edit menu **only while the cursor is inside the window**, and hides them on leaving. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) (code listing)
- **MVC.** Trygve Reenskaug's Xerox PARC notes "Thing-Model-View-Editor" (12 May 1979) and "Models-Views-Controllers" (10 Dec 1979) are the founding MVC documents. — [Reenskaug, May 1979](https://folk.universitetetioslo.no/trygver/1979/mvc-1/1979-05-MVC.pdf); [Reenskaug, Dec 1979](https://folk.universitetetioslo.no/trygver/1979/mvc-2/1979-12-MVC.pdf). I did not read these directly; the citations and dates come from reference lists on GitHub. Kay lists Reenskaug among those who expanded Smalltalk multimedia documents. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Icons.** David Canfield Smith's **PYGMALION** thesis (1975) was an "iconic programming" / programming-by-example system. It was the largest Smalltalk-72 program, about 20 pages of code, all that would fit in the Alto. The SHAZAM animation system (summer 1974) had an "icon-controlled multiwindowed" UI. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- In Lampson's account, desktop icons as window substitutes belong to Star and Cedar rather than Alto Smalltalk. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- Tesler and Jeff Rulifson's 1973 PARC white paper "OGDEN: An Overly General Display Editor for Non-programmers" proposed iconic interfaces with desks and file cabinets, and modeless cut and paste. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **Other Smalltalk-72-era Alto applications (Kay):**
  - an object-oriented LOGO turtle (Kaehler), and Ingalls's "commander" turtles that command troops of turtles;
  - John Shoch's mouse-driven structured code editor;
  - Tesler's **miniMOUSE** editor;
  - Steve Weyer and Kay's **Findit** "retrieval by example", used for years by the PARC library for circulation;
  - music: Bob Shur and Chuck Thacker's 12 real-time sampled voices, wired to two organ keyboards and a pedal; Kaehler's **TWANG** music editor with children's tablature; Steve Saunders's real-time FM synthesis (8 voices); Chris Jeffers's **OPUS** real-time score capture;
  - animation: Steve Purcell's demo of **80 ping-pong balls and 10 flying horses at 10 fps** (fall 1973), his CHAOS system (May 1974), and SHAZAM (summer 1974, with Ron Baecker, Tom "Horseeley" [sic] and animator Eric Martin).
  — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Children's work.** Experiments with children began in summer 1973. Adele Goldberg and Steve Weyer came from Patrick Suppes's group at Stanford. At first Goldberg's teaching mimicked LOGO turtle graphics. Her breakthrough was the **"Joe book"**, which built a class `box` step by step and ended in a multi-process animation. Its ST-72 code begins `to box | x y size tilt`, with methods like `draw`, `undraw`, `turn` and `grow`. Children "swarmed over the ALTOS" with it. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Children's tools** included:
  - **Marian Goldeen** (age 12): a painting system;
  - **Susan Hamet** (12): an OOP illustration system with a MacDraw-like design;
  - **Bruce Horn** (15): music score capture;
  - **Steve Putz** (15): a circuit design system.
  The children came from Palo Alto schools. Kay admits "early success syndrome": the successes were real but not general. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- In spring 1974 Kay taught Smalltalk to 20 PARC non-programmer adults. They could not write a simple rolodex-style database, and Kay counted 17 non-obvious ideas in his own solution. This led to Goldberg's "design templates" for teaching design. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **January 1978 SimKit.** LRG built the Smalltalk SimKit, a job-shop simulation tool for adult non-experts, in two months for a two-day seminar for Xerox's top ten executives. Kay recalls Goldberg leading the design while nursing her new baby. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Apple visit (1979).** Kay says the demo machine was a **Dorado**, whose Smalltalk microcode was largely written by former "Smalltalk kid" Bruce Horn. Tesler gave the demo with Ingalls beside him. When Steve Jobs disliked the jumpy BitBlt-style scrolling, Ingalls made it smooth in under a minute. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/). Tesler dates the Jobs visit to December 1979. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **Early Altos crashed "once or twice a day"** for no clear reason, which the team called "cosmic rays". OOZE's checkpointing kept a recoverable image no more than a few seconds old. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- Lampson notes that most Smalltalk users still wrote papers and read mail with other Alto software (Bravo, Laurel), because many Smalltalk apps were too slow for daily use. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- Which of these ran on the Alto itself: Smalltalk-72, -74 and -76 (per Kay and Lampson); the children's classes (per Kay); all the ST-72 applications above; and the Smalltalk-76 browser and pop-ups. Smalltalk-80 was mainly Dorado (per Lampson), with an Alto-format disk in the archive. The 1979 Apple demo was on a Dorado according to Kay, although popular accounts often say Alto.
- "Smalltalk invented icons" is too strong. The sourced story is PYGMALION's iconic programming (1975), OGDEN's proposal (1973), and Star's desktop icons later.

### Gaps
- I could not read Ingalls's HOPL IV paper (ACM blocked), so I lack his dates for the first pop-up menu and for BitBlt (commonly given as 1975).
- I have no primary MVC text. Its dates rest on citation metadata.
- There is no detail on the school where classes were held. Kay says only "Palo Alto schools"; the often-cited "Jordan Middle School" is unverified.
- Kay's excerpt does not state the year Smalltalk-76's design was finished ("November", in a section headed 1976–80). It is presumably November 1976, with implementation running into 1977. Unconfirmed.

---

## 4. Bravo (WYSIWYG, piece table) and Gypsy (modeless, cut/copy/paste)

### Takeaway
Bravo was designed by Lampson and Simonyi, implemented mainly by Simonyi and Tom Malloy, and was running by 1974. It was the Alto's workhorse WYSIWYG editor. It was fast because of the piece table and a line-bitmap cache, but it was modal: single-letter commands like I, A, R and D. Gypsy (1974–75) was Larry Tesler and Tim Mott's modeless rebuild of Bravo for Ginn & Co. It introduced click-to-type, drag-select, double-click and cut/copy/paste. Bravo's line led through BravoX (Simonyi, 1979) to Microsoft Word.

### Cited Findings
- **Authorship.** Bravo was "designed by Butler Lampson and Charles Simonyi, and implemented mainly by Tom Malloy". Carol Hankins, Greg Kusnick, Kate Rosenbloom and Bob Shur also contributed substantially. — [Alto User's Handbook, Bravo Manual preface, p. 28](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf). Lampson's paper says "implemented by Simonyi, Tom Malloy, and a number of others", and calls it probably the most widely used Alto application. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Date.** Bravo "became operational on September 14, 1974". — [Wikipedia: Bravo (search snippet)](https://en.wikipedia.org/wiki/Bravo_(editor)). Single source; flag. It is consistent with Tesler's statement that an early Bravo was running when Tim Mott arrived in 1974. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf). The handbook's summary sheet is "Bravo Version 6.0", dated 5 Oct 76. — [Alto User's Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Features.** Lampson lists rapid screen updating, editing speed independent of document size, WYSIWYG (italics, Greek letters and justified text on screen), and semi-automatic error recovery. Later versions added style sheets ("emphasis" mapped to italic or underline), hyphenation, form letters and an abbreviation dictionary. It printed to the Ears and Press printers and to daisy-wheel printers. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Piece table (the CS hook), in Lampson's words paraphrased.** Text is stored as a table of *pieces*, each a descriptor pointing to a substring of an **immutable** string in a file.
  - At first the whole document is one piece pointing at the original file.
  - Replacing a word gives three pieces: the text before it, the new characters (written to a scratch file as they are typed), and the text after it.
  - Binary search over the piece array makes access time logarithmic in the number of edits.
  - On save the document is rewritten cleanly so the table does not grow forever.
  - Jay Moore invented the scheme independently.
  — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Formatting runs.** Each character has a 32-bit property record (font, bold, italic, offset…), stored run-length coded in a table like the piece table, with formatting operators attached to pieces. Making a **60,000-character document italic takes only a few instructions per piece**. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Screen cache.** The screen is kept as a table of lines, each with its own bitmap and pointers to its source characters. After an edit, only lines whose characters changed are invalidated and re-rendered. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Bravo's software virtual memory.** Bravo includes a software VM for text and fonts. That is how it fit in 128 KB. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Modal command set (1976 manual).**
  - You always select first, then give a one-letter command (select-then-verb, i.e. postfix).
  - Commands: **D**elete, **U**ndo, **I**nsert (a blinking caret appears; type; press **ESC** to finish), **A**ppend, **R**eplace, **G**et (load file), **P**ut (save), **H**ardcopy, **Q**uit, **L**ook (formatting), plus Jump, Find and Substitute.
  - Pressing ESC with nothing typed repeats ("defaults") the last insertion.
  - A "copy selection" (shown with a dotted underline) inserts a copy of existing text.
  - Control-W erases the last typed word.
  - Formatting during type-in uses Look/control keys, e.g. Look **b** for bold and **i** for italic, with SHIFT meaning "not".
  — [Alto User's Handbook, Bravo Manual pp. 29–34 and summary](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- Lampson himself calls Bravo's user interface "clumsy". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Gypsy origins.** Tesler joined PARC in 1973 on the POLOS team and also worked with Kay's LRG. He was drawn to Kay's overlapping windows as an alternative to modes. Xerox-owned textbook publisher **Ginn & Co.** asked PARC for a galley editor and a page-layout system. Tesler's cut-and-paste proposal "delighted Ginn management". Ginn hired **Tim Mott** to do an ethnographic study at its facility near Boston, and in 1974 Mott came to PARC and named the editor **Gypsy**. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **How Gypsy was built.** They took Bravo's source code and **replaced the modal UI with a modeless one**. At Ginn's request they added bold, italic and underline, and a filing system with versions and drafts. It took "a few months". Gypsy let the user:
  - click between characters to get a blinking insertion point and start typing;
  - down-drag-up to select;
  - **double-click to select a word** (Mott's idea);
  - cut/paste and copy/paste in two steps;
  - search by typing or pasting into an editable field.
  Cut, copy, paste and undo had dedicated keys. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **Testing at Ginn.** Gypsy was finished in **early 1975** and Mott took it to Ginn. Users loved it but disliked the lack of maintenance. Beverly McHugh ran usability studies, and PARC's Tom Moran and Stu Card offered to run more. A 1981 study by Roberts and Moran found experienced Gypsy users beat users of the other editors tested and needed about **two-thirds the time of NLS users**. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **Press coverage and the phrase itself.** A June 1975 *Business Week* feature, "The Office of the Future", mentioned Gypsy. Tesler says the term "copy and paste" appears to have originated in Gypsy. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **The "no modes" crusade.** Tesler's 1981 Byte definition of a mode is a UI state not tied to any object whose only role is to interpret input. He names three culprits: verbs before objects (prefix syntax), key meanings that depend on mode, and inconsistent ways to escape a mode. The NLS example is prefix syntax such as `D W <mark> <ok>`. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **Before Gypsy.** Tesler built a simple modeless typewriter-like editor in early Smalltalk that non-users learned in five minutes. Kay calls Tesler's Smalltalk **miniMOUSE** "the first real WYSIWYG galley editor at PARC". — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf); [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/). **Conflict:** this competes with Bravo's usual "first WYSIWYG" label.
- **Anecdote: Cypress.** Tesler's Smalltalk-76 page-layout prototype for Ginn ran so slowly that to demo it they filmed at **3 frames/s and played back at 30 frames/s**. It also popped up an edit menu automatically next to a selection, as on today's iPhone. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **BravoX** was Simonyi's successor to Bravo. Gypsy influenced both BravoX and Star. Both had modeless click-and-type insertion but not two-step cut/copy-paste; one BravoX version could move or copy in 2 strokes, versus Gypsy's 4. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- BravoX was developed in 1979 under Simonyi in Xerox's Advanced Systems Development group. — [Wikipedia: Bravo (search snippet)](https://en.wikipedia.org/wiki/Bravo_(editor)). The CHM archive has `indigo/bravox`, 385 files dated 1979–81 of BravoX sources. — [xerox-dorado archive survey](https://github.com/alanswx/xerox-dorado/blob/main/docs/xerox-systems-archive-survey.md)
- **Bravo to Word.** Lampson: Star's interface influenced later versions of Bravo, "from which Microsoft Word was then derived". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf). Microsoft hired Simonyi in 1981 to work on Multi-Tool Word, announced in 1983 and renamed Microsoft Word. — [Wikipedia: Bravo / search snippet](https://en.wikipedia.org/wiki/Bravo_(editor)). Richard Brodie joined near the end of the BravoX project. Word was philosophically similar but written from scratch. — [VC&G interview with Simonyi and Brodie, 2008 (search snippet)](https://www.vintagecomputing.com/index.php/archives/1165/vcg-anthology-interview-charles-simonyi-and-richard-brodie-creators-of-microsoft-word-2008)

### Inferences
- A clean visual narrative: Bravo keeps text as pieces over immutable files and edits by splicing descriptors, while Gypsy keeps Bravo's engine and changes only the interaction model. The same engine with a different UI is a nice story beat.
- A piece-table animation could show the original file as one bar and a scratch "add" file as a second bar. Each edit splits a descriptor into three and highlights the binary search.

### Gaps
- No direct Simonyi interview text was accessible.
- The exact date Simonyi left for Microsoft (commonly 1981) comes from a search snippet only.
- nomodes.com was blocked. I could not verify the "NO MODES" licence-plate anecdote.

---

## 5. Other applications: Laurel/Grapevine mail, Markup, Draw, Sil, Fred, FTP, Chat, Neptune/DDS, file servers

### Takeaway
Beyond Bravo, the everyday Alto toolset was: Laurel for mail (three stacked panes, very popular), Markup (MacPaint-like bitmap painting), Draw (splines and arrows), Sil (Thacker's fast logic-diagram editor, used to design hardware), Fred (spline fonts captured with a TV camera), and FTP/Chat for networking. File servers were IFS, and Grapevine handled naming and mail (from 1980). No illustrator was integrated with a text editor. Documents were stitched together as Press files instead.

### Cited Findings
- **Laurel authors.** Laurel was built by **Doug Brotz, Roy Levin, Mike Schroeder and Ben Wegbreit**. It handles reading, filing and composing; transport is done by Grapevine or another system. The Laurel Manual is CSL-81-6 (1981). — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Laurel's layout.** It has a fixed arrangement of **three windows in one column**: a message directory (one line per message) on top, the message being read in the middle, and a message being composed at the bottom. Each window has a line of menu buttons above it. Some buttons have "blanks" to fill in (shown as `{…}`). Deleted messages are **struck out** and only really deleted on exit, so they can be undeleted until then. A folder is stored as two files, messages plus a table of contents, and has its own scavenger. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Laurel's reception.** Its interface took "about a man-year of design", and most users never opened the manual. A variant called **Cholla** ran an integrated-circuit fabrication line, with "recipes" sent as messages. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Grapevine** was designed and implemented by Andrew Birrell, Roy Levin, Roger Needham and Mike Schroeder. It entered service in 1980 as the second Mesa server. It had dozens of replicated servers serving about 2,000 machines and 7,000 registered users, and handled mail transport, naming, distribution lists, access control and password checking. Earlier, mail ran on the Tenex time-sharing machine (MAXC). — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Markup** (William Newman) was the Alto's **first illustrator**. It edits multi-page Press files one page at a time, with brushes for painting into the bitmap, erase, and move/copy of rectangles. Text is kept separately so it prints at full resolution. Its pop-up menus were like Smalltalk's but more elaborate. Lampson notes that MacPaint "is quite similar to Markup". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf). Tesler credits Markup's pop-up **icon grids** as part of the inspiration for Smalltalk's pop-up menu. — [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **Draw** (Patrick Baudelaire) builds pictures from lines and **spline curves** of varying widths, dashed, with arrowheads, plus copying and arbitrary linear transforms. Its Figure 5 shows a transform defined by mapping triangle P1P2P3 onto Q1Q2Q3. It needed a 60 KB full-screen bitmap within 128 KB and ran out of space quickly. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Sil** (Chuck Thacker) is for logic drawings.
  - It uses only characters and horizontal and vertical lines, with a special font of AND gates, OR gates, resistors and so on, and macros for building up components.
  - To erase, it redraws the element in **white ink**, then in the background redraws whatever intersected its bounding box.
  - It was paired with batch tools: a design-rule checker and a wire-list generator.
  - "Somewhat to everyone's surprise" it became the illustrator of choice whenever curves were not required.
  — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- A nice detail: the Bravo 6.0 one-page summary sheet in the 1976 handbook is itself a Sil drawing. Its file label reads `brsum.sil`. — [Alto User's Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Fred** (Baudelaire) is a spline font editor. An Alto connected to a **television camera** captures a letterform, the user fits splines around it, and the outlines are scan-converted at many sizes. Ears printer fonts were made with Fred. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **PressEdit** (Newman) is a batch program that merges images from several Press files into one document. Several integrated text-and-graphics editor designs failed because the Alto was too small. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **File managers.** Gypsy was first to present a directory as editable text (deleting a line deletes the file). It was followed by **DDS** (Descriptive Directory System, Peter Deutsch) and **Neptune** (Keith Knox), which added filters such as "memo and not report", and later by Star's folders. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf). `Neptune` is among the Alto boot files in the archive. — [xerox-dorado archive survey](https://github.com/alanswx/xerox-dorado/blob/main/docs/xerox-systems-archive-survey.md)
- **FTP and Chat.** FTP (file transfer) was written by **David Boggs** and Chat (remote terminal) by **Bob Sproull**. Both run from the Executive over Pup byte streams, at about 0.3 Mbit/s between two Altos. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Pup** (PARC Universal Packet) was originally designed by Bob Metcalfe and implemented with Boggs and Ed Taft. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **File servers.**
  - The Tenex mainframe (MAXC) served files for the first three years.
  - **WFS** (Boggs) was a single-packet page server built in 2 months on a Nova.
  - **IFS** (Boggs and Taft, with Ed McCreight's B-tree) ran on Altos with 300 MB disks, fit in 128 KB of memory, served as the main file server for at least seven years, and dozens were installed.
  - **Juniper** was a transactional server in service in 1977 that saw little use.
  — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **The Worm.** A program that searched for idle Altos and replicated itself into them. Lampson calls it the only truly distributed Alto program besides the Pup router. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **What was missing.** Lampson notes that nobody thought of **spreadsheets**, because a research lab had little need for them. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **The 1976 handbook's contents**: the Non-programmer's Guide (Lampson), Bravo, Markup (Newman), Draw, DDS and FTP manuals. By Oct 1976 the system included an OS, a display editor, three illustrators, high-quality printing, shared files and mail via the time-sharing machine, and two programming languages. — [Alto User's Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf); [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- The three illustrators map neatly onto modern categories: Markup is paint (MacPaint), Draw is vector (MacDraw/Illustrator), and Sil is CAD/EDA. Lampson's Table 3 explicitly lists "Apple MacPaint, MacDraw" as descendants. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Gaps
- **Hardy**, the Laurel-like mail client for later machines, is not mentioned in any source I could read. Unverified.
- The name "Analyzer" for Sil's checker is unverified. Lampson only says "design-rule checker and wire-list generator".
- I have no firm first-release dates for Markup, Draw or Sil. Table 2 of Lampson's paper, a chronology, is too garbled in OCR to read. Markup existed by Oct 1976, since it is in the handbook.
- The language Laurel was written in is not stated in my sources. I believe it was Mesa but have no source.

---

## 6. Fonts, typography and printing: bitmap fonts, Press, Interpress to PostScript

### Takeaway
Alto fonts were hand-tuned bitmaps. The standard Bravo set in 1976 was Times Roman, Helvetica, the fixed-pitch "Gacha", Math, Greek "Hippo" and a XEROX "Logo" font. For print, PARC moved from embedding font bitmaps (Ears) to naming fonts (**Press**, by Newman and Sproull), and then to a stack-based page-description *program* (**Interpress**, 1980, by Sproull and Lampson with John Warnock). Lampson lists PostScript as a descendant.

### Cited Findings
- **Bravo's standard fonts (1976), numbered 0–9** (Look 0–9 selects a font):

  | No. | Font |
  |---|---|
  | 0 | Times Roman 10 |
  | 1 | Times Roman 8 |
  | 2 | Logo |
  | 3 | Math 10 |
  | 4 | Hippo 10 (Greek) |
  | 5 | Times Roman 12 |
  | 6 | Helvetica 10 |
  | 7 | Helvetica 8 |
  | 8 | Gacha 10 (fixed pitch) |
  | 9 | Helvetica 18 |

  The sample page shows "Font 2: Logo 24" rendering the word **XEROX**, and keyboard maps for the Math and Hippo fonts. — [Alto User's Handbook, Bravo manual font samples and summary](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- The Executive and OS load the system font file `SysFont.al`. — [Alto User's Handbook, p. 9](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- The CHM archive tree `indigo/altofonts` (1976–1987) has 610 font files: **221 `.strike`, 195 `.al`, 194 `.ks`** (bitmap font formats). There are also Tioga screen fonts in strike/ks formats and `SmallTalk10` Alto fonts. — [xerox-dorado archive survey](https://github.com/alanswx/xerox-dorado/blob/main/docs/xerox-systems-archive-survey.md)
- **The font-data problem.** One typeface needs about **30 KB** of bitmap, and every size and style counts as a separate typeface. Three families × four styles × nine sizes (6–24 pt) gives 108 typefaces, "actually the system uses many more". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **First printing interface.** The first printer interface, by Peter Deutsch for the XGP (Xerox Graphics Printer, 200 dpi, 5 pages/min), was ASCII text with control codes. **XGP fonts were made entirely by hand**, turning dots on and off in a roughly 20×20 grid. They had to be new designs at that resolution and were later widely used in universities. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Ears.** Designed by Ron Rider, Ears was the first high-quality raster printer: 500 dpi, one page per second, built on a Xerox 3600 copier engine with Gary Starkweather's laser scanner. Documents had to **include all font bitmaps**. A second Ears became the prototype for the **Xerox 9700**. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Press**, by **William Newman and Bob Sproull**, is printer-independent. It has an imaging model, arbitrary graphics, and **fonts named rather than embedded**, because managing fonts proved too hard for document creators. Press files could be displayed as well as printed. It "served well for about six years". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Dover/Orbit/Spruce.** The Dover engine (384 dpi) used Orbit imaging hardware by Sproull and Severo Ornstein (from Lampson's design) and the Spruce imager by Sproull and Dan Swinehart. About **50 copies** were made, cheap enough for every group to have its own printer. It stored "many thousands" of pages and printed about 40 pages/min. All CSL documentation and papers were printed on demand. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Interpress** (1980) is by Bob Sproull and Butler Lampson "with assistance from John Warnock". Its big innovation is a **stack-based programming language**: the document is a program executed to produce the image. Lampson's Table 3 lists "Xerox Interpress; Adobe Postscript" as printing interfaces descended from the Alto work. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Pre-Alto font work.** Ben Laws built a font editor for the POLOS character generator. Kay spent months with him studying the nonlinearity of human vision, because Kay hoped high-quality text would get the Dynabook into schools as a "trojan horse" replacing textbooks. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)

### Inferences
- The progression gives a visual storyline: dots toggled by hand in a 20×20 grid (XGP), then bitmaps shipped inside each document (Ears), then fonts named by the document and stored at the printer (Press), then the page as a program (Interpress, leading to PostScript).

### Gaps
- **"Cream"** as an Alto font name is not confirmed by any source I read. The confirmed set is TimesRoman, Helvetica, Gacha, Math, Hippo, Logo, SysFont and SmallTalk10.
- The Warnock-to-Adobe link (Warnock co-founding Adobe after Interpress) is widely known but not stated in my sources beyond "assistance from John Warnock" and Table 3.
- Font-editor names other than Fred (e.g. a bitmap editor for Alto `.al` fonts) are not established.

---

## 7. Games on the Alto: what's verified

### Takeaway
Maze War is the headline game. It began on Imlacs at NASA Ames in 1973 (Colley, Thompson, Palmer), and a networked Alto version was written at PARC in 1977 using the Pup protocol. Alto Trek (Gene Ball and Rick Rashid, University of Rochester) is another early networked multiplayer game. The CHM archive contains boot files for Galaxian, Invaders, MazeWar, PinBall, Polish Pong, Missile Command, AstroRoids, StarWars, Trek, Reversi, Pool, PacMan and more. Many file dates cluster around 1979–81.

### Cited Findings
- **Maze War origin.** It was originally written by **Steve Colley, Greg Thompson and Howard Palmer in 1973 at NASA Ames**. — [Maze War VR README](https://github.com/marciot/mazewar-vr). Colley wrote it on Imlac PDS-1s at NASA Ames in Jim Hart's Computation Division lab, dated "1972–1973". — [DigiBarn / Wikipedia via search snippet](https://www.digibarn.com/history/04-VCF7-MazeWar/stories/colley.html)
- **Alto Maze War.** The "Xerox Alto remake of Maze War", **version 2.0**, was developed at PARC in **1977** and uses the **Pup** protocol. A modern WebVR remake is wire-compatible with it running on the ContrAlto emulator. — [Maze War VR README](https://github.com/marciot/mazewar-vr)
- The Alto port was "the first raster display version". Data General-based gateways let players at several Xerox sites play each other. — [Wikipedia: Maze War (search snippet)](https://en.wikipedia.org/wiki/Maze_War)
- **Alto Trek** was developed by **Gene Ball and Rick Rashid**, graduate students at the **University of Rochester** in the late 1970s. It is one of the first networked multiplayer games: each player uses their own Alto to command a starship. — [Wikipedia: Alto Trek (search snippet)](https://en.wikipedia.org/wiki/Alto_Trek). MobyGames dates it to 1978; UVL lists "Trek '79 (1979)". — [MobyGames (search snippet)](https://www.mobygames.com/platform/xerox-alto/). Conflicting dates; flag.
- **Archive boot files.** The CHM archive's `Io/Murray` directory (1979–1985, 50 `.boot` files) includes:
  - `Galaxian.boot` (57,238 bytes, dated **17 Sep 1981**), `Invaders.boot`, `MazeWar.boot`, `PinBall.boot`, `PPong.boot` ("Polish Pong"), `TriEx.boot`, `MissileCommand.boot`;
  - AstroRoids, StarWars, Trek, Reversi, Fly, Pool, Kal and Neptune;
  - network tools such as Pupwatch and EtherWatch.
  A separate 1985 games pack disk image (`Clark-Games.altodisk`) contains `PacMan7.RUN`, `PPong.run`, `Maze.run`, `Pool.run`, `Polygons.run`, `Kinetic4.run`, `Equinox.run`, `Dali.run` and `AClock.run`. — [xerox-dorado archive survey](https://github.com/alanswx/xerox-dorado/blob/main/docs/xerox-systems-archive-survey.md)
- An `AllGames.dsk` image ("a collection of games and toys for the Alto") is distributed on Bitsavers for emulators. — [ContrAlto readme](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/readme.txt)
- MobyGames counts 10 games released on the Alto from 1977 to 1982, including Pinball (1978), Trek '79, Chess and Galaxian. — [MobyGames / UVL (search snippet)](https://www.mobygames.com/platform/xerox-alto/)

### Inferences
- The best cameos are Maze War (first-person wireframe corridors with the opponent drawn as an eyeball, per common descriptions), networked Trek, Pinball, Galaxian/Invaders/Pac-Man clones, and Polish Pong.
- The arcade clones (Galaxian 1981, Pac-Man, Missile Command) are late-Alto-era hobby programs rather than 1970s research. The video should frame them as 1979–82.
- Smalltalk's 1973–74 animation demos (80 bouncing ping-pong balls, flying horses) are strong "toy" visuals from the research core. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)

### Gaps
- I have no source for **who** wrote Alto Pinball, Galaxian, Invaders or Chess.
- **Space War** on the Alto is not verified; there is a "StarWars" boot file, but no Spacewar.
- There is no primary description of the Alto Maze War screen. The eyeball avatar is common knowledge from the Imlac/Alto versions but I did not read a source.
- Ken Shirriff's blog posts on Alto games (righto.com) were blocked.
- Maze War date conflicts: 1973 (Maze War VR) versus 1972–73 (DigiBarn snippet); a GitHub description calls it "the 1974 game".

---

## 8. Sample screens: layouts suitable for recreating in a JS animation

### Takeaway
The Alto screen was a portrait bitmap about 606×808 pixels, black ink on white "paper". Application layouts were mostly vertical stacks: Bravo's tiled windows with a system window on top, Laurel's three stacked panes with menu bars, and Smalltalk's overlapping framed windows with inverted title tabs. Scroll bars were at the left edge. The three mouse buttons were called RED, YELLOW and BLUE, and cursor shapes changed with screen region.

### Cited Findings
- **Display.** The Alto has a roughly 500,000-pixel (606×808) bitmap display. The whole machine had 128K of memory and 160 MSI chips on two cards. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/). The screen displays a single 8.5"×11" sheet "with black ink". — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf). A full-screen bitmap takes about 60–64 KB of memory. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf); [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Executive screen.** A **6-line area at the top** and a **~20-line area in the middle**, with a clock and status lines between them (versions, owner and disk name, Alto serial number, free disk pages). The ">" prompt sits about halfway down. When another program is started, the large area is erased and the command appears at the bottom of the small area. — [Alto User's Handbook, pp. 2, 5, 7](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Idle screen.** After Quit, the screen goes blank and a **white square jumps around**. This is the memory test, and an idle Alto was supposed to be left in this state. — [Alto User's Handbook, p. 3](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Bravo screen (v6.0, 1976), from the manual's "THE SCREEN" diagram, top to bottom:**
  1. **System window**: 3 lines reading "What you can do next", "What you did last", and "1{delete} 2{insert} 3{search key}" (the buffers).
  2. A **heavy black horizontal bar** showing the **file name**.
  3. **Document window**: a narrow **scroll bar at the far left** (labelled SCROLL BAR vertically), a **line bar** column next to it, then the **text area**.
  4. The document ends with a small **triangular "endmark"**.

  More windows can be stacked (tiled in one column) by splitting. — [Alto User's Handbook, Bravo Manual p. 29 and Bravo 6.0 summary](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf); [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf) (one column of tiled windows, control window at top, message window at bottom)
- **Bravo mouse table.** The mouse has three buttons named **RED** (top or left), **YELLOW** (middle) and **BLUE** (bottom or right).

  | Region | RED | YELLOW | BLUE |
  |---|---|---|---|
  | Scroll bar | scroll up | "thumb" | scroll down |
  | Line bar | select line | select paragraph | extend |
  | Text | select character | select word | extend |

  — [Alto User's Handbook, Bravo 6.0 summary](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Bravo cursor shapes:**
  - a **double-headed arrow** in the scroll bar;
  - a **heavy up arrow** while RED is held, and a down arrow for BLUE;
  - a **striped right-pointing arrow** (the "thumbnail") while YELLOW is held in the scroll bar, plus a striped arrow in a box (the "bookmark") marking the current position;
  - in text, an arrow pointing up and slightly left.
  — [Alto User's Handbook, Bravo Manual pp. 31–32](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Bravo selection feedback.** The current selection is **underlined**. A copy selection has a **dotted underline**. The insertion point is a **blinking caret**. Selecting with RED underlines one character; YELLOW underlines a word. — [Alto User's Handbook, Bravo Manual pp. 32–34](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **General conventions.** Selections are shown by underlining or inverting black and white. Insertion points are a blinking caret or I-beam. Scroll bars are thin rectangles along one side, often with a highlighted portion showing position, and "thumbing" jumps proportionally. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Laurel screen (Lampson's Fig. 7, Laurel 6, 1981), top to bottom:**
  1. A header line: "Laurel 6 Friday May 1, 1981 11:07 am PDT".
  2. A status line: "Login please. 891 free disk pages".
  3. A menu line: `User {LaurelSupport.PA}  New mail  Mail file {Tutorial}  Quit`.
  4. A **table of contents**, one message per line, e.g. `1 Apr. 27 LaurelSupport TO START YOUR TUTORIAL SESSION: Point cursor at "Display"...`. Following lines are prefixed with "?".
  5. A menu bar: `Display  Delete  Undelete  Move to {}  Hardcopy`.
  6. A message pane with headers (Date / From / Subject / To) and body text. "End of Message" appears in italics at the end.
  7. A menu bar: `New form  Answer  Forward  Get  Put  Copy  Run`.
  8. A composition pane with a template: `Subject:`, `To: {Recipients}`, `cc: {CopiesTo}, LaurelSupport`, `{Message}`.

  Horizontal rules separate the panes (they OCR as rows of marks, so they were probably dotted or striped). Scrolling uses the same double-headed arrow in the left margin as Bravo. — [Lampson 1986, Fig. 7](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Smalltalk screen (Lampson Fig. 1).**
  - Overlapping rectangular windows with no icons.
  - A **browser** with several list panes across the top: class categories such as "Collections-Text", "Graphics-Primitives" and "Graphics-Display", then classes, message categories, and selectors such as `do:`, `reverse` and `collect: aBlock`. A code pane sits below.
  - A notifier/debugger window titled "User Interrupt" listing stack frames such as `CodeController(ParagraphEditor)>>processRedButton`.
  - A "Form Editor" and a skinny pop-up menu.
  — [Lampson 1986, Fig. 1](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Smalltalk-76 window visuals (from Ingalls's code).** Windows have a 2-pixel border. The title sits in a small frame that is **inverted** (black tab, white letters). The scroll bar and edit menu appear only while the cursor is in the window. A character typed into a window that can't accept it makes the window **flash**. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Markup screen (Fig. 4).** Callouts in the figure label a "main menu", a "font menu" and a "mouse image file menu". Pop-up icon grids appear under the cursor. — [Lampson 1986, Fig. 4](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf); [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)
- **Sil screen (Fig. 6).** A dense schematic of orthogonal lines with small text labels, e.g. `FifoWaddr`, `OutRegFull`, `ClearErrors`, and timing diagrams. — [Lampson 1986, Fig. 6](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- **JS recipe for a Bravo frame:**
  - a 606×808 portrait canvas with a white background and black 1-bit text, using a serif font for Times Roman and a monospace for Gacha;
  - 3 system lines at top, then a full-width black bar with the filename in white;
  - a ~16 px scroll-bar gutter and ~10 px line-bar gutter at left;
  - an underlined selection, a blinking caret, and a ▼-like endmark triangle.
- **Laurel frame:** three stacked panes, each topped by a one-line menu of bold words with `{}` blanks, and struck-through lines in the table of contents for deleted mail.
- **Smalltalk-76 frame:** overlapping rectangles with 2 px borders, black title tabs with white text at the top-left, and a skinny white pop-up menu listing four commands (the Tesler account gives cut, copy, paste, undo).
- **Lampson's Figure 1 is probably Smalltalk-80, not Alto-era Smalltalk.** Its class names (ParagraphEditor, CodeController) match Smalltalk-80 conventions and the paper dates from 1986. For an Alto-accurate Smalltalk-76 look, rely on the Kay code description and Ingalls's live simulations.
- **Idle-screen colour.** The memory-test idle screen ("screen goes blank… white square jumps around") implies a black screen with a white square.

### Gaps
- I did not see actual screenshots, only OCR of figure text and the handbook diagram. Exact pixel dimensions of scroll bars, fonts and cursor bitmaps are unknown.
- Whether Smalltalk-72 screens had title tabs is not documented in my sources.
- There is no description of the Markup and Draw menu graphics beyond the figure labels.

---

## 9. Day-to-day user experience at PARC

### Takeaway
"Personal" was literal. You got your own removable disk pack (about 14–15 inches across, about 2.5 MB), signed for it, cloned a standard "Basic Non-programmer's Disk" onto it, wrote your name on the label, and carried it to any free Alto. You booted with a button behind the keyboard, worked in Bravo, Laurel and the illustrators, printed on laser printers, and left the machine showing the bouncing-square memory test. The Alto network had about 150 Altos at PARC and grew to about 2,000 machines company-wide.

### Cited Findings
- **Getting a disk pack.** Every user needed one: a "circular, yellow or white object about 15 inches in diameter and 2 inches high". You got it from the **yellow cabinet in the Maxc room, room 1153**, and logged your name and the pack's serial number on a form. — [Alto User's Handbook, p. 2](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Pack capacity.** Diablo 31 packs held about 2.5 MB; Diablo 44 packs about 5 MB. — [ContrAlto readme](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/readme.txt). Kay describes the "2.4 megabyte model 30 disk drive". — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Initialising your disk.** Load the rack's **BASIC NON-PROGRAMMER'S DISK** into drive 0 and your blank pack into drive 1, boot, and type `>CopyDisk` (DP0 → DP1). It takes about **two minutes**, and two counters near the top of the screen count to 406 twice. Then **label the disk with your name**, "take the new disk to any Alto", and run `>Install` to set the owner and disk name, with an optional password. — [Alto User's Handbook, pp. 2–4](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Disk space.** Users were told to keep at least 150 free disk pages, and a page of text takes about 5 disk pages. Old files were archived to Maxc, CSL's own time-sharing mainframe, which ran the Tenex operating system. — [Alto User's Handbook, p. 7](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf); [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Software updates** were announced by Maxc messages. Users fetched new versions with FTP and ran `.cm` command files. — [Alto User's Handbook, p. 10](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Trouble signs** included a "funny buzzing noise from the disk". Packs written on one drive sometimes failed on another because of alignment differences between drives. — [Alto User's Handbook, p. 8](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Mouse lore.** The mouse is "the small white object with three black buttons" to the right of the keyboard. If the cursor sticks, turn the mouse over and spin the ball with your finger. — [Alto User's Handbook, Bravo Manual pp. 29–30](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **"Personal" as a radical idea.** In 1975 it was hard for people to believe a whole computer was needed for one person. Lampson turns the time-sharing maxim around: for displays, "people are fast, and machines are slow". Had the Alto been sold in 1974 it would have cost about **$40,000**. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Scale.** About **150 Altos** (and 50 Dorados) were at PARC. Lampson notes most programs took over the whole machine, with no multitasking. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf). Kay: "some 2000" were eventually built. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)
- **Printing.** Laser printers made printing routine. Lampson says Ears could print 80 pages an hour for each member of a 40-person lab. Everything was printed on demand, and later every group had a Dover. — [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Crashes.** Early Altos crashed once or twice a day. Undo and replay (e.g. Bravo's replay facility) made this tolerable. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/); [Alto User's Handbook, Bravo summary: REPLAY](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)
- **Politics.** Kay says Stewart Brand's 1972 *Rolling Stone* article on PARC led Xerox to impose badges and publication restrictions. An executive ("X") tried to kill the Alto project, and Lampson wrote a defence of the machine. — [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)

### Inferences
- The disk-pack ritual makes a strong visual sequence: yellow cabinet, sign-out form, CopyDisk counters ticking to 406 twice, a handwritten label, walking the pack to any machine, the boot button, and the Executive banner with your name in it.

### Gaps
- Pack diameter conflicts: "about 15 inches" (1976 handbook) versus 14-inch (ContrAlto).
- I found no first-person account of how people chose or reserved an Alto in the "any Alto" era, as opposed to one per office later.

---

## 10. The 2014 CHM release of Alto source code and file system archive

### Takeaway
On 21 Oct 2014, the Computer History Museum, with PARC's permission, published snapshots of about 15,000 Alto files from 1975–1987 at xeroxalto.computerhistory.org. The release covers source code, executables, documentation and fonts across BCPL, Mesa, Smalltalk and Lisp, and is licensed for non-commercial use. Paul McJones wrote the conversion tooling.

### Cited Findings
- **Scope.** With PARC's permission, CHM made available snapshots of Alto **source code, executables, documentation, font files and other files from 1975 to 1987**. It highlighted Bravo, Markup and Draw, and code in **BCPL, Mesa, Smalltalk and Lisp**. The code is available for **non-commercial** use. — [CHM blog "Xerox Alto Source Code" (search snippet)](https://computerhistory.org/blog/xerox-alto-source-code/); [CHM press release (search snippet)](https://computerhistory.org/press-releases/xerox-alto/)
- **Date.** The press release is dated 21 Oct 2014 (per its GlobeNewswire URL). The same month also saw CP/M source released. — [GlobeNewswire (search result)](https://www.globenewswire.com/news-release/2014/10/21/675015/10103648/en/Computer-History-Museum-Adds-Historic-Xerox-Alto-Source-Code-to-its-Software-Source-Code-Series.html); [Computerworld (search result)](https://www.computerworld.com/article/1608292/exposed-xerox-alto-and-cp-m-os-source-code-released.html)
- **Tooling.** Starting in fall 2013, **Paul McJones** wrote `restore_alto_files`. It reads archive **tape images**, unpacks Alto Dump/Load files and disk images, and generates browsable web pages, including viewers for **Bravo** and **Press** files. — [CHM blog (search snippet)](https://computerhistory.org/blog/xerox-alto-source-code/); [McJones, Dusty Decks, 24 Oct 2014 (search snippet)](https://mcjones.org/dustydecks/archives/2014/10/24/784/)
- **Contents.** About **15,000 files**: the Alto OS; BCPL, Mesa and portions of Smalltalk environments; Bravo, Draw and Laurel; fonts and printing software; and server software including **IFS** and **Grapevine**. — [McJones Dusty Decks (search snippet)](https://mcjones.org/dustydecks/archives/2014/10/24/784/)
- **What is actually in it (per a 2026 survey of both CHM Xerox archive sites):**

  | Tree | Contents |
  |---|---|
  | `indigo/altosource` | 1,559 files, 634 BCPL |
  | `indigo/bravox` | BravoX sources, 1979–81 |
  | `indigo/altofonts` | 610 font files |
  | `Filene/Smalltalk-76` | the Smalltalk-76 release |
  | `Smalltalk14.bfs` | installed Alto Smalltalk disk with the Dec 1980 Smalltalk-80 V1 image |
  | `_cd8_/altodocs` | 1976–83 docs in Press and tty format |
  | `Io/Murray` | 50 boot files incl. the games |
  | `indigo/cslcopydisk` | three `.altodisk` images including a games pack |

  No Smalltalk-78 is present. — [xerox-dorado archive survey](https://github.com/alanswx/xerox-dorado/blob/main/docs/xerox-systems-archive-survey.md)
- **Later, larger release.** CHM later published a larger PARC file-server archive at xeroxparcarchive.computerhistory.org. McJones's 2023 post is titled "Xerox PARC IFS archive". — [Xerox PARC source code (search result)](https://xeroxparcarchive.computerhistory.org/Xerox_PARC_source_code.html); [McJones 2023 (search result)](https://mcjones.org/dustydecks/archives/2023/05/10/1214/)
- **Running it today.** The ContrAlto emulator (Living Computers Museum; now continued as Contralto2) emulates the Alto I/II, Diablo and Trident disks, Ethernet over UDP, the 5-key keyset, the audio DAC for the Smalltalk music system, and Orbit/Dover printing to PDF. Bitsavers disk images include AllGames, BCPL, Diags, BravoX and Xmsmall (Smalltalk-76). — [ContrAlto readme](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/readme.txt)

### Inferences
- The Bravo and Press viewers in the CHM site mean original Alto documents can be shown as rendered pages, a good source of authentic on-screen text and fonts for the video.

### Gaps
- The CHM pages themselves were blocked. I could not confirm the exact file count, the named curators or co-authors (e.g. whether Al Kossow or David Brock co-authored the blog), or the exact license wording beyond "non-commercial".
- The exact dates of each archive snapshot are unknown beyond "1975–1987".
