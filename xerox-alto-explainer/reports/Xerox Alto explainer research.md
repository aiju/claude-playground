# Thacker's Three-Month Bet Rewired Personal Computing

The Xerox Alto was not the first personal computer and not the first graphical interface. It was the first machine built from the start for the way people use computers now: one person at a page-sized bitmapped screen with a mouse, overlapping windows and WYSIWYG documents, on a network with file servers, email and laser printers. Chuck Thacker began building it on **22 November 1972**, and in **early April 1973** the first unit, nicknamed "Bilbo", put Alan Kay's sketch of Cookie Monster on its portrait display ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). Its engineering secret was thrift. A single 16-bit microcoded processor running at about 5.9 MHz was time-shared among 16 hardware "tasks", doing the work of the CPU and of the display, disk and Ethernet controllers, with the user's own program running as the lowest-priority task ([Xerox Alto II microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)). About **2,000** were built, against 30 originally planned, and roughly 150 of them were at PARC itself. None was ever sold. Lampson judged that a 1974 product version would have cost about **$40,000** and "would have had few buyers" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf)). Xerox earned billions from the laser printer that grew out of the same system, and it opened Ethernet as a standard. Its commercial workstation, the Star, arrived in 1981 at $16,595 a seat and sold only about 25,000 units. Apple, Microsoft, Adobe, 3Com and Sun took the ideas to mass markets, mostly through people who left PARC. Today the Alto survives through restorations, a microcode-level emulator that runs in a browser, and source archives published by the Computer History Museum. For the scriptwriter: the best anecdotes (Cookie Monster, the bet, Dan Ingalls rewriting scrolling in front of Steve Jobs) rest on Kay's first-person history. Many headline numbers, including Star sales, printer revenue, the Futures Day logistics and the Apple share deal, rest only on search-engine summaries and should be checked before recording.

## How far to trust each claim

The research environment blocked most primary-source websites, so the evidence comes in two strengths, and this report keeps them apart.

**Documents read in full:**

| Document | Link |
|---|---|
| Butler Lampson's 1986 history, "Personal Distributed Computing: The Alto and Ethernet Software" | [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf) |
| Alan Kay's "The Early History of Smalltalk" (HOPL-II, 1993) | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| Larry Tesler's 2012 memoir of modeless editing | [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf) |
| The October 1976 *Alto User's Handbook* | [Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf) |
| The ContrAlto emulator source, including Xerox's own Alto II microcode listing (copyright 1979) | [ContrAlto](https://github.com/livingcomputermuseum/ContrAlto) |
| The Living Computers reimplementation of PARC's file server, which carries the original network-boot packet | [IFS repo](https://github.com/livingcomputermuseum/IFS) |
| The ContrAlto 2.0 readme | [Contralto2](https://github.com/jdersch/Contralto2) |
| Ken Shirriff's Ethernet-gateway README | [alto-ethernet-interface](https://github.com/shirriff/alto-ethernet-interface/blob/master/README.md) |
| Verbatim excerpts from Michael Hiltzik's *Dealers of Lightning* (1999), kept in a public book-notes repository | [Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md) |

**Documents known only from search-engine summaries:**

| Kind | Documents |
|---|---|
| Hardware | Thacker et al.'s paper "Alto: A Personal Computer"; Thacker's own hardware history; the Alto Hardware Manual |
| Papers and memos | Lampson's "Why Alto" memo; the 1976 Metcalfe–Boggs Ethernet paper; the Pup paper; the Worm paper |
| Secondary accounts | Shirriff's blog; every claim drawn from CHM, IEEE Spectrum, Wikipedia, Isaacson, *Fumbling the Future* and Gladwell |

**A † after a citation marks a snippet-level source.** Unmarked citations were read in full. Figures labelled "computed" are arithmetic from primary specifications.

Two caveats apply even to the primary tier. Kay and Lampson were participants, writing 13 to 20 years after the events. And Lampson's lists of "descendant" products are his own claims of influence.

## An ARPA-style lab with a copier fortune built the Alto in about four months

### Why Xerox built a research lab

Xerox founded the Palo Alto Research Center in 1970 "at the urging of its chief scientist Jack Goldman" ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). Secondary sources give the opening date as **1 July 1970**, at 3180 Porter Drive ([PARC, Wikipedia](https://en.wikipedia.org/wiki/PARC_(company))†).

Lampson, writing as an insider, says the goal was to develop the "architecture of information". PARC was to lay the technical groundwork for 1980s office products at a time when copiers no longer looked like a high-growth business ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf)).

Hiltzik names two conditions that made the lab possible. The first was the copier near-monopoly's "seemingly limitless cascade of cash". The second was a buyer's market for researchers, as Vietnam-era budgets shrank. One PARC engineer joked that the mission phrase was useful precisely because nobody knew what it meant ([Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md)).

The popular claim that Xerox feared a "paperless office" would kill copiers does not appear in any document read for this report. Only Lampson's softer version is supported: copier growth was slowing, and electronics would reshape the office.

### Taylor's people and Taylor's rules

Physicist George Pake ran PARC. In Lampson's account, he let researchers work without interference from the rest of Xerox. In September 1970 Pake hired **Bob Taylor** to start a Computer Science Laboratory, CSL ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). Taylor had run ARPA's Information Processing Techniques Office and driven the ARPANET effort from 1966 to 1969 ([CHM profile](https://computerhistory.org/profile/robert-w-taylor/)†). CSL was formally co-run by Taylor and Jerry Elkind ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf)), and each man reportedly understood the arrangement differently ([Elkind, Wikipedia](https://en.wikipedia.org/wiki/Jerome_I._Elkind)†).

Taylor's hiring coup came "right after New Years 1971", when most of the failing Berkeley Computer Corporation moved to PARC: Butler Lampson, Chuck Thacker, Peter Deutsch, Jim Mitchell, Dick Shoup, Willie-Sue Haugeland and Ed Fiala ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). Hiltzik adds that BCC's farewell party, on Friday 13 November 1970, drained its petty cash ([Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md)).

Taylor ran the lab through weekly **"Dealer"** sessions, named after Thorp's blackjack book *Beat the Dealer*. One researcher defended an idea against the rest of the room, which was furnished with beanbag chairs ([CHM Revolution: CSL](https://www.computerhistory.org/revolution/input-output/14/348/1868)†; [Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md)). According to Hiltzik, Thacker greeted unsound ideas with an explosive "Bullshit!". Taylor distinguished useless "Class One" disagreements, where neither side can state the other's view, from productive "Class Two" ones, where both can.

Lampson's own lessons were to build systems 5–10 years ahead of commercial feasibility, to use your own systems, and that "there should not be a grand plan". He introduces them with Conway's line: "Systems resemble the organizations that produce them" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf)). Those lessons explain both CSL's creativity and its distance from Xerox's product divisions.

Friction with headquarters began early. Kay recalls that Stewart Brand's 1972 *Rolling Stone* article on PARC caused "a major furor" at head office. It led to badges and limits on publication, which hit hardest at Kay's Learning Research Group. The other computer scientists called that group the "lunatic fringe" ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)).

### Three threads led to the machine

The first thread was Doug Engelbart's NLS. His demonstration on 9 December 1968 showed a mouse, hypertext and shared editing ([Lemelson Center](https://invention.si.edu/invention-stories/mother-all-demos)†). Lampson says it "made a profound impression" on the people who later built the Alto. Bill English had built the first mouse at SRI in 1964 ([SRI](https://www.sri.com/hoi/computer-mouse-and-interactive-computing/)†).

The second thread was Kay's **Dynabook**, a personal, dynamic medium aimed at children. Lampson calls it and the electronic office "ideals to draw us on, not milestones" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf)). Kay's own attempts to build one, KiddiKomp and then the suitcase-sized miniCOM, were knocked down by Elkind in spring 1972. As Kay recalled, PARC had "used too many Green Stamps" getting Xerox to fund MAXC ([Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md)).

That third thread, MAXC, is the origin story behind the origin story. Xerox had bought Scientific Data Systems in 1969, and it would not let CSL buy the DEC PDP-10 that the ARPA research community used ([gunkies: Maxc](https://gunkies.org/wiki/Maxc)†). So CSL built its own PDP-10-compatible time-sharing machine. Work started in February 1971, with an estimate of about a year and under $1 million. Thacker managed the project and Lampson designed the CPU. Ed McCreight's disk controller had no processor of its own. Instead it borrowed idle CPU cycles, which let him "kidnap the processor", in his phrase ([Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md)). That shared-processor trick is the Alto's central idea in embryo.

### "Do you have any money?"

In September 1972, Kay recalls, Lampson and Thacker walked in and asked "Do you have any money?" He had about $230K set aside for Data General Novas and character-generator displays. They offered to build "your little machine" instead.

Kay records three agendas behind the project:

| Who | What he wanted |
|---|---|
| Lampson | A "$500 PDP-10" |
| Thacker | A "10 times faster NOVA" |
| Kay | A "kiddicomp" |

A hostile "Executive X" was away on a corporate task force, so they could "sneak it in". Thacker, meanwhile, "had a bet with Bill Vitic" that he could build "a whole machine in just 3 months" ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). IEEE Spectrum tells it differently. In its version an executive insisted a major hardware system needed 18 months, Thacker said three, and the job took "a little longer than three months, but not much" ([IEEE Spectrum](https://spectrum.ieee.org/xerox-parc)†).

Kay made his own bet that month. He had claimed the most powerful language in the world could be defined in "a page of code". Ted Kaehler and Dan Ingalls told him to "put up or shut up". Kay wrote the design of Smalltalk-72 in two weeks of 4 a.m. sessions, and within days Ingalls had it running on a Nova, coded in BASIC ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)).

### The build, the memo and first light

Thacker started on **22 November 1972**. He and two technicians built everything except the disk interface, which McCreight designed. Kay summarises the result as a roughly 500,000-pixel (606×808) bitmap, a microcode rate of about 6 MIPS and 128K of memory. By his count, the whole machine apart from memory fitted in 160 MSI chips on two cards. "It was beautiful," he writes. Thacker told Kay that the multi-task microcode idea came from a Kay lecture on coroutines; Kay himself credits Wes Clark's TX-2 ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)).

Around Christmas, Executive X came back, discovered the project, "got even more angry and tried to kill it", and Lampson wrote "a masterful defense". Lampson's "Why Alto" memo is dated **19 December 1972**. It argues for building 10–30 Altos at about $10,500 each, originally to give Kay 15–20 "interim Dynabooks" ([Why Alto](https://bwlampson.site/38a-WhyAlto/WebPage.html)†). The date makes it almost certainly the defense Kay describes, though Kay names neither the document nor the executive. Hiltzik portrays Elkind as CSL's resident skeptic, which makes him the natural suspect for "X", but no source read here names him.

In **early April 1973** the first machine, "Bilbo", came up. "Within minutes" it showed its first bitmap picture: the Muppets' Cookie Monster, which Kay had sketched on the group's painting system ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). A photograph from April 1973 shows Larry Clark, Thacker, Kay and McCreight with Bilbo ([historyofcg](https://www.historyofcg.com/pages/xerox-parc/)†). Ingalls then "bootstrapped Smalltalk across", and for months it was the only software on the machine. Kay's $230K bought 15 of the 30 machines originally planned. Executive X, by then a convert, wanted all but two of them for his own lab ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)).

### Key dates

| Date | Event | Basis |
|---|---|---|
| 9 Dec 1968 | Engelbart's NLS demo | [Lemelson](https://invention.si.edu/invention-stories/mother-all-demos)† |
| Jul 1970 | PARC founded (1 July per secondary sources) | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/); [Wikipedia](https://en.wikipedia.org/wiki/PARC_(company))† |
| Sep 1970 | Taylor hired to start CSL | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| Early 1971 | BCC group joins; MAXC work begins in February | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/); [Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md) |
| Sep 1972 | "Do you have any money?"; the bet | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| 22 Nov 1972 | Thacker starts building | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| 19 Dec 1972 | "Why Alto" memo | [Why Alto](https://bwlampson.site/38a-WhyAlto/WebPage.html)† |
| Early Apr 1973 | Bilbo runs and shows Cookie Monster | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| 22 May 1973 | Metcalfe's "Ether" memo | [CHM TDIH](https://www.computerhistory.org/tdih/may/22/)† |
| Mid-1973 | Alto system software begins | [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf) |
| 11 Nov 1973 | Ethernet first runs, 2.94 Mbit/s | [Wikipedia: Ethernet](https://en.wikipedia.org/wiki/Ethernet)† |
| 14 Sep 1974 | Bravo operational (single source) | [Wikipedia: Bravo](https://en.wikipedia.org/wiki/Bravo_(editor))† |
| Early 1975 | Gypsy delivered to Ginn & Co. | [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf) |
| Oct 1976 | *Alto User's Handbook* describes a complete system | [Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf) |
| 10 Nov 1977 | Futures Day, Boca Raton | [IEEE Spectrum](https://spectrum.ieee.org/behind-the-scenes-at-xerox-parcs-futures-day40-years-ago)† |
| 1978 / 1979 / 1980 | Successors Dolphin (~2× an Alto), Dorado (~10×), Dandelion (~3×) | [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf) |
| Dec 1979 | Apple visits PARC | [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf) |
| 27 Apr 1981 | Xerox 8010 Star announced at $16,595 | [Wikipedia: Star](https://en.wikipedia.org/wiki/Xerox_Star)† |

### Who built what

The Alto was a team artifact, and Lampson's attributions are the most reliable map of who did what ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf)). Four of the builders later won the Turing Award: Lampson (1992), Kay (2003), Thacker (2009) and Metcalfe (2022) ([ACM Turing by year](https://amturing.acm.org/byyear.cfm)†). Lampson, Taylor and Thacker shared the 1984 ACM Software System Award for the Alto ([CHM Revolution](https://www.computerhistory.org/revolution/input-output/14/347)†).

| Person | Alto-era role | Afterwards |
|---|---|---|
| Chuck Thacker | Hardware lead; MAXC logic; Sil drawing program; named on the Ethernet patent | DEC SRC, Microsoft Research; died 2017 ([CACM](https://cacm.acm.org/news/in-memoriam-charles-p-chuck-thacker-1943-2017/)†) |
| Butler Lampson | "Why Alto"; system architecture; Alto OS; Bravo co-design; EARS/Dover/Interpress designs | DEC SRC, Microsoft |
| Alan Kay | Dynabook vision; first budget; Smalltalk-72; Cookie Monster | Atari 1981–84, Apple 1984, Disney 1997 ([Wikipedia](https://en.wikipedia.org/wiki/Alan_Kay)†) |
| Bob Taylor | Founded and ran CSL, 1970–83 | DEC SRC; died 2017, aged 85 ([Naughton](https://medium.com/@jjn1/bob-taylor-the-man-who-funded-the-arpanet-is-dead-at-85-d93fe234c189)†) |
| Ed McCreight | Disk interface; B-tree package used in IFS | — |
| Dan Ingalls, Adele Goldberg, Diana Merry, Ted Kaehler | Smalltalk implementation, BitBlt, teaching, Smalltalk-76/80 | Ingalls built the Smalltalk Zoo |
| Larry Tesler, Tim Mott | Gypsy (modeless editing, cut/copy/paste); Smalltalk browser (Tesler) | Tesler joined Apple in July 1980 ([HandWiki](https://handwiki.org/wiki/Biography:Larry_Tesler)†) |
| Charles Simonyi, Tom Malloy | Bravo; BravoX (Simonyi) | Simonyi to Microsoft in 1981, where he began Word ([CHM](https://computerhistory.org/profile/charles-simonyi/)†) |
| Bob Metcalfe, David Boggs | Ethernet; Pup; FTP, WFS and IFS (Boggs) | Metcalfe founded 3Com (1979); Boggs moved to DEC and died in 2022 ([Register](https://www.theregister.com/2022/03/01/david_boggs_obituary/)†) |
| Gary Starkweather, Ron Rider | SLOT/EARS laser printing | — |
| Bob Sproull, William Newman, Patrick Baudelaire | Press format, Chat, Orbit (Sproull); Markup (Newman); Draw and Fred (Baudelaire) | — |
| Chuck Geschke, John Warnock | Mesa (Geschke); Interpress assistance (Warnock) | Founded Adobe in December 1982 ([CHM](https://computerhistory.org/blog/postscript-a-digital-printing-press/)†) |

## One microcoded engine did the work of a CPU and five controllers

The Alto's defining engineering choice was to have almost no controllers. There is one 16-bit microprogrammed processor. The Nova-like instruction set that programmers saw is just one microcode program running on it, called the "emulator". The display, disk, Ethernet, memory refresh and mouse are other microcode programs that share the same ALU cycle by cycle.

For viewers, the right mental model is that the Alto is an I/O engine that runs your program in its spare time. The figures below come mostly from the Xerox microcode and the ContrAlto emulator source, both read in full. The design rationale comes mostly from snippets of the Thacker et al. paper and the Hardware Manual.

| Subsystem | Key figures | Basis |
|---|---|---|
| Clock | 170 ns microcycle ≈ **5.88 MHz** (computed); every microinstruction takes one cycle | [HW Manual](https://ed-thelen.org/RestoreAlto/AltoHWRefPart1-4-ocr.pdf)†; [ContrAlto Scheduler](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Scheduler.cs) |
| Microstore | 32-bit microinstructions; 1K PROM as standard, up to 1K PROM + 3K RAM | [ContrAlto MicroInstruction](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/CPU/MicroInstruction.cs); [Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)† |
| ALU | 16 bits wide, built from four 74181 4-bit chips | [Shirriff](http://www.righto.com/2016/06/y-combinators-xerox-alto-restoring.html)† |
| Tasks | 16 priority levels, about 10 used by the standard microcode | [Xerox microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu); [Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)† |
| Memory | 64K 16-bit words = **128 KB**, 850 ns cycle; Alto II XM up to 256K words = 512 KB | [HW Manual](https://ed-thelen.org/RestoreAlto/AltoHWRefPart1-4-ocr.pdf)†; [ContrAlto Memory](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Memory/Memory.cs) |
| Display | **606×808** visible (608 bits stored per line); 875-line interlaced raster, 60 fields / 30 frames per second; full-screen bitmap ≈ 60 KB (computed) | [ContrAlto DisplayController](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Display/DisplayController.cs); [Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)† |
| Display cost | About **60% of all cycles** and about 15 Mbit/s of memory bandwidth | [Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)†; a microcode count comes out close |
| Disk | Diablo Model 31, 14-inch removable pack; 203 cylinders × 2 heads × 12 sectors × 512 bytes ≈ **2.5 MB** (computed); 40 ms per revolution | [ContrAlto DiskPack](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/IO/DiskPack.cs); [DiskController](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/IO/DiskController.cs) |
| Ethernet | **2.94 Mbit/s** = one bit per two microcycles (computed); Manchester coding; 16-word FIFO | [Shirriff](http://www.righto.com/2017/11/fixing-ethernet-board-from-vintage.html)†; [Wikipedia](https://en.wikipedia.org/wiki/Ethernet)† |
| Input | Memory-mapped keyboard; three-button ball mouse counted in microcode; five-key chord keyset | [ContrAlto Keyboard](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/IO/Keyboard.cs); [Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf) |

### The "CPU" is itself a program

The whole machine runs in lockstep to a clock of about 170 ns, and every microinstruction takes exactly one cycle ([Alto Hardware Manual](https://ed-thelen.org/RestoreAlto/AltoHWRefPart1-4-ocr.pdf)†). ContrAlto uses the same 170 ns time step ([Scheduler.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Scheduler.cs)). That gives about 5.9 million microinstructions per second, shared among every device and the user's program (computed), which matches Kay's "about 6 MIPS".

Each 32-bit microinstruction is a very wide command. ContrAlto decodes it into the fields below ([MicroInstruction.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/CPU/MicroInstruction.cs)).

| Field | Bits | What it does |
|---|---|---|
| RSELECT | 5 | Chooses a register |
| ALUF | 4 | Chooses one of 14 defined ALU functions |
| BS | 3 | Chooses the bus source |
| F1, F2 | 4 each | Special functions |
| LoadT, LoadL | 1 each | Load the T and L registers |
| NEXT | 10 | Address of the next microinstruction |

There is no microprogram counter that steps through the code. Every microinstruction names its own successor in the NEXT field, and a branch works by ORing condition bits into that address.

The standard control store is 1,024 microinstructions held in eight 1K×4 PROM chips ([Shirriff, day 5](http://www.righto.com/2016/09/xerox-alto-restoration-day-5-smoke-and.html)†). Later machines added writable RAM, up to 1K PROM plus 3K RAM ([Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)†).

The machine code programmers saw was a Data General Nova-style instruction set. It was interpreted by task-0 microcode that Xerox's listing labels `NOVEM` and heads "NOVA EMULATOR". The listing also adds instructions found only on the Alto ([Xerox Alto II microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)):

| Instruction | Purpose |
|---|---|
| BITBLT | Graphics |
| MUL, DIV | Multiply and divide |
| Block transfers | Memory copies |
| JMPR, RDRM, WTRM | Jump into, read and write microcode RAM |
| Extended-memory loads and stores | Access to the larger Alto II XM memory |

BCPL programs therefore compile to Nova instructions, which the Alto executes in microcode ([Shirriff, Mandelbrot](http://www.righto.com/2017/06/one-hour-mandelbrot-creating-fractal-on.html)†). Mesa, Smalltalk and Lisp each loaded their own instruction set into the RAM, which holds "about a thousand microinstructions" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

### Sixteen tasks switch with zero overhead

The micromachine is shared by **16 fixed-priority tasks**. The emulator, which runs the user's program, has the lowest priority ([Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)†). Xerox's own reset table in the microcode confirms the arrangement ([microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)).

The mechanism is simple. A device asks for service by raising its task's wakeup line. The running microcode gives up the processor by executing `TASK`. A priority encoder looking at all 16 wakeup lines chooses the winner, and the switch takes effect after the next microinstruction ([ContrAlto CPU.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/CPU/CPU.cs)). Nothing is saved on a switch. Each task has its own microprogram counter, and by convention it keeps its state in its own registers.

This is why the Alto needs so little controller hardware. The devices keep only small buffers and wakeup logic, and all sequencing, address arithmetic and protocol handling is microcode on the shared ALU.

| Priority | Task (octal number) | Job |
|---|---|---|
| 1 (highest) | KWDX, disk word (16) | One wakeup per disk word; a late word is lost for good |
| 2 | PART, parity (15) | Memory errors |
| 3 | DVT, display vertical (14) | Once per field: restart the display list, raise the 60 Hz interrupt |
| 4 | DHT, display horizontal (13) | Once per scanline: walk the chain of display control blocks |
| 5 | CURT, cursor (12) | Load the cursor's X position and 16-bit row |
| 6 | DWT, display word (11) | Move bitmap words into a 16-word FIFO |
| 7 | MRT, memory refresh (10) | DRAM refresh, plus mouse, interval timer, calendar clock and cursor fetch |
| 8 | EREST, Ethernet (7) | Packet input and output |
| 9 | KSEC, disk sector (4) | Once per sector |
| 10 (lowest) | NOVEM, emulator (0) | The user's program, which gets whatever is left |

The display is the biggest consumer by far. The paper says a full-screen display takes about 60% of all cycles ([Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)†). A count from the microcode lands close to that. One scanline is 224 microcycles long, and the display word task takes 3 cycles per word × 38 words, about **51%** of the line. The line task adds 11 cycles, or 17 when it moves to a new control block. The cursor task adds 2 and MRT roughly 10–15.

That leaves the user's program about 40% of the machine during visible lines, and more during vertical blanking (computed from the [microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)). Hiltzik's shorthand is that the display slowed the processor by roughly a factor of three ([Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md)). Shirriff notes that programs run much faster with the display turned off ([Shirriff, Mandelbrot](http://www.righto.com/2017/06/one-hour-mandelbrot-creating-fractal-on.html)†).

### Memory: 128 KB, refreshed by software

The standard Alto has 64K words of 16 bits, which is 128 KB, with an 850 ns memory cycle ([HW Manual](https://ed-thelen.org/RestoreAlto/AltoHWRefPart1-4-ocr.pdf)†). That is five microinstruction times (computed).

| Model | Memory chips | Capacity | Error checking | Basis |
|---|---|---|---|---|
| Alto I | Intel 1103 (1 Kbit) on 16 boards | 128 KB | Parity | [Shirriff](http://www.righto.com/2016/06/y-combinators-xerox-alto-restoring.html)† |
| Alto II | 4 Kbit chips (implied by the microcode's refresh variants; part number unconfirmed) | 128 KB | ECC | [gunkies](https://gunkies.org/wiki/Xerox_Alto)† |
| Alto II XM | Eighty 4116 (16 Kbit) chips per board, four boards | Up to **512 KB** | ECC | [Shirriff](http://www.righto.com/2016/06/y-combinators-xerox-alto-restoring.html)† |

The XM switches between memory banks. Each task has its own bank register, starting at octal 177740, so the display can point at a different bank from the user's program ([ContrAlto Memory.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Memory/Memory.cs)).

Refresh is also done in software. The refresh task wakes about every 37 µs and makes two dummy references to refresh DRAM rows. A 1977 change-log line in the microcode reads "Modified MRT to refresh 16K chips" ([microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)). Lampson calls the limited address space and memory size the Alto's "most serious deficiency" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf)).

### A page-shaped screen drawn from main memory

The portrait screen shows **606×808** pixels and is about the size of an 8.5×11-inch sheet. Each line is stored as 38 words, or 608 bits, of which about 606 are visible, which is why sources give both numbers ([Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)†; [ContrAlto](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Display/DisplayController.cs)). The monitor is an 875-line interlaced raster at 30 frames per second, drawn as 60 fields. The paper says users mostly accepted the flicker ([Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)†).

The clock appears to have been chosen to fit the display. ContrAlto's scanline lasts 38,080 ns, which is exactly 224 × 170 ns. At 60 fields a second that implies 875.4 lines per frame (computed). This supports the paper's 875 over a "901 line" figure found in an earlier design document.

There is no frame buffer. The picture lives in ordinary main memory, described by a chain of **display control blocks**, each covering a band of lines. Three tasks walk the chain ([microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)). Once per field, the vertical task reloads the head of the chain from a fixed low-memory address. Once per line, the horizontal task counts down lines, follows links, and reads each band's left margin and width. Whenever the 16-word FIFO has room, the word task pushes bitmap words into it, two per memory reference.

A full-screen bitmap is 30,704 words, or 61,408 bytes. That is 47% of a 128 KB machine, which matches the paper's "about half". Painting it 30 times a second takes about 14.7 Mbit/s of memory bandwidth, against the paper's 15 Mbit/s (both computed). Programs could get memory and cycles back by showing fewer or narrower bands, which is why Alto software often used only part of the screen.

The cursor is a 16×16 bitmap kept in memory. Its task is just two microinstructions long, and hardware mixes the cursor row into the video ([ContrAlto Debugger.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/UI/Debugger.cs); [microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)).

### BitBlt made bitmaps usable

Windows, proportional fonts, menus and scrolling all come down to one operation: move a rectangle of bits and combine it with what is already there. Wikipedia credits **BitBlt** to Dan Ingalls, Larry Tesler, Bob Sproull and Diana Merry, in November 1975, for Smalltalk ([Wikipedia: Bit blit](https://en.wikipedia.org/wiki/Bit_blit)†). Lampson says Ingalls designed it, and Kay says Merry built an early version for variable-pitch fonts ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf); [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). The script should name both.

In Xerox's microcode, BITBLT is a single emulator instruction. A header note records a fix by Ingalls on 6 September 1977. Comments describe "4 SOURCES, 4 FUNCTIONS" and separate left-to-right and right-to-left loops, so that overlapping copies come out right ([microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)). Lampson lists its modes: constant black or white, copy, merge ("adding black ink") and XOR, plus a 4×4 texture for greys.

### A disk that can rebuild itself

The disk is a **Diablo Model 31**, taking a removable 14-inch cartridge of about 2.5 MB ([Thacker et al.](https://bwlampson.site/25-Alto/25-AltoOCR.htm)†). Its geometry is 203 cylinders × 2 heads × 12 sectors of 256 words, which is 2,494,464 bytes. The later Diablo 44 doubles the cylinders, to about 5 MB ([ContrAlto DiskPack.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/IO/DiskPack.cs)). ContrAlto, citing the manual, uses 40 ms per revolution, which is 1,500 rpm.

Every sector holds three records, each with its own checksum: a 2-word header, an 8-word **label** and 256 words of data ([DiabloDrive.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/IO/DiabloDrive.cs)). The label records which file and page the sector belongs to, and it is checked on every transfer. Disk addresses are therefore only hints, and a wrong one is caught.

The Scavenger can rebuild the whole file system from the labels in about a minute. Lampson says losing data, other than to physically damaged bits, was "essentially unheard of" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)). Two microcode tasks do the controller's work, one per sector and one per word. The word task has the highest priority in the machine.

### Ethernet at an odd speed; keyboard and mouse as memory

The experimental Ethernet ran at 2.94 Mbit/s. That odd rate is simply the Alto clock divided by two: one bit every 340 ns (computed). ContrAlto's figure of about 5.4 µs per 16-bit word matches it ([EthernetController.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/IO/EthernetController.cs)).

The board does Manchester encoding and buffers data in a 16-word FIFO built from four Intel 3101A chips ([Shirriff](http://www.righto.com/2017/11/fixing-ethernet-board-from-vintage.html)†). One microcode task drives it. The board connects by cable to an external transceiver box on the coax, using three signal paths: data out, data in and a collision line ([alto-ethernet-interface README](https://github.com/shirriff/alto-ethernet-interface/blob/master/README.md)).

The keyboard needs no task at all. It appears as four memory words at octal 177034–177037, and programs poll it ([Keyboard.cs](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/IO/Keyboard.cs)). The mouse needs no controller either. The refresh task, which wakes every few tens of microseconds anyway, reads the mouse's motion bits and updates X and Y words in memory; its comment reads "START THE FETCH OF THE COORDINATES" ([microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)).

The 1976 handbook describes the mouse as "the small white object with three black buttons". The buttons are named RED, YELLOW and BLUE, and it tells users to spin the ball with a finger if the cursor sticks. That confirms ball mice were in use by 1976 ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)). A secondary source credits Jack Hawley and Bill English with a 1972 ball design ([hascomuter blog](http://hascomuter.blogspot.com/2012/10/the-ball-mouse-and-xerox.html)†). Whether the very first 1973 mice used a ball or wheels is unknown.

The five-key chord keyset came from Engelbart's lineage. The emulator readme dismisses it in four words: "(It never caught on.)" ([ContrAlto readme](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/readme.txt)).

### The cabinet and the boot ritual

The Alto is a floor-standing cabinet about the size of a dorm mini-fridge. The Diablo drive loads from the front, with four blue switching power supplies and the card cage behind ([Shirriff](http://www.righto.com/2016/06/y-combinators-xerox-alto-restoring.html)†). The power-supply control circuits are built from discrete parts, three boards per supply ([Shirriff day 1](http://www.righto.com/2016/06/restoring-y-combinators-xerox-alto-day.html)†).

The Alto II was a denser, easier-to-build re-engineering, with ECC, extended memory and more microstore. Its microcode descends from a file dated August 1976, which suggests the Alto II appeared around 1976; that date is inferred ([microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu)).

The 1976 handbook describes the boot ritual. You load the pack, flip the drive's switch from LOAD to RUN, wait "about a minute" for the yellow RUN light, and press the small button on the back of the keyboard. Holding certain keys while booting loads software over the Ethernet instead. Backspace plus the top two blank keys fetches the Scavenger, while backspace alone brings up "the dancing white square of the memory diagnostic" ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)). The story that people needed their nose to hold down enough keys rests only on a Hacker News comment ([HN](https://news.ycombinator.com/item?id=12198291)†).

## Software squeezed a whole office into 128 kilobytes

By October 1976 the *Alto User's Handbook* documented a complete system: an operating system, a display editor, three illustrators, high-quality printing, shared files and mail over the network, and two programming languages ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf); [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)). Lampson dates most of it to 1973–78, with major extensions through 1983.

### An operating system that gets out of the way

The **Alto OS** was designed by Lampson and built in BCPL with Gene McDaniel, Bob Sproull and David Boggs. It derives from Stoy and Strachey's OS6. It deliberately has no multiple processes, no virtual memory and no protection ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)). Lampson singles out three distinctive ideas.

| Idea | What it meant |
|---|---|
| Open design | Any part can be replaced. A "junta" call discards whatever OS packages a program doesn't need, so the program can take over nearly the whole machine. The system offers services but never claims the machine's resources for itself. |
| World-swap | The entire machine state is written to disk and another state restored, in about two seconds. It was used for booting, checkpoints, debugging and switching tasks. |
| Labelled file system | Runs the disk at its full rate of about 1 Mbit/s, and is routinely repaired by Jim Morris's Scavenger. |

The disk format and network protocols fixed by the BCPL OS did not change after 1976. They were the only things all the language environments shared.

Users saw the OS through the **Executive**, a command line with a ">" prompt. A status banner showed the OS version, the machine's number and the disk's name. It supported wildcards, ESC for file-name completion, and `.cm` command files. Holding left SHIFT and striking the blank "SWAT" key aborted a program; adding CTRL dropped into the Swat debugger ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)).

### Four languages, each with its own instruction set

Each language environment had its own microcoded instruction set, compiler, debugger and runtime. They talked to each other only through world-swap and the file system ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

| Language | Lampson's account |
|---|---|
| BCPL | "C's immediate ancestor", ported by Jim Curry. It dominated until 1977; by 1978, new programs were written "almost entirely" in other languages. |
| Mesa | Begun in 1971 by Jim Mitchell, Chuck Geschke and Ed Satterthwaite. It reached the Alto in 1975 and Xerox's product division adopted it in 1976. It had strong type-checking across separately compiled modules, interfaces kept apart from implementations, and 1–3-byte instructions. Several systems exceeded 250,000 lines by 1982. |
| Lisp | Peter Deutsch and Willie-Sue Haugeland's Alto Interlisp worked but was too slow for lack of memory. It thrived only later, as Interlisp-D on the Dorado. |
| Smalltalk | See below. |

Niklaus Wirth's 1976 sabbatical at PARC fed into Modula-2 ([Wikipedia](https://en.wikipedia.org/wiki/Modula-2)†). The claim that Mesa shaped Java has no primary source in these notes.

### Smalltalk invented the look of the modern desktop

Ingalls brought Smalltalk-72 up on the Alto. Kay reports that Lampson called it "majestic", meaning slow, but Ingalls made at least 80 major releases over ten years ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). The first Alto project was **overlapping windows**, built with Diana Merry. Fully draggable windows, which Kay calls "2½D", proved too slow, and the team settled on a cheaper "2¼D" style.

Lampson states that Smalltalk "was the first system to use overlapping windows and pop-up menus" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)). The first pop-up menu was Ingalls's short column of cut, copy, paste and undo. It was partly inspired by the pop-up icon grids in William Newman's Markup, and it grew into today's context menu ([Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)). Tesler built the class browser, which he calls an ancestor of today's IDEs.

Smalltalk-74 added the OOZE object virtual memory, which swapped objects through 80 KB of working storage. Smalltalk-76 was rebuilt from scratch in seven months by Ingalls, Dave Robson, Ted Kaehler and Merry, and ran to about 50 classes in some 180 pages of source. Kay reprints Ingalls's window code, which gives windows 2-pixel frames and inverted black title tabs, with a scroll bar that appears only while the cursor is inside ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)).

Desktop icons were not an Alto Smalltalk feature. David Canfield Smith's 1975 PYGMALION thesis introduced iconic programming, but icons on a desktop belong to the Star ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/); [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

Smalltalk's most striking users were children from Palo Alto schools, taught from summer 1973 by Adele Goldberg's group ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)):

| Child | Age | What they built |
|---|---|---|
| Marian Goldeen | 12 | A full painting system |
| Susan Hamet | 12 | An object-oriented illustration system, designed much like the later MacDraw |
| Bruce Horn | 15 | Music score capture |
| Steve Putz | 15 | A circuit-design system |

Kay himself calls this "early success syndrome", since the schools were far from average.

Other demos from the period make good footage. Steve Purcell animated **80 ping-pong balls and 10 flying horses at 10 frames per second** in fall 1973, and Bob Shur and Chuck Thacker coaxed **12 real-time voices** of synthesized music from the machine. Early Altos crashed "once or twice a day", and the team blamed "cosmic rays" ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)).

Lampson adds a useful corrective: most Smalltalk users still wrote papers in Bravo and read mail in Laurel.

### Bravo gave us WYSIWYG, Gypsy gave us cut and paste

**Bravo** was designed by Lampson and Charles Simonyi. The 1976 manual says it was "implemented mainly by Tom Malloy" ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)), while Lampson credits "Simonyi, Tom Malloy, and a number of others". Lampson calls it probably the most widely used Alto application. A single source says it went into use on 14 September 1974 ([Wikipedia: Bravo](https://en.wikipedia.org/wiki/Bravo_(editor))†).

Its engine, the **piece table**, is a good hook for technical viewers ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)). A document is a table of descriptors, each pointing at a stretch of *immutable* text in a file. Replacing a word splits one descriptor into three: the text before, the new characters (written to a scratch file as they are typed), and the text after. Finding a position is a binary search over the pieces, so the cost grows only with the logarithm of the number of edits, and editing speed does not depend on document size. Formatting lives in runs attached to pieces, so italicising a 60,000-character document takes only a few instructions per piece. The screen is cached as one bitmap per line, and only lines whose characters changed are redrawn.

The interface, however, was modal. You selected text, then typed a one-letter command such as **I**nsert, **A**ppend, **R**eplace or **D**elete, and pressed ESC to finish ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)). Lampson himself calls the interface "clumsy".

**Gypsy**, by Larry Tesler and Tim Mott for Xerox's textbook publisher Ginn & Co., took Bravo's source code and replaced its modal interface with a modeless one. You clicked to place a blinking insertion point, dragged to select, double-clicked to select a word (Mott's idea), and cut, copied and pasted. It was finished in **early 1975**. A 1981 study found that experienced Gypsy users needed about two-thirds of the time NLS users took. Tesler thinks the phrase "copy and paste" originated with Gypsy ([Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf)).

Bravo's line runs through Simonyi's BravoX (1979) to Simonyi's move to Microsoft in 1981 and the announcement of Multi-Tool Word in 1983 ([Wikipedia: Microsoft Word](https://en.wikipedia.org/wiki/Microsoft_Word)†). Lampson says Word was "derived" from Bravo. Simonyi and Richard Brodie describe Word as written from scratch on similar principles ([VC&G interview](https://www.vintagecomputing.com/index.php/archives/1165/vcg-anthology-interview-charles-simonyi-and-richard-brodie-creators-of-microsoft-word-2008)†).

### Mail, drawing and fonts

The everyday tools are described by Lampson ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

| Program | Author | What it did |
|---|---|---|
| Laurel (mail) | Doug Brotz, Roy Levin, Mike Schroeder, Ben Wegbreit | Three stacked panes: message list, reader and composer. Deleted messages were struck through until exit. The interface took about a man-year of design, and most users never read the manual. A variant, Cholla, ran a chip-fabrication line. |
| Markup | William Newman | The first Alto illustrator; Lampson calls MacPaint "quite similar" |
| Draw | Patrick Baudelaire | Lines, splines and arrows |
| Sil | Chuck Thacker | Logic diagrams. It erased by redrawing in white ink. "Somewhat to everyone's surprise", it became the illustrator of choice whenever no curves were needed. |
| Fred | Patrick Baudelaire | Font design: a TV camera captured letterforms and splines were fitted to them |

The Bravo summary sheet in the 1976 handbook is itself a Sil drawing ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)). No program combined text and graphics, because the machine was too small. Lampson also notes that nobody thought of the spreadsheet.

Fonts were hand-tuned bitmaps of about 30 KB per typeface. Three families in four styles and nine sizes already makes 108 typefaces ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)). Bravo's standard set in 1976 was TimesRoman, Helvetica, the fixed-pitch Gacha, Math, the Greek Hippo, and a Logo font that spelled XEROX ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)).

### Games arrived with the network

The headline game is **Maze War**. Steve Colley, Greg Thompson and Howard Palmer wrote it on Imlac terminals at NASA Ames in 1973, and PARC's Alto version 2.0 (1977) ran over the Pup protocol ([mazewar-vr README](https://github.com/marciot/mazewar-vr)). **Alto Trek**, by Gene Ball and Rick Rashid at the University of Rochester, put each player in command of a starship from their own Alto. It is dated to 1978 or 1979 ([Wikipedia: Alto Trek](https://en.wikipedia.org/wiki/Alto_Trek)†).

The CHM archive holds boot files for Galaxian (dated 17 September 1981), Invaders, PinBall, "Polish Pong", Missile Command, AstroRoids and Trek, plus a 1985 games disk that includes a Pac-Man clone ([archive survey](https://github.com/alanswx/xerox-dorado/blob/main/docs/xerox-systems-archive-survey.md)). The arcade clones should be framed as hobby programs from 1979–82, not as 1970s research.

### A day with an Alto

"Personal" was literal. You collected a disk pack, which the handbook says was about 15 inches across, from the yellow cabinet in the MAXC room, room 1153, and signed for it. You ran `>CopyDisk` from the "Basic Non-programmer's Disk", which took about two minutes while counters near the top of the screen counted to 406 twice. Then you wrote your name on the label and carried the pack to any free Alto. At the end of the day you typed Quit and left the screen blank except for a jumping white square, which was the memory test ([Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf)).

Lampson justified giving one person a whole computer by turning the time-sharing maxim around: "people are fast, and machines are slow" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

## Ethernet, Pup and laser printers made the Alto a distributed system

Lampson's own name for the achievement is "personal distributed computing". The unit was never the box alone. It was Altos plus Ethernet, file, print and name servers, and gateways, and Lampson calls networked printing the most complex service in that system ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

### From ALOHA to Ethernet

On 22 May 1973 Bob Metcalfe sent a memo proposing that "the ALTO ALOHA Network" be renamed "The ETHER Network" ([CHM This Day in History](https://www.computerhistory.org/tdih/may/22/)†). The name refers to the discredited 19th-century luminiferous ether, chosen because the protocol was not tied to any one medium ([DEV](https://dev.to/fluidwire/why-ethernet-is-named-after-a-physics-myth-44ae)†). It first ran on **11 November 1973** at 2.94 Mbit/s ([Wikipedia](https://en.wikipedia.org/wiki/Ethernet)†).

In ALOHAnet, the radio network Metcalfe had studied, stations transmitted whenever they liked, so at most about 18.4% of the channel was usable ([Pennings](https://apennings.com/how-it-came-to-rule-the-world/the-lasting-impact-of-alohanet-and-norman-abramson/)†). Ethernet made three changes. Stations listen before sending. They stop the moment they detect a collision. And they wait a random time whose range doubles after each collision.

The patent, US 4,063,220, was filed in 1975 and granted in 1977 to Metcalfe, Boggs, Thacker and Lampson. It describes a transceiver at each tap that compares what it is sending with what is actually on the cable and treats any mismatch as interference, which is collision detection in hardware ([Google Patents](https://patents.google.com/patent/US4063220A/en)†). Metcalfe reportedly insisted that Lampson and Thacker be named ([Wikipedia: Boggs](https://en.wikipedia.org/wiki/David_Boggs)†). Metcalfe and Boggs's July 1976 *CACM* paper drew on a working network of 100 nodes along a kilometre of coaxial cable ([ACM DL](https://dl.acm.org/doi/10.1145/360248.360253)†).

Station addresses on this experimental Ethernet were 8 bits ([intronetworks](https://intronetworks.cs.luc.edu/1/html/ethernet.html)†). Metcalfe left in June 1979 to found 3Com. DEC, Intel and Xerox published the 10 Mbit/s "DIX" Blue Book, with 48-bit addresses, on 30 September 1980, and IEEE 802.3 followed on 23 June 1983 ([Wikipedia](https://en.wikipedia.org/wiki/Ethernet)†; [Computer Weekly](https://www.computerweekly.com/news/252489944/How-Ethernet-became-the-worlds-networking-standard)†).

### Pup: an internet before the Internet

**Pup** (PARC Universal Packet) was designed by Metcalfe and implemented with Boggs and Ed Taft ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

| Level | What it carried |
|---|---|
| 0 | Transports: Ethernet, the ARPANET, leased lines |
| 1 | Internet datagrams |
| 2 | Byte streams, routing and connection setup |
| 3 | FTP, Chat (remote terminal) and mail conventions |

Lampson calls the datagram the "common coin": every link carried the same end-to-end packet, and gateways did the job of ARPANET IMPs. Delivery was best-effort, and routers relieved congestion by dropping packets. Byte streams moved about 0.3 Mbit/s between two Altos, which Lampson calls an order of magnitude better than typical implementations of the time.

The 1979–80 Pup paper reports an operating internet of **about 1,000 computers on 25 networks of 5 types, joined by 20 gateways** ([Semantic Scholar](https://www.semanticscholar.org/paper/Pup:-An-Internetwork-Architecture-Boggs-Shoch/741882d8dfa32605b10187709d219f43f662c3e5)†).

There is a good story about the TCP/IP designers. At an international networking working group (INWG) meeting, Xerox lawyers barred Metcalfe and John Shoch from describing Pup. So they kept finding flaws in the other proposals, until a Stanford participant asked "You guys have already done this, haven't you?" ([Wikipedia: PUP](https://en.wikipedia.org/wiki/PARC_Universal_Packet)†). That source dates the meeting to June 1973, which sits awkwardly with Pup's 1974 design date.

PARC researchers are said to have pushed the TCP designers to split a datagram layer (IP) out of TCP ([History of Computer Communications](https://historyofcomputercommunications.info/section/8.11/TCP-to-TCP-IP-1976-1979/)†). RFC 791 cites Shoch's line "A name indicates what we seek" ([RFC 791](https://www.rfc-editor.org/info/rfc791/)†). Pup grew into Xerox's XNS, which in turn underlay Novell's IPX/SPX and Banyan VINES and influenced AppleTalk's addressing ([Wikipedia: XNS](https://en.wikipedia.org/wiki/Xerox_Network_Systems)†). The script should say Pup "influenced" TCP/IP. The evidence is mostly participants' recollections.

### The laser printer, and page description as a program

Gary Starkweather conceived laser printing at Xerox's Webster, New York lab around 1969. Kay says the idea there was "against the local religion". Starkweather moved to PARC in 1971 and built SLOT on a modified Xerox 7000 copier ([NIHF](https://www.invent.org/inductees/gary-k-starkweather)†; [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)). Next came **EARS**, whose name spells out its parts: Ethernet, Alto, Research character generator, Scanning laser output terminal ([ETHW](https://ethw.org/Milestones:Development_of_the_Commercial_Laser_Printer,_1971-1977)†).

Lampson's description of EARS is vivid. It printed 500 dots per inch at one page per second, on a Xerox 3600 copier engine. It was driven by an Alto plus custom hardware about three times the Alto's size that generated a 25 MHz video signal. It could print 80 pages an hour for every member of a 40-person lab, and "we never used more than a fraction of its capacity" ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

A second EARS became the prototype for the **Xerox 9700**, launched in 1977 at 300 dpi and up to 120 pages per minute ([Wikipedia: 9700](https://en.wikipedia.org/wiki/Xerox_9700)†). Xerox says the 9700 "routinely generated more than $1 billion" in annual revenue ([Xerox Newsroom](https://www.news.xerox.com/news/40-year-anniversay-of-the-Xerox-9700-and-its-innovation)†).

For internal use PARC built about **50 Dover printers**, cheap enough for every group to have one. Each printed at 384 dpi, driven by Sproull and Ornstein's Orbit hardware and the Spruce software. Orbit had no full-page buffer, so Spruce had to compute each band of pixels just ahead of the laser, racing the paper, and it could fail on pages crowded with small characters. Lampson puts the finished PARC printing system at about 40 pages a minute. He also notes that a full-page raster is 10–25 million bits, while the Alto's entire memory is about 1 million ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

The way documents described pages evolved in four steps ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)):

| Interface | Designers | How it worked |
|---|---|---|
| XGP | Peter Deutsch | ASCII text plus control codes; fonts drawn by hand, dot by dot, on a roughly 20×20 grid |
| EARS | Ron Rider | Each document carried the bitmaps of every font it used |
| Press | William Newman, Bob Sproull | Documents named their fonts and the printer stored them, "since font management proved to be too hard for document creators" |
| Interpress (1980) | Sproull and Lampson, with John Warnock | A stack-based language: the document is a program that draws the page |

Xerox kept Interpress proprietary. Warnock and Geschke left and incorporated Adobe in December 1982 to build PostScript, which shipped in Apple's LaserWriter in 1985 ([CHM](https://computerhistory.org/blog/postscript-a-digital-printing-press/)†).

### Servers were Altos too

Almost every server was an Alto with extra hardware attached ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)):

| Server | What Lampson reports |
|---|---|
| MAXC | CSL's Tenex time-sharing machine; served files for the first three years |
| WFS | Boggs's single-packet page server, written in two months on a Data General Nova |
| IFS | Boggs and Taft, using McCreight's B-tree. It ran in a 128 KB Alto driving 300 MB disks. Dozens were installed, and it was the main file server for at least seven years. |
| Juniper | First Mesa server; transactional (1977); too slow on the Alto and little used |
| Grapevine | From 1980, by Birrell, Levin, Needham and Schroeder. Replicated naming, mail and access control; by the mid-1980s it served about 2,000 machines and 7,000 users. |

Machines could also boot over the wire. A server periodically broadcast a **"Breath of Life"** packet to Ethernet host 0377 octal, and the packet itself carried the Alto's network bootstrap code ([IFS repo](https://github.com/livingcomputermuseum/IFS)). A booting Alto just listened for the packet and ran it, which kept its own boot code tiny ([Shirriff](http://www.righto.com/2018/01/xerox-altos-3-mbs-ethernet-building.html)†).

The same machinery let Shoch and Hupp's **Worm** programs, experiments from 1979 published in 1982, spread through idle Altos after hours. They were named after the "tapeworm" in John Brunner's novel *The Shockwave Rider*. One corrupted worm ran out of control and left dozens of machines crashed by morning ([ACM DL](https://dl.acm.org/doi/10.1145/358453.358455)†; [Wikipedia: John Shoch](https://en.wikipedia.org/wiki/John_Shoch)†). Lampson calls the Worm the only truly distributed program in the system apart from the Pup router ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)).

## Xerox cashed in on printing and let the workstation walk out the door

### Xerox showed its executives the future, and bought something else

On **10 November 1977** PARC staged "Futures Day" in Boca Raton for more than 300 Xerox executives and their wives. Hollywood set builders made four mock office cubicles. PARC flew **20 Altos and 6 laser printers** to Florida in space leased on two DC-10s; more than 100 staff worked on the event and about 50 went. The executives' reaction was lukewarm ([IEEE Spectrum](https://spectrum.ieee.org/behind-the-scenes-at-xerox-parcs-futures-day40-years-ago)†). The familiar story that the wives tried the mouse while the executives, who treated typing as secretaries' work, held back is not confirmed by any readable source.

Xerox then made a series of choices that pointed away from the Alto:

| Date | Choice |
|---|---|
| 1976 | John Ellenby's proposed "Alto III" lost to the Dallas office division's own machine. One account says that division's bonuses depended on sales targets that a new product line would have endangered ([Gross](https://dgross.ca/blog/xerox-parc)†). |
| 11 Dec 1979 | The Xerox 860, a dedicated word processor with Ethernet, at $15,300 ([Wikipedia: 860](https://en.wikipedia.org/wiki/Xerox_860)†) |
| Apr 1981 | The **8010 Star**, developed from 1977, at **$16,595** per workstation |
| Jun 1981 | The Xerox 820, a conventional Z80 CP/M computer, at $2,995 ([Wikipedia: 820](https://en.wikipedia.org/wiki/Xerox_820)†) |

A working Star installation needed a workstation, a server and a laser printer, and a base system cost about $75,000 ([FreeDictionary](https://encyclopedia2.thefreedictionary.com/8010+Star)†). The Star sold about **25,000** units. It was closed to outside software and slow, and its file system could need an hours-long scavenge after a crash ([Wikipedia: Star](https://en.wikipedia.org/wiki/Xerox_Star)†). Its designers documented the desktop metaphor of documents, folders and file drawers in *Byte* in April 1982 ([Smith et al.](https://worrydream.com/refs/Smith_DC_1982_-_Designing_the_Star_User_Interface.pdf)†).

Kay adds his own grievance. After 1978 his portable NoteTaker was forced onto the wrong Intel CPU and the wrong display because there was "not enough corporate will", and Xerox declined to fund a better one ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)).

### Apple paid in stock for a look, and left with ideas and people

In Hiltzik's account, Jobs offered in April 1979 to sell Xerox 100,000 pre-IPO Apple shares at $10.50 each, about $1.05 million, in exchange for access to PARC ([Hiltzik column](https://www.arcamax.com/knowledge/scienceandtech/technews/s-4050526)†). Other sources give $10 a share, bought by the Xerox Development Corporation ([Wikipedia: Lisa](https://en.wikipedia.org/wiki/Apple_Lisa)†).

Apple groups visited twice in **December 1979** ([Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf); [Stanford](https://web.stanford.edu/dept/SUL/sites/mac/parc.html)†). The first was a "bowdlerized" demo showing the Alto, its mouse and Bravo. The second was the "full-dress" demo normally reserved for corporate customers ([Hiltzik via AOL](https://www.aol.com/finance/hiltzik-inside-1979-silicon-valley-100000560.html)†). Adele Goldberg objected to showing Smalltalk. She said Xerox was about to "give away the kitchen sink" and agreed to do the demo only if ordered to, which she was ([Wikipedia: Goldberg](https://en.wikipedia.org/wiki/Adele_Goldberg_(computer_scientist))†; [CHM](https://www.computerhistory.org/revolution/artifact/348/1863)†).

Kay's first-hand account is the best scene material. Tesler gave the demo with Ingalls beside him, on a **Dorado**, the Alto's fast successor. Its Smalltalk microcode had been written largely by Bruce Horn, one of the original "Smalltalk kids" and still a teenager. When Jobs disliked the jumpy scrolling, Ingalls found the code and made the scrolling smooth "in less than a minute". Afterwards, Kay writes, Jobs "tried to get and/or buy the technology from Xerox", but Xerox would neither part with it nor fund it internally ([Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/)).

In 1995 Jobs said he had been shown three things: the GUI, object-oriented programming, and a network of more than a hundred Altos with email. He was so struck by the first that he missed the other two, and he knew "within ten minutes" that every computer would one day work that way ([PBS, *Triumph of the Nerds*](https://www.pbs.org/nerds/part3.html)†).

Apple was already moving in this direction. Macintosh documents from fall 1979 planned multiple fonts, graphics and a pointing device ([Mac-History](https://mac-history.net/apple-and-xerox-parc/)†). It also went beyond what it saw. Bill Atkinson believed PARC redrew partly covered windows, which it did not. He then invented **regions** to do exactly that, giving QuickDraw fast overlapping windows; seeing it done, he wrote, "empowered me to invent a way" ([Folklore.org](https://www.folklore.org/I_Still_Remember_Regions.html)†; [Digital Antiquarian](https://www.filfre.net/2018/07/doing-windows-part-6-look-and-feel/)†). In Gladwell's account, Jobs told designer Dean Hovey to build a mouse. Xerox's cost about $300, and Apple wanted one for about $15 ([Cult of Mac](https://cultofmac.com/94194/malcolm-gladwell-takes-on-steve-jobs-and-the-mouse)†). Tesler himself joined Apple in July 1980.

### The diaspora carried the ideas

Most of the commercial value left PARC with people:

| Who | Where | When |
|---|---|---|
| Bob Metcalfe | Founded 3Com | 1979 |
| Charles Simonyi | Microsoft, at Metcalfe's suggestion ([Wikipedia: Word](https://en.wikipedia.org/wiki/Microsoft_Word)†) | 1981 |
| John Warnock and Chuck Geschke | Founded Adobe | 1982 |
| Alan Kay | Atari, then Apple | 1981, 1984 |
| Bob Taylor, then Lampson and Thacker | DEC's Systems Research Center, after Taylor's bitter resignation from PARC ([Register](https://theregister.com/2017/04/17/obituary_bob_taylor)†) | From 1983 |

Andy Bechtolsheim designed the Alto-inspired SUN workstation at Stanford in 1980, after Xerox had donated Altos to universities ([Wikipedia: SUN workstation](https://en.wikipedia.org/wiki/SUN_workstation)†).

Lampson's own list of commercial descendants includes the Apple Lisa and Macintosh, Microsoft Windows and Word, MacPaint and MacDraw, the Sun, Apollo and Perq workstations, IEEE 802.3, TCP/IP, and Adobe PostScript ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)). The link to Tim Berners-Lee is at most indirect. He built the first browser on a NeXT computer in the Smalltalk-influenced Objective-C, but nothing here ties his work to PARC ([CERN](https://worldwideweb.cern.ch/history/)†).

### The lawsuits never settled who copied whom

Apple sued Microsoft in 1988 and lost, largely because of a 1985 licence it had granted for Windows 1.0. The Ninth Circuit affirmed on 19 September 1994 ([Justia](https://law.justia.com/cases/federal/appellate-courts/F3/35/1435/605245/)†). Xerox sued Apple on 14 December 1989 for $150 million, alleging that the Lisa and Macintosh copied the Star. On 23 March 1990 Judge Vaughn Walker dismissed most of the case, mainly because Xerox had waited too long ([UPI](https://www.upi.com/Archives/1990/03/23/Judge-throws-out-bulk-of-Xerox-suit-against-Apple/3021638168400/)†; [Santa Clara HTLJ](https://digitalcommons.law.scu.edu/cgi/viewcontent.cgi?article=1099&context=chtlj)†). Hiltzik's summary is that "both plaintiffs lost" ([Hiltzik via AOL](https://www.aol.com/finance/hiltzik-inside-1979-silicon-valley-100000560.html)†).

Years earlier, when Jobs confronted Gates over Windows in 1983, Gates reportedly replied that they both had "a rich neighbor named Xerox" ([Folklore.org](https://www.folklore.org/A_Rich_Neighbor_Named_Xerox.html)†).

### Why Xerox did not commercialise the Alto

The evidence supports a narrower verdict than "Xerox fumbled the future". Lampson, an insider, concedes the machine was too early. As a 1974 product it would have cost $40,000 "and would have had few buyers", while by 1984 $3,500 bought a PC with four times the memory and disk ([Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/Personal-distributed-computing-The-Alto-and-Ethernet-software-HOPW-book-version.pdf)).

Once prices fell, Xerox's product divisions chose what fitted their own incentives: a word processor from Dallas, a CP/M box, and a Star priced and sold as a copier-style office system, not as a machine a department could buy on its own. Meanwhile Xerox did commercialise the part of PARC that matched how it already made money. The laser printer sold pages and supplies through the existing sales force and, by Xerox's own account, brought in more than $1 billion a year. Xerox also opened Ethernet through the DIX standard.

Hiltzik's *Dealers of Lightning* makes this counter-argument to Smith and Alexander's 1988 *Fumbling the Future* ([MIT Technology Review](https://www.technologyreview.com/1999/07/01/102180/unbottled-lightning/)†). Jobs's jab that Xerox was run by "copier heads" has a real core. But the Star shipped nearly two years before the Lisa, so Xerox was not late with the ideas. It failed on price, openness and fit with its business.

## Restorers, emulators and archives keep the Alto booting in 2026

### Archives

On 21 October 2014 CHM released, with PARC's permission, about 15,000 Alto files from 1975–87 at xeroxalto.computerhistory.org. The collection covers source code, executables, documentation and fonts, for non-commercial use ([CHM press release](https://computerhistory.org/press-releases/xerox-alto/)†; [McJones](https://mcjones.org/dustydecks/archives/2014/10/24/784/)†). Paul McJones's conversion tools make Bravo and Press documents viewable in a browser.

On 10 May 2023 CHM added a much larger PARC file-server archive: nearly **150,000 files, about 4 GB**, covering much of the 1980s. It was built from media that Al Kossow had read years earlier ([CHM, "A Backup of Historical Proportions"](https://computerhistory.org/blog/a-backup-of-historical-proportions/)†).

### Emulators

Josh Dersch's **ContrAlto** emulates the Alto at the microcode level. Paul Allen's Living Computers: Museum+Labs (LCM) introduced it on 2 August 2016. Its Ethernet emulation lets emulated and real Altos exchange mail and play games ([TechCrunch](https://techcrunch.com/2016/08/02/living-computer-museum-restores-xerox-alto-and-debuts-new-emulator)†).

Dersch's **ContrAlto 2.0** (repository created in July 2024) runs on .NET 8 and says it "runs all known software" ([Contralto2](https://github.com/jdersch/Contralto2)). It emulates the Alto I and Alto II XM, Diablo and Trident disks, the keyset, the audio hardware used by the Smalltalk music system, and a Dover printer that outputs PDF. Its beta release page is dated "03 Sep". Given the repository's 2026 copyright footer, that probably means September 2026, but the year is inferred.

**ContrAltoJS**, a beta-quality JavaScript port, boots Alto disks in a browser ([ContrAltoJS](https://github.com/codefrau/ContrAltoJS)). CHM and Dan Ingalls host the **Smalltalk Zoo**, browser emulations covering everything from Smalltalk-72 to Squeak ([CHM](https://computerhistory.org/blog/introducing-the-smalltalk-zoo-48-years-of-smalltalk-history-at-chm/)†).

### Restorations

LCM restored two Altos in 2016 and bridged them to modern PCs ([Paul Allen, Medium](https://medium.com/vulcan-inc/xerox-alto-is-rebuilt-and-reconnected-by-the-living-computer-museum-e56a7e86be91)†).

The best-documented restoration is of Y Combinator's **Alto II XM**, which Kay had given to Sam Altman. The team, from June 2016, was Marc Verdiell (CuriousMarc), Ken Shirriff, Carl Claunch, Luca Severini, Ron Crane and Ed Thelen ([Shirriff](http://www.righto.com/2016/06/y-combinators-xerox-alto-restoring.html)†). The milestones below all come from Shirriff's blog posts, known only from search snippets.

| When | Event |
|---|---|
| Sep 2016 | Smoke poured from the backplane after the ground and +5 V pins of a logic analyzer were swapped ([day 5](http://www.righto.com/2016/09/xerox-alto-restoration-day-5-smoke-and.html)†) |
| Sep 2016 | A single dead inverter in a 7414 chip had stopped the disk sector task; fixed with a "dead bug" rewire ([day 6](http://www.righto.com/2016/09/restoring-ycombinators-xerox-alto-day-6.html)†) |
| Sep 2016 | The boot pack proved to be full of uniformly random bytes, left by a decades-old run of a disk exerciser ([Shirriff](https://www.righto.com/2016/09/restoring-ycs-xerox-alto-how-our-boot.html)†) |
| Sep 2016 | The machine booted ([day 8](https://www.righto.com/2016/09/restoring-ycs-xerox-alto-day-8-it-boots.html)†) |
| Jun 2017 | Shirriff's Mandelbrot took an hour, cut to 9 minutes after reader suggestions ([Shirriff](http://www.righto.com/2017/06/improvements-to-xerox-alto-mandelbrot.html)†) |
| Oct 2017 | Shirriff edited the scrollbar code of a running Smalltalk system ([Shirriff](https://www.righto.com/2017/10/the-xerox-alto-smalltalk-and-rewriting.html)†) |
| Jan 2018 | A BeagleBone gateway spoke 3 Mb/s Ethernet and ran PARC's file-server software, so the Alto could net-boot ([README](https://github.com/shirriff/alto-ethernet-interface/blob/master/README.md)) |
| Jan 2018 | Password protection on 1970s disk packs was cracked, and one pack's original owner turned up in the comments ([Shirriff](http://www.righto.com/2018/01/xerox-alto-zero-day-cracking-disk.html)†) |
| May 2018 | A "cursed" Diablo drive destroyed heads and an alignment pack ([Hackaday](https://hackaday.com/2018/05/10/diablo-drive-appears-to-be-cursed/)†) |

DigiBarn's Alto II XM booted again in Verdiell's lab on 27 May 2021 and ran Alto Trek and Missile Command ([archive.org](https://archive.org/details/digibarn-booting-the-xerox-alto-may-27-2021)†). The Diablo drive is now the machine's weakest link. Shirriff's 2025 replacement, built on a Teensy microcontroller, is "not working yet", according to its own README ([alto-disk-emulator](https://github.com/shirriff/alto-disk-emulator)). Where the Y Combinator Alto is today is unknown.

### Museums and milestones

CHM shows an Alto in its *Revolution* exhibition. The Smithsonian holds an Alto processor, monitor, keyboard and games disk ([NMAH](https://americanhistory.si.edu/collections/object/nmah_334631)†). The DigiBarn Alto runs at the System Source Computer Museum in Maryland ([DigiBarn](https://www.digibarn.com/index.html)†). LCM closed for good in 2024, and its Alto II XM sold at Christie's for **$252,000** to an unknown buyer ([GeekWire](https://www.geekwire.com/2024/auction-of-paul-allen-items-including-vintage-computers-einstein-letter-and-more-brings-in-10m/)†).

On 10 November 2017, 40 years to the day after Futures Day, Alto veterans demonstrated Bravo, Markup, Draw, Laurel and Smalltalk-76 live on a restored machine at CHM ([CHM event](https://computerhistory.org/events/yesterdays-computer-tomorrow-xerox-alto/)†). On 24 April 2023 Xerox announced it was donating PARC to SRI International. Two days later, Lampson and Simonyi, with Kay on video, marked the Alto's 50th anniversary at CHM ([Xerox newsroom](https://www.news.xerox.com/news/xerox-announces-donation-of-palo-alto-research-center-parc-to-sri-international)†; [CHM event](https://computerhistory.org/events/the-legendary-alto-and-research-at-the-edge/)†). IEEE dedicated Milestones for the Alto, Ethernet and the laser printer at SRI PARC on 17 May 2024 ([ETHW](https://ethw.org/Milestones:The_Xerox_Alto_Establishes_Personal_Networked_Computing,_1972-1983)†).

## Where the sources disagree, and the best reconciliation

### Build dates and the bet

Kay, who was there, gives a start of 22 November 1972 and first light in "early April" 1973. He calls that "just a little over three months", but the dates themselves span more than four months. IEEE Spectrum's "a little longer than three months, but not much"† and a secondary source's "four months and nine days" ([DTNS](https://dailytechnewsshow.com/2024/09/05/about-xerox-alto/)†, which lands on about 1 April) fit the dates better. The safe line is that **the bet was three months and the machine took about four**. No source read here says whether the bet was ever settled.

A "first released 1 March 1973" date circulating online ([LinkedIn](https://www.linkedin.com/pulse/xerox-alto-first-released-march-1-1973-mark-f-grogan)†) has no primary support and contradicts Kay.

### Who took the bet

The transcription of Kay's HOPL paper reads "Bill Vitic". Popular retellings, apparently drawing on Hiltzik, give "Bill Vitaliano", but that sentence is not in the Hiltzik excerpts read here. The name, his title and the stake (a "case of wine" appears only on a weak blog) are all unconfirmed. "A Xerox executive" is safe on screen. Check the printed HOPL-II text and *Dealers of Lightning* before naming anyone.

### How many Altos were built

Kay's "some 2000" and Hiltzik's "nearly two thousand", both read in full, agree, so **about 2,000 built** is the figure to use. The finer breakdowns come only from snippets: 120 Alto Is and 2,000 Alto IIs (which would total 2,120), an initial run of 80 by Clement Designlabs, and about 1,000 in use at Xerox plus about 500 at universities by 1979. That last pair is the likely source of a "1,500" figure, which counts machines in use at one time rather than total production. Lampson's "150 Altos at PARC" counts PARC alone. The Pup paper's "about 1,000 computers"† and a figure of "1,350 Altos on 75 Ethernets at 40 sites by 1981" ([ETHW](https://ethw.org/Milestones:Ethernet_Local_Area_Network_(LAN),_1973-1985)†) are snapshots of the network, not production counts.

### The Apple visits

The sources agree on two visits in December 1979. They differ on whether Jobs went to both: Stanford, via Jef Raskin, puts him only on the second. The share price is given as $10.50 (Hiltzik) or $10. Isaacson's figure of $17.6 million at the IPO comes through a quote aggregator. It does not square with 100,000 shares at the $22 IPO price, which comes to $2.2 million, unless pre-IPO stock splits are counted. Check the book before using it.

### Alto or Dorado

Kay, who was present, says the Smalltalk demo ran on a Dorado. Hiltzik says the first, cut-down demo showed the Alto, its mouse and Bravo, and Jobs remembered a network of Altos. The reconciliation: **Apple saw Altos, but the famous Smalltalk scrolling moment happened on a Dorado.** Which version of Smalltalk was shown is unconfirmed.

### Smaller conflicts

| Topic | Versions | Best reading |
|---|---|---|
| Display width | 606 vs 608 pixels | 608 bits stored per line, about 606 visible |
| Scan lines | 875 vs 901 | 875 as built; the timing gives 875.4 |
| Copier base for the laser printer | SLOT on a 7000 (NIHF†) vs EARS on a 3600 (Lampson) | Probably both, for different builds |
| University donation | 1978 vs "late 1979" | Unresolved; about 50 Altos to Stanford, CMU, MIT and Rochester |
| Ethernet memo | 12 or 13 pages; titled "Ether Acquisition", "Alto Ethernet" or neither | Say "the 22 May 1973 memo"; CHM holds the original |
| Mouse patent | Filed 21 or 27 June 1967; granted "17 Jan" or 17 Nov 1970 | Check US 3,541,541 |
| BitBlt credit | Ingalls (Lampson); Merry's early version (Kay); four names (Wikipedia†) | Name Ingalls and Merry, and credit the team |
| First WYSIWYG editor | Bravo, or Tesler's Smalltalk miniMOUSE, which Kay calls "the first real WYSIWYG galley editor at PARC" | Bravo was the first widely used one |
| Bravo implementers | "Mainly Tom Malloy" (1976 manual) vs Simonyi, Malloy and others (Lampson) | Designed by Lampson and Simonyi; built mostly by Malloy and Simonyi |
| Smalltalk-80 on the Alto | "Dorado" (Lampson) vs an archived Alto disk with a December 1980 Smalltalk-80 image | Smalltalk-80 targeted the Dorado; some Alto versions existed |
| Chip count | Kay's 160 MSI chips on two cards vs Shirriff's many separate boards | Kay's figure is a recollection, perhaps of the Alto I processor alone |
| Boot spin-up | About 1 minute to the RUN light (1976 handbook) vs about 20 s (emulator readme) | Use "about a minute" for the period ritual |
| Disk pack size | 14-inch format vs "about 15 inches" (handbook) | A 14-inch cartridge |
| Breath of Life interval | Every second (Shirriff†) vs 5 s (a modern config default) | The historical interval is unverified |
| Taylor's departure | 1983 vs 1984 | Left PARC in 1983; SRC may have opened in 1984 |
| Dallas division | Office Systems vs Office Products | Unresolved |
| Worm damage | "Dozens" vs "more than a hundred" machines | Use "dozens" |
| Alto Trek | 1978 vs 1979 | Say "late 1970s" |
| Disk data rate | 1 Mbit/s (Lampson, effective) vs about 1.66 Mbit/s (emulator, raw) | Use Lampson's figure |

## Popular claims checked against the evidence

| Claim | Verdict | What the sources support |
|---|---|---|
| "The Alto was the first personal computer." | Misleading | The Kenbak-1 (1971) won the 1986 Computer Museum "first PC" contest ([CHM](https://www.computerhistory.org/revolution/personal-computers/17/297)†). The Alto was the first workstation built for one person with a bitmapped GUI, a mouse and a network. |
| "Xerox invented the mouse." | False | SRI built it in 1964. PARC's ball mouse came later (secondary sources†). |
| "The Alto invented the GUI." | Partly | NLS (1968) had windows and a mouse, and Lampson traces "views" back to Sketchpad. Alto Smalltalk was first with overlapping windows and pop-up menus. Desktop icons came with the Star. |
| "It was never sold." | True | About 2,000 went to Xerox, universities and test sites. The "$32,000 introductory price" on Wikipedia† has no support. |
| "Built in three months." | Close | The bet was three months; the machine took about four. |
| "Jobs stole the GUI." | Overstated | Apple paid in stock, Xerox management ordered the demo, Apple's bitmapped plans came first, and Jobs tried to buy the technology (Kay). Xerox's lawsuit failed on timing, not on a finding that nothing was copied. |
| "Jobs saw it on an Alto." | Half true | The Smalltalk demo ran on a Dorado (Kay). |
| "Apple copied it exactly." | False | Regions and the cheap one-button mouse went beyond PARC. The Star is the closer ancestor of the Lisa and Mac desktop. |
| "Xerox got nothing out of PARC." | False | The laser printer brought in more than $1B a year†, Ethernet became an open standard, and Xerox held a pre-IPO stake in Apple. |
| "Xerox feared the paperless office." | Unsupported | Lampson says only that copier growth was slowing. |
| "Pup was the basis of TCP/IP." | Overstated | "Influenced" is defensible. |
| "The 1973 Ethernet used vampire taps." | Anachronism | That term belongs to the 1980s thick-Ethernet standard (10BASE5); the patent says "taps". |
| "Smalltalk invented desktop icons." | Too strong | PYGMALION's iconic programming (1975), the OGDEN proposal (1973), then the Star's desktop icons. |
| "Mesa led to Java" / "PARC inspired the web." | Unsourced / indirect | No primary evidence for either. |
| "Reagan removed the White House Alto." | Unverified | Altos were at White House test sites by early 1978†; nothing more is confirmed. |
| "The court ruled Apple didn't copy Xerox." | False framing | The dismissal was mainly procedural (delay). |

## Story hooks ranked by how safely they can be told

"Primary" means backed by a document read in full; "snippet" means only a search summary was seen.

| Hook | Visual idea | Status | Source |
|---|---|---|---|
| Cookie Monster on "Bilbo", April 1973 | A white portrait screen draws the first bitmap | Primary, participant account | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| "Do you have any money?" and the three agendas | Three thought bubbles: a $500 PDP-10, a 10× Nova, a kiddicomp | Primary | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| Thacker's three-month bet; Executive X tries to kill the project | A calendar from 22 November with a three-month line overrun into April | Primary for the events; the name and the outcome are disputed | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| Ingalls fixes scrolling in under a minute, in front of Jobs | Jumpy text turns smooth; the machine labelled "Dorado" | Primary | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| "The emulator gets the leftovers" | A scanline as 224 slots, with display tasks bursting and the user program filling the gaps | Primary (microcode), shares computed | [microcode](https://github.com/livingcomputermuseum/ContrAlto/blob/master/Contralto/Disassembly/altoIIcode3.mu) |
| Every disk sector wears a name tag | Blocks labelled with file and page; the Scavenger rebuilds a scrambled disk | Primary | [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf) |
| The piece table | Two bars (original file and scratch file) and descriptors splitting one into three | Primary | [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf) |
| Breath of Life | A packet carrying boot code pulses along the coax and a dark Alto wakes up | Primary (code) | [IFS repo](https://github.com/livingcomputermuseum/IFS) |
| Orbit races the paper | Pixel bands computed just ahead of the laser | Primary | [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf) |
| EARS: 80 pages an hour per person | A page counter overflowing a 40-desk lab | Primary | [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf) |
| Fonts built dot by dot on a 20×20 grid | A cursor flipping pixels to form a letter | Primary | [Lampson 1986](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf) |
| 12-year-olds building paint and drawing tools | A child at an Alto | Primary, with Kay's own caveat | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| 80 bouncing balls and 10 flying horses at 10 fps | A literal re-creation | Primary | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| The disk-pack ritual: room 1153, counters reaching 406 twice, the bouncing idle square | A sequence of short cuts | Primary | [Handbook](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/15a-AltoHandbook.pdf) |
| Crashes "once or twice a day", blamed on "cosmic rays" | A glitch, then recovery | Primary | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/) |
| "The best way to predict the future is to invent it", said angrily to planner Don Pendery | A quote card | Primary (Kay's account); the phrase has earlier precursors | [Kay 1993](https://worrydream.com/EarlyHistoryOfSmalltalk/); [Quote Investigator](https://quoteinvestigator.com/2012/09/27/invent-the-future/)† |
| A Smalltalk page-layout demo filmed at 3 fps and played back at 30 | A sped-up film strip | Primary | [Tesler 2012](https://worrydream.com/refs/Tesler_2012_-_A_Personal_History_of_Modeless_Text_Editing_and_Cut-Copy-Paste.pdf) |
| MAXC: refused a PDP-10, so they built one | A PDP-10 silhouette assembling itself | Hiltzik excerpts, read in full | [Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md) |
| Dealer meetings on beanbags | A beanbag circle with one hot seat | Hiltzik excerpts plus a CHM snippet | [Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md) |
| The "time machine": memory costing $10,000 in 1973 costs $30 by 1983 | Shrinking price tags | Hiltzik's figures, not independently checked | [Hiltzik excerpts](https://github.com/maryrosecook/book-notes/blob/master/dealers-of-lightning-michael-hiltzik.md) |
| "ALTO ALOHA" renamed "ETHER" | The memo's cover note being edited | Snippet | [CHM](https://www.computerhistory.org/tdih/may/22/)† |
| "You guys have already done this, haven't you?" | Researchers sworn to silence at a meeting table | Snippet; the date is problematic | [Wikipedia: PUP](https://en.wikipedia.org/wiki/PARC_Universal_Packet)† |
| Futures Day: 20 Altos on two DC-10s | Planes and a Hollywood set | Snippet; the wives story is unverified | [IEEE Spectrum](https://spectrum.ieee.org/behind-the-scenes-at-xerox-parcs-futures-day40-years-ago)† |
| Goldberg: "give away the kitchen sink" | A sink carried out the door | Snippet | [Wikipedia](https://en.wikipedia.org/wiki/Adele_Goldberg_(computer_scientist))† |
| Atkinson invents regions from a misremembering | Overlapping windows redrawing correctly | Snippet | [Folklore.org](https://www.folklore.org/I_Still_Remember_Regions.html)† |
| "A rich neighbor named Xerox" | A burglary cartoon | Snippet | [Folklore.org](https://www.folklore.org/A_Rich_Neighbor_Named_Xerox.html)† |
| The Worm that crashed dozens of Altos overnight | Screens going dark across a network map | Snippet; the scale is disputed | [Wikipedia: Shoch](https://en.wikipedia.org/wiki/John_Shoch)† |
| Restoration: smoke, one dead gate, a disk full of random noise, a Mandelbrot in 60 then 9 minutes | A flat random-byte histogram against the spiky real data; a timer | Snippet (Shirriff's blog) | [Shirriff](https://www.righto.com/2016/09/restoring-ycs-xerox-alto-how-our-boot.html)† |
| $252,000 at Christie's for a machine Xerox never sold | An auction paddle | Snippet | [GeekWire](https://www.geekwire.com/2024/auction-of-paul-allen-items-including-vintage-computers-einstein-letter-and-more-brings-in-10m/)† |
| Tesler's NO MODES licence plate | Close-up of the plate | Snippet | [Fast Company](https://www.fastcompany.com/90466328/a-tribute-to-larry-tesler-the-father-of-user-friendly-design)† |
| Holding keys down with your nose to net-boot | A nose on the keyboard | Anecdote only; the key combinations themselves are primary | [HN](https://news.ycombinator.com/item?id=12198291)† |
| "You're sitting on a gold mine" (Jobs) | — | Attributed to Isaacson but not seen here; avoid, or attribute it | [MakeUseOf](https://www.makeuseof.com/xerox-invented-the-future-in-1979-then-handed-it-to-a-24-year-old/)† |

## Numbers to double-check before scripting

| Number | Current best value | Basis | Check against |
|---|---|---|---|
| Build start and first boot | 22 Nov 1972; early Apr 1973 | Kay (primary) | Thacker's hardware history (HOPW 1986) |
| The bet: counterparty, stake, length | "Bill Vitic"(?); stake unknown; 3 months | Kay transcription | Printed HOPL-II text; *Dealers of Lightning* |
| "Why Alto" figures | 10–30 machines; about $10.5K each ($9.7K with 2.5 MB disk) | Snippet | Memo PDF on bwlampson.site |
| Cost of the first Alto | $12,000 | CHM snippet | CHM *Revolution* page or Thacker oral history |
| Price if sold as a product in 1974 | $40,000 | Lampson (primary) | — |
| Present-day equivalents | $12K (1973) is about $85–90K today; $40K (1974) is about $260K | A researcher's own CPI arithmetic, unsourced | BLS CPI calculator |
| Total built | About 2,000 | Kay and Hiltzik (read in full) | Wikipedia's 120 + 2,000 split† |
| In use around 1979 | About 1,000 at Xerox plus 500 elsewhere | Snippet | Thacker et al. CSL-79-11 |
| At PARC | 150 Altos (and 50 Dorados) | Lampson (primary) | — |
| University donation | About 50 Altos, in 1978 or 1979 | Snippet; sources conflict | Stanford and CMU histories |
| Clock | 170 ns ≈ 5.88 MHz | Emulator source plus manual snippet | Hardware Manual |
| Display share of CPU | About 60% | Paper snippet; the word task alone is about 51% by microcode count | CSL-79-11 |
| Memory | 128 KB standard, 512 KB XM, 850 ns | Snippet plus emulator | Hardware Manual |
| Disk | About 2.5 MB; 1,500 rpm | Emulator geometry, computed | Diablo 31 spec sheet |
| Ethernet milestones | Memo 22 May 1973; first run 11 Nov 1973; 2.94 Mbit/s | Snippet; the rate is computed | CHM's memo scan; Metcalfe–Boggs 1976 |
| 1976 Ethernet paper | 100 nodes on 1 km of coax | Abstract snippet | *CACM* 19(7) |
| Pup internet | About 1,000 hosts, 25 nets, 20 gateways | Abstract snippet | CSL-79-10 |
| EARS | 500 dpi, 1 page per second | Lampson (primary) | — |
| 9700 | 1977; 300 dpi; 120 ppm; more than $1B a year | Snippet | Xerox's 9700 anniversary release |
| Dover | 384 dpi, about 50 built; the PARC system printed about 40 ppm | Lampson (primary) | — |
| Grapevine | About 2,000 machines, 7,000 users | Lampson (primary) | — |
| Futures Day | 10 Nov 1977; 20 Altos, 6 printers, 2 DC-10s | Snippet | IEEE Spectrum article |
| Apple stake | 100,000 shares at $10 or $10.50; worth $17.6M at the IPO | Snippet; internally inconsistent | Hiltzik column; Isaacson |
| Star | 27 Apr 1981; $16,595; about 25,000 sold | Snippet | Johnson et al. 1989 retrospective |
| 860 and 820 | $15,300 (Dec 1979); $2,995 (Jun 1981) | Snippet | CHM brochures |
| Xerox v. Apple | $150M; filed 14 Dec 1989; mostly dismissed 23 Mar 1990 | Snippet | 734 F. Supp. 1542 |
| Mouse patent | Filed 21 or 27 Jun 1967; granted 17 Nov 1970 | Snippet; sources conflict | USPTO record for 3,541,541 |
| Bravo in use | 14 Sep 1974 | A single snippet | Bravo documents in the CHM archive |
| BitBlt | Nov 1975 | Snippet | Ingalls, HOPL-IV (2020) |
| Worm | Experiments from 1979; "dozens" of machines crashed | Snippet | Shoch and Hupp, *CACM* 1982 |
| CHM archives | Oct 2014: about 15,000 files. May 2023: about 150,000 files, 4 GB | Snippet | CHM pages |
| ContrAlto | Released 2 Aug 2016; 2.0 beta dated "03 Sep" (probably 2026) | Snippet; the 2026 year is inferred | GitHub release page |
| Christie's sale | $252,000 (2024) | Snippet | Christie's lot record |

## Conclusion

The Alto's lasting lesson is a systems bargain, not a single invention. Thacker spent scarce hardware on memory and a page-sized bitmap and did everything else in microcode, so one 5.9 MHz engine also ran the display, the disk and the network card. Lampson's team spent the tiny memory on an operating system that got out of the way, and relied on labelled sectors, network boot and servers to make the whole thing dependable.

For the video, that means the network is the story, not the box. A standalone Alto was an expensive terminal; an Alto on Ethernet with IFS, Grapevine and a Dover printer was the modern office a decade early. That framing also explains the commercial outcome. Xerox profited where PARC's ideas matched how it already made money, in pages and printers. It lost the personal computer because the Alto was a $40,000 machine in 1974, and later its product divisions had no reason to sell a cheap one.

For the script, the best-documented stories are also the most vivid: Cookie Monster on Bilbo, the three agendas, Ingalls's one-minute scrolling fix on a Dorado, and the Breath of Life packet. The most often repeated are the weakest: the "gold mine" line, the Futures Day wives, a $32,000 price tag, a 1 March 1973 launch, and an Alto removed from Reagan's Oval Office. A script built on the first group, and careful with the second, can bust myths without inventing new ones. The afterlife makes a fitting closing line: a machine Xerox never sold now boots in a browser tab, from source code Xerox let a museum publish.
