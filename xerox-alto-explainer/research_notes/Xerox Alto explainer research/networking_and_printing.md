# Networking and Printing Infrastructure around the Xerox Alto (1972–1982): Ethernet, Pup, laser printers and servers

*How these notes were sourced.* The session's network policy blocked most primary-source hosts: ACM DL, bitsavers, the CHM archives, Wikipedia, ETHW, righto.com and university mirrors. Three sources were read in full:
- Butler Lampson's 1986/88 paper "Personal Distributed Computing: The Alto and Ethernet Software", hosted by Microsoft Research. It is a first-hand primary source, and the notes cite it as **[Lampson, read]**.
- The Living Computers Museum's reimplementation of the IFS server on GitHub, which includes the original Alto network-boot packet. Cited as **[IFS repo, read]**.
- Ken Shirriff's Alto Ethernet interface README on GitHub.

Every other citation comes from the search engine's summary of the linked page, not from reading the page, and is tagged **(search summary)**. Treat those as leads the report writer should spot-check. The Gaps sections list the claims that need a primary check most.

---

## 1. Ethernet (1972–1983): memo, design, CSMA/CD, speed, taps, addresses, 1976 paper, DIX / IEEE 802.3 / 3Com

### Takeaway
Ethernet started as the "ALTO ALOHA network." Bob Metcalfe renamed it "the ETHER network" in a memo dated May 22, 1973, and it first ran on November 11, 1973 at 2.94 Mbit/s. Metcalfe borrowed ALOHAnet's idea of random retransmission and added three things that ALOHAnet, a radio network, could not have: stations listen before sending (carrier sense), stop as soon as they detect a collision, and wait a random time whose range doubles after each collision (backoff). Metcalfe and David Boggs described it in *CACM* in July 1976. Xerox, DEC and Intel then turned it into 10 Mbit/s "DIX" Ethernet in 1980, and the IEEE standardized it as 802.3 in 1983.

### Cited Findings
**Origins and the memo**
- Metcalfe's Harvard PhD thesis was first rejected. He then went to Hawaii to study Norm Abramson's ALOHAnet, added a mathematical analysis of it to the thesis, and received his PhD in June 1973. — [Quanta Magazine](https://www.quantamagazine.org/bob-metcalfe-ethernet-pioneer-wins-turing-award-20230322/); [Wikipedia: Robert Metcalfe](https://en.wikipedia.org/wiki/Robert_Metcalfe) (search summary)
- Pure ALOHA can use at most about 18.4% of the channel, because stations transmit whenever they like and collisions waste the airtime. — [A. Pennings on ALOHAnet](https://apennings.com/how-it-came-to-rule-the-world/the-lasting-impact-of-alohanet-and-norman-abramson/) (search summary)
- Metcalfe's addition to the ALOHA approach was backoff: a collision is treated as evidence that the channel is busier than expected, so the station widens the interval over which it randomizes its retry. — [History of Computer Communications §8.7](https://historyofcomputercommunications.info/section/8.7/Ethernet-and-Robert-Metcalfe-and-Xerox-PARC-1971-1975/) (search summary)
- On May 22, 1973, Metcalfe sent a memo marked Xerox-sensitive to the "ALTO ALOHA" team. The memo was about 13 pages; one search summary gives its title as "Ether Acquisition". Its cover note proposed dropping the name "the ALTO ALOHA Network" in favor of "The ETHER Network". — [CHM This Day in History, May 22](https://www.computerhistory.org/tdih/may/22/); [ETHW: Ethernet](https://ethw.org/Ethernet) (search summary)
- The memo contained Metcalfe's hand-drawn sketch of the concept. One diagram showed "boosters" joining branched cable, telephone and radio "ethers", so the medium was imagined as heterogeneous from the start. — [DigiBarn: original Ethernet sketch](https://digibarn.com/collections/diagrams/ethernet-original/); [ETHW](https://ethw.org/Ethernet) (search summary)
- The system first worked on **November 11, 1973**, at **2.94 Mbit/s**. — [Wikipedia: Ethernet](https://en.wikipedia.org/wiki/Ethernet) (search summary)

**The name**
- Metcalfe took the name from the 19th-century "luminiferous ether", a passive medium thought to carry electromagnetic waves without caring what they were. He later explained it with a short line (under 15 words): "the ether could be coax, twisted pair, radio, optical fibers". In other words, the protocol was not tied to any one cable. — [DEV: Why Ethernet is named after a physics myth](https://dev.to/fluidwire/why-ethernet-is-named-after-a-physics-myth-44ae); [TeleGeography](https://resources.telegeography.com/luminiferous-ether-how-ethernet-got-its-name-local-access-pricing-service) (search summary)

**People**
- **David Boggs** joined PARC in 1973 after graduating in electrical engineering from Princeton in 1972. With Metcalfe he built several Ethernet interfaces for the Alto during 1973, and he wrote much of the Alto network code. Metcalfe left to found 3Com; Boggs stayed at PARC and later moved to DEC. He died on February 19, 2022, aged 71. — [The Register obituary](https://www.theregister.com/2022/03/01/david_boggs_obituary/); [Seattle Times](https://www.seattletimes.com/business/technology/david-boggs-co-inventor-of-ethernet-dies-at-71/) (search summary)
- **Chuck Thacker** is credited with working out Ethernet's signaling. Metcalfe and Boggs, with some help from Butler Lampson, did the packet format and protocols. — [Microsoft Research on Thacker](https://www.microsoft.com/en-us/research/blog/chuck-thacker-attains-computings-peak/) (search summary)
- **Patent:** US 4,063,220, "Multipoint data communication system with collision detection". Filed in 1975 and granted in 1977, it names Metcalfe, Boggs, Thacker and Lampson as inventors. It describes a branched cable with "taps", a transceiver at each tap, and a gate in each transceiver that compares the data it is sending with the data actually on the cable. A mismatch means "interference" and disables the transmitter. That comparison is collision detection in hardware. Metcalfe reportedly insisted that Lampson and Thacker be named on the patent. — [Google Patents US4063220A](https://patents.google.com/patent/US4063220A/en); [Wikipedia: David Boggs](https://en.wikipedia.org/wiki/David_Boggs) (search summary)

**Speed, encoding, hardware**
- **Why 2.94 Mbit/s:** the experimental Ethernet used Manchester-encoded baseband signaling at 2.94 MHz, which is half the Alto's clock rate. The Alto's clock ran at about 5.88 MHz, a 170 ns cycle. Each bit cell was therefore 340 ns long, made of two 170 ns half-cells. Manchester coding is self-clocking because every bit has a transition in the middle. — [Wikipedia: Ethernet](https://en.wikipedia.org/wiki/Ethernet); [Ken Shirriff, righto.com (2018)](http://www.righto.com/2018/01/xerox-altos-3-mbs-ethernet-building.html) (search summary)
- The Alto's Ethernet board produced TTL signals and connected through an interface cable to an **external transceiver box** on the coax. There were three signal paths: data out, data in, and a collision-detect line. — [Shirriff, alto-ethernet-interface README](https://github.com/shirriff/alto-ethernet-interface/blob/master/README.md) (read)
- **Addresses:** the experimental Ethernet used **8-bit** station addresses, so at most 256 stations per net. — [search summary of Ethernet sources](https://intronetworks.cs.luc.edu/1/html/ethernet.html) (search summary)
- The Henry Ford museum holds a "Transceiver, Section of the Original Ethernet, 1973–1974", attributed to Boggs, Metcalfe and Xerox PARC. — [The Henry Ford](https://www.thehenryford.org/collections-and-research/digital-collections/artifact/361761/); [Google Arts & Culture](https://artsandculture.google.com/asset/transceiver-section-of-the-original-ethernet-1973-1974-boggs-david-reeves/9AGEnKu_FTbLBw?hl=en) (search summary)
- **"Vampire taps":** one search summary described "100 transceiver nodes" on a "500-meter cable", attached by N-connector "vampire taps" whose probes bit through the insulation to reach the copper core. **Flag:** the 500 m segment is a 10BASE5 (thick Ethernet, 1980s) figure, so the source is probably mixing that standard with the experimental Ethernet. — [mbedded.ninja / Wikipedia](https://blog.mbedded.ninja/electronics/communication-protocols/ethernet-protocol/) (search summary)

**The 1976 paper**
- Robert M. Metcalfe and David R. Boggs, "Ethernet: Distributed Packet Switching for Local Computer Networks", *Communications of the ACM* 19(7), July 1976. It calls Ethernet a "branching broadcast communication system" for data packets, and bases its design principles on experience with an operating Ethernet of **100 nodes along a kilometer of coaxial cable**. — [ACM DL](https://dl.acm.org/doi/10.1145/360248.360253) (search summary of the abstract)
- The paper is the canonical description of **binary exponential backoff**: a station uses the feedback from its own failed attempts to schedule its next ones. — [ResearchGate: On the Stability of the Ethernet](https://www.researchgate.net/publication/221590878_On_the_Stability_of_the_Ethernet) (search summary)

**Standardization and 3Com**
- Metcalfe left Xerox in **June 1979** to found **3Com**, and persuaded DEC, Intel and Xerox to promote Ethernet together as a standard. — [Wikipedia: Ethernet](https://en.wikipedia.org/wiki/Ethernet); [HistoryOfInformation](https://www.historyofinformation.com/detail.php?id=1245) (search summary)
- The DIX "Blue Book" Ethernet 1.0 specification was published in **September 1980**. It specified 10 Mbit/s, 48-bit source and destination addresses, and a 16-bit type field. — [Wikipedia: Ethernet](https://en.wikipedia.org/wiki/Ethernet) (search summary)
- **IEEE 802.3** was published on **June 23, 1983**, starting from the DIX Blue Book CSMA/CD proposal. — [Wikipedia: Ethernet](https://en.wikipedia.org/wiki/Ethernet) (search summary)
- The move from 8-bit to 48-bit addresses had a Xerox paper behind it: Dalal and Printis, "48-bit absolute internet and Ethernet host numbers" (ACM SIGCOMM CCR). — [ACM DL listing](https://dl.acm.org/doi/10.1145/1013879.802680) (title only, from search results)
- Lampson's list of commercial descendants of the Alto system includes "Ethernet/IEEE 802.3" for local networks and the 3Com file server among servers. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- **CSMA/CD in plain terms, for animation:**
  - Everyone shares one wire, the "ether". Before talking, you listen (carrier sense).
  - If two stations start at almost the same moment, each one's transceiver sees that the signal on the wire differs from what it sent (collision detect, as in the patent). Both stop at once instead of wasting a whole packet, which is the key advantage over ALOHA's radio.
  - Each station then waits a random time. After the first collision it picks from a small range; after the second from a range twice as big; and so on. Stations that keep colliding spread themselves out automatically, with no central controller.
  - This works as a good visual: dots on a line, a collision flash, then the random-delay window doubling in width.
- **Why the speed was odd:** it wasn't picked for networking reasons. It is a clock derived from the Alto, since one Ethernet bit is two Alto microcycles. The Alto's microcode tasks drove the interface, so matching the clock kept the hardware tiny.
- **The name was a design statement:** Ethernet was meant to be independent of the medium. That foreshadows Pup, which also treated Ethernet as just one of many "transport mechanisms".

### Gaps
- I could not open the 1976 paper to confirm these details. Worth checking in the primary:
  - the exact backoff algorithm as the paper states it;
  - the efficiency curves (I believe they show efficiency above 90% for long packets, but this is unverified);
  - the "received" date (I recall 1975);
  - whether the paper explicitly explains the ether naming.
- The **maximum cable length** of the experimental Ethernet is not confirmed here beyond the paper's "kilometer of coaxial cable". I found no primary figure for repeaters or segment limits.
- **Were the 1973 taps called "vampire taps"?** The only source for that is a summary that seems to mix in 10BASE5. The patent says only "taps". Treat the phrase as a later thick-Ethernet term unless Boggs/Metcalfe sources say otherwise.
- The precise title of the May 22, 1973 memo is uncertain. Sources say "Alto Ethernet" or "Ether Acquisition", and CHM holds the original.
- No reliable source found for a specific "collision demo" anecdote.
- The claim that CSMA/CD pushed utilization "past 90%" came from a low-quality Substack source, so I excluded it. The report writer should take the figure from the 1976 paper itself.

---

## 2. Pup (PARC Universal Packet): internetworking, gateways, and influence on TCP/IP, XNS, IPX, AppleTalk

### Takeaway
Pup was an internetwork protocol working years before TCP/IP. Its design was substantially complete by 1974. Every link (Ethernet, leased line, ARPANET, and so on) carried the same end-to-end, best-effort **internet datagram**. Gateways did the job ARPANET IMPs did, and routers dropped packets under congestion. By about 1979–80 it connected roughly 1,000 computers on 25 networks through 20 gateways. PARC staff talked with the TCP designers but were constrained by Xerox lawyers. Pup grew into Xerox's XNS, and XNS in turn was the basis of Novell IPX/SPX, Banyan VINES and 3Com's stack, and influenced AppleTalk's addressing.

### Cited Findings
- **Design (Lampson):** Pup "was originally designed by Bob Metcalfe, and implemented by him together with David Boggs and Ed Taft." It was based on late-1960s ARPANET ideas, with fixes for known problems. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **The four levels:**
  - Level 0, transport: Ethernet, ARPANET, leased telephone lines, and so on.
  - Level 1: internet datagrams.
  - Level 2: interprocess communication, meaning the Byte Stream Protocol (BSP), the rendezvous/termination protocol and the routing table protocol.
  - Level 3: data conventions, meaning FTP, Telnet (Chat) and the mail transfer protocol.
  
  — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Core idea (Lampson):** internet datagrams are the "common coin". Every client uses them, whether the data travels over Ethernet, a phone line or a dozen other media. Unlike the Cambridge Ring or Apollo Domain, the Alto system takes no advantage of the Ethernet's special properties. Pup treats a transport network the way the ARPANET treats an IMP-to-IMP phone line, with a **gateway** playing the IMP's role. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Best effort (Lampson):** unlike the ARPANET, Pup gives no delivery guarantee. Congestion is relieved by **discarding datagrams**, on the expectation that most traffic crosses lightly loaded local networks. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Performance (Lampson):** Pup byte streams moved about **0.3 Mbit/s between two Altos**, using 512-data-byte datagrams. Lampson calls this an order of magnitude better than typical byte-stream implementations of the time, and credits the protocols' simplicity. David Boggs wrote FTP and Bob Sproull wrote Chat. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Network boot, diagnostics reporting and the Woodstock File System** used raw internet datagrams rather than a level-2 protocol. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **The paper:** D. R. Boggs, J. F. Shoch, E. A. Taft, R. M. Metcalfe, "Pup: An Internetwork Architecture", *IEEE Trans. Communications* COM-28(4), April 1980, pp. 612–624. It also exists as PARC tech report CSL-79-10, July 1979. Its fundamental abstraction is an end-to-end, media-independent internetwork datagram. It reports an operational internet serving **about 1000 computers on 25 networks of 5 different types, using 20 internetwork gateways**. — [Semantic Scholar abstract](https://www.semanticscholar.org/paper/Pup:-An-Internetwork-Architecture-Boggs-Shoch/741882d8dfa32605b10187709d219f43f662c3e5); [IEEE Xplore](https://ieeexplore.ieee.org/abstract/document/1094684/); [bitsavers CSL-79-10](https://bitsavers.trailing-edge.com/pdf/xerox/parc/techReports/CSL-79-10_Pup_An_Internetwork_Architecture_Jul79.pdf) (search summary)
- **Timing:** Pup was "substantially complete by 1974". It was one of the two earliest internetworking suites, alongside TCP/IP. — [Wikipedia: PARC Universal Packet](https://en.wikipedia.org/wiki/PARC_Universal_Packet) (search summary)
- **Address format:** an 8-bit network number, an 8-bit host number and a socket number. **Conflict:** the Tenex Pup implementation document says the socket is **32 bits**, while one search summary said 16 bits. The primary Xerox document favors 32. A maximum Pup carries **532 data bytes**; one summary gives 554 bytes in total including the 20-byte header and the checksum. — [Implementation of Pup in Tenex (CHM)](https://xeroxalto.computerhistory.org/_cd8_/pup/.tenex-pup.press!1.pdf); [Wikipedia: PUP](https://en.wikipedia.org/wiki/PARC_Universal_Packet) (search summary)
- **Contact with the TCP designers:**
  - An INWG meeting organized by Vint Cerf was attended by Metcalfe and Shoch. A Xerox lawyer told them they could not talk about Pup, but they kept pointing out flaws in the proposals until a Stanford participant asked: "You guys have already done this, haven't you?" Wikipedia dates the meeting **June 1973**; see Gaps for a chronology problem.
  - Cerf and Kahn's 1974 paper acknowledges Metcalfe as an early INWG member.
  
  — [Wikipedia: PARC Universal Packet](https://en.wikipedia.org/wiki/PARC_Universal_Packet) (search summary)
- **Splitting TCP from IP:** a secondary history quotes a Xerox-side participant. Before Pup was disclosed, Xerox researchers pushed Cerf, Postel and others to separate a datagram (internet) layer from a session (transport) protocol, because datagrams matter on LANs. Cerf, Dave Clark and Postel "saw that immediately" and gradually modified TCP, and IP was split out in the later iterations of TCP (1978). — [History of Computer Communications §8.11](https://historyofcomputercommunications.info/section/8.11/TCP-to-TCP-IP-1976-1979/) (search summary)
- **Names, addresses and routes:** John Shoch's "Inter-Network Naming, Addressing, and Routing" (IEEE COMPCON, Fall 1978) is cited in **RFC 791** (IP) for the line "A name indicates what we seek" (quoted; under 15 words). The full principle adds that an address says where it is and a route says how to get there. — [RFC 791](https://www.rfc-editor.org/info/rfc791/) (search summary)
- **XNS:** the Xerox 8000 network products use "an outgrowth of Pup called Xerox Network System or XNS". XNS added the **Courier** remote procedure call protocol, designed by Jim White. Separately, Birrell and Nelson built Cedar RPC directly on Pup datagrams; a null call between two Dorados took about **1 ms**. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **XNS descendants:** XNS influenced 3Com's 3+Share, Ungermann-Bass Net/One, Novell **IPX/SPX** (IPX derives from XNS's IDP) and Banyan **VINES**. AppleTalk borrowed XNS's addressing ideas. The XNS specifications were publicly released, which helped them spread. — [Wikipedia: Xerox Network Systems](https://en.wikipedia.org/wiki/Xerox_Network_Systems); [Wikipedia: IPX](https://en.wikipedia.org/wiki/Internetwork_Packet_Exchange) (search summary)
- Lampson's descendants list includes "ARPA IP/TCP; Xerox Network Services, Clearinghouse" under network protocols. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- **Authorship:** Lampson credits Metcalfe with the original design, while the 1980 paper lists Boggs, Shoch, Taft and Metcalfe. A fair phrasing is "designed by Metcalfe, Boggs, Shoch and Taft", with Metcalfe as the original architect.
- **Addressing and boot:** Pup's 8-bit host number matches the experimental Ethernet's 8-bit station address. On a 3 Mbit Ethernet, a Pup host number can simply *be* the Ethernet address, with no resolution protocol needed. The network-boot "boot address" 0377 (255; see section 4) fits the same 8-bit space.
- **Visuals:**
  - The "common coin" datagram hopping through gateways across mixed media (Ethernet, phone line, ARPANET) is the key picture for the video.
  - A second picture is dropping packets under congestion, which the lower layers are allowed to do; the design pushes that responsibility to the endpoints.
- **Hedge on TCP/IP influence:** Pup's influence on TCP/IP is widely asserted, but the evidence is mostly the participants' own recollections. It should be presented as "influenced", not "was the basis of".

### Gaps
- **Chronology problem:** Wikipedia puts the INWG meeting in "June 1973", yet Pup's design is dated 1974 and Shoch's arrival at PARC is not established here. The meeting may be misdated, or the protected work may have been something earlier. Needs a primary source (Shoch or Metcalfe oral histories, or the Network World "TCP/IP owes a lot to Xerox PUP" article, which I could not open).
- Not verified here:
  - the exact header fields, such as the transport-control/hop-count byte;
  - the full protocol list from the 1980 paper, such as the gateway information protocol, EFTP and misc services;
  - the date the first Pup gateway went into service.
- I found no primary quote from Cerf himself acknowledging Pup's influence.

---

## 3. Laser printing: SLOT/EARS, Dover, Xerox 9700, Press → Interpress → PostScript

### Takeaway
Gary Starkweather's laser-scanned xerography started around 1969 at Webster, NY. After he moved to PARC in 1971 it became SLOT, built on a Xerox 7000 copier, and then **EARS**. EARS was Alto-controlled with custom character-generator hardware by Ron Rider and Butler Lampson, printed at 500 dpi and 1 page per second, and was in use from 1973. A second EARS became the prototype of the **Xerox 9700** (1977; 300 dpi, 120 pages/min), a very profitable product. PARC then built the cheaper **Dover** (384 dpi), with about 50 copies spread across Xerox. Printing interfaces went from EARS-specific files to **Press** (device-independent, fonts named rather than embedded) to **Interpress** (1980, a stack-based page language). Warnock and Geschke left in 1982 to create **PostScript** at Adobe.

### Cited Findings
**SLOT, EARS and the 9700**
- Starkweather invented the laser printer concept in **1969** at Xerox's Webster, NY lab and transferred to PARC in **1971**. There he built **SLOT** ("scanning laser output terminal") on a **Xerox 7000 copier**, and completed the first working laser printer about nine months after arriving. — [National Inventors Hall of Fame](https://www.invent.org/inductees/gary-k-starkweather); [HistoryOfInformation](https://www.historyofinformation.com/detail.php?id=883) (search summary)
- **EARS** stands for "Ethernet – Alto – Research character generator – Scanning laser output terminal". In 1972 Starkweather worked with Butler Lampson and Ronald Rider to add a control system and character generator. EARS was introduced in **1973** and heavily used. — [ETHW Milestone: Commercial Laser Printer 1971–1977](https://ethw.org/Milestones:Development_of_the_Commercial_Laser_Printer,_1971-1977); [NIHF](https://www.invent.org/inductees/gary-k-starkweather) (search summary)
- **EARS specifications (Lampson):**
  - "a 500 dot/inch, 1 page/second xerographic printer";
  - based on a **Xerox 3600 copier engine**, with a raster output scanner Starkweather developed at PARC;
  - controlled by an Alto plus special hardware **about three times the size of the Alto** that stored font bitmaps and generated a **25 MHz video signal**;
  - imager and hardware by Ron Rider, with design help from Lampson.
  
  — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Conflict:** NIHF says SLOT used a **7000** copier, while Lampson says EARS used a **3600** engine. Both may be true: SLOT was the first 1971 prototype on a 7000, and EARS a later build on a 3600. Unresolved.
- **Output (Lampson):** EARS output was as good as a xerographic copy of a book. It could print **80 pages an hour for each member of a 40-person lab** (60 pages/min), though the lab "never used more than a fraction of its capacity." "A second copy of Ears served as the prototype for the Xerox 9700," which Lampson calls "a very successful product." — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Before EARS:** the first imager, written by Peter Deutsch, drove the **Xerox Graphics Printer (XGP)** at 5 pages/min and 200 dpi. Its fonts were designed by hand and later spread widely to universities. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Xerox 9700:** launched in **1977**, printing **300×300 dpi** at up to **120 pages per minute** on cut sheets, with fonts, graphics and logos. It became one of Xerox's best-selling products and made "billions" for Xerox, described as the most profitable product to come out of PARC. — [Wikipedia: Xerox 9700](https://en.wikipedia.org/wiki/Xerox_9700); [Xerox: laser printers](https://www.xerox.com/en-us/office/insights/laser-printers); [Xerox newsroom, 40th anniversary](https://www.news.xerox.com/news/40-year-anniversay-of-the-Xerox-9700-and-its-innovation) (search summary)

**Dover, Orbit and Spruce**
- **Dover (Lampson):**
  - also built on the 3600 copier, at **384 dots/inch**; development managed by John Ellenby;
  - Bob Sproull and Severo Ornstein built the **Orbit** imaging hardware from a Lampson design, about half the size of the Alto driving it;
  - Sproull and Dan Swinehart wrote the **Spruce** imager, which accepts Press files;
  - "About 50 copies" were made and distributed widely, cheap enough "that every group could have its own printer";
  - Spruce normally had an 80 MB disk for fonts and spooling;
  - Orbit had **no full-page image buffer**, so Spruce had to keep up with the paper in real time and could fail on pages with too many lines or small characters.
  
  — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- A PARC "Printing at PARC" document says the Orbit printers (Dovers, Pimlicos, Sequoias) ran at **350 dpi** at first and switched to **384 dpi** on **June 15, 1978**. Spruce received Press files over the network via **EFTP**. — [CHM Alto archive: PrintingAtParc](https://xeroxalto.computerhistory.org/Indigo/Spruce/documents/PrintingAtParc.dm!1_/.printing.bravo.html); [Spruce manual](https://xeroxalto.computerhistory.org/Indigo/Spruce/documents/sprucemanual.dm!3_/.sprucemanualops.bravo.html) (search summary)
- **The "Press" imager (Lampson):** a separate imager, confusingly also called Press, by Sproull and Patrick Baudelaire. It drove two slower 384-dpi engines, one of which could print **four colors**. It built the whole **15 Mbit raster on disk** and then played it out to the printer, and it produced "spectacular color halftones". — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Scale:** the finished PARC system stored "many thousands of typeset pages" and printed at **about 40 pages per minute**. All Alto documentation and lab papers and memos were stored and printed on demand. A full-page raster is **10–25 million bits**. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

**Printing interfaces: Press → Interpress → PostScript**
- **Print-server architecture (Lampson):** there are three parts.
  - The **interface** describes the pages.
  - The **spooler** receives files over standard file transfer and queues them on disk. Printing pauses while a new file arrives.
  - The **imager** turns descriptions into raster bits at the engine's speed.
  
  Lampson says the "clear separation" of formatting (done by the document creator) from printing was "crucial". — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Evolution of the interfaces (Lampson):**
  - **XGP interface:** ASCII text plus control codes.
  - **EARS interface** (Ron Rider): documents had to carry the bitmaps of every font they used, so the printer knew nothing about fonts. This gave total control over character placement, and logic-symbol fonts were used to print schematics.
  - **Press** (William Newman and Bob Sproull): a systematic imaging model with arbitrary graphics. Fonts are *named*, and the printer stores them, "since font management proved to be too hard for document creators". Press documents could be displayed as well as printed, and Press served for about six years.
  - **Interpress** (1980, Sproull and Lampson, with help from John Warnock): its main innovation is a **stack-based programming language**, so a document is a program that is executed to draw the page.
  
  The first Interpress imager was written by Bob Ayers (SDD) for the Xerox **8044** printer. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **JaM:** Warnock and Martin Newell created JaM, a procedural graphics language, at PARC. It influenced Interpress. — [CHM blog: PostScript](https://computerhistory.org/blog/postscript-a-digital-printing-press/) (search summary)
- **Adobe:** Xerox kept Interpress proprietary. Warnock and Geschke left PARC and incorporated their company in **December 1982** to build a rival language along the same procedural lines, which became **PostScript**. — [IEEE Spectrum](https://spectrum.ieee.org/adobe-postscript/particle-1); [CHM blog](https://computerhistory.org/blog/postscript-a-digital-printing-press/); [Entrepreneur](https://www.entrepreneur.com/growing-a-business/dr-charles-m-geschke-john-e-warnock/197630) (search summary)
- Lampson's list of descendants includes Xerox 9700/5700/8044, Imagen and the Apple LaserWriter among laser printers; Interpress and Adobe PostScript among printing interfaces; and the 8044 and LaserWriter among print servers. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- **Networked printing was the "killer app" of personal distributed computing at PARC.** Documents were composed on a personal Alto, shipped over Ethernet as a Press file, spooled on an Alto print server, and rasterized in real time. The EARS acronym itself begins with "Ethernet – Alto". Lampson calls printing the most complex and most interesting service in the system.
- **Animation-worthy ideas:**
  - The imager has to "race the paper". Orbit had no page buffer, so Spruce computed bands of pixels just ahead of the laser.
  - The font question moved from the document (EARS), to the printer (Press), to a program (Interpress/PostScript).
  - Scale comparison: 500 dpi on a letter page is about 8.5×500 × 11×500 ≈ 23 million dots, which matches Lampson's "10–25 million bits". Compare that with the Alto's 128 KB of memory, roughly 1 Mbit. The page raster could not fit in the computer's memory, which is why custom hardware or disk rasters were needed.

### Gaps
- I could not reach Starkweather's CHM oral history or his 1997 talk. These are unverified:
  - the rotating-polygon-mirror details;
  - the laser type;
  - the date and content of the first printed page;
  - management-resistance anecdotes.
- One search summary said SLOT/EARS printed "60 pages a minute at 500 dpi". That is consistent with Lampson's "1 page/second".
- The 7000-vs-3600 copier conflict (above) is unresolved.
- I found no reliable figure for the 9700's cumulative revenue beyond "billions". Treat any specific dollar figure with caution.
- The Dover's page rate is not established. One search summary conflated it with the 9700's 120 ppm, and I did not accept that.

---

## 4. Servers: IFS, Juniper, WFS, Grapevine, network boot, and the Worm programs

### Takeaway
The Alto system was deliberately split into personal machines plus shared **servers**, and most servers were themselves Altos with special peripherals:
- **File servers:** first the MAXC/Tenex time-sharing machine, then WFS, then **IFS**, which was the workhorse for at least 7 years with dozens installed. **Juniper**, a transactional file server, entered service in 1977.
- **Print servers:** EARS, then Spruce/Dover.
- **Gateways.**
- **Naming and mail:** Pup name lookup, then **Grapevine** (1980).

Altos could **boot over the Ethernet**: a server periodically broadcast a "Breath of Life" packet that carried the Alto's network bootstrap code. Shoch and Hupp's **Worm** programs (experiments from 1979, published 1982) were the one truly distributed application. The name came from a science-fiction "tapeworm". One corrupted worm crashed dozens of Altos overnight.

### Cited Findings
**Server model**
- A server is "an Alto equipped with special input-output devices and programmed to supply a particular service such as printing or file storage". Nearly all servers were Altos, with no room for more than one server program each. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- The open, unprotected Alto OS was "essential" for realtime server programs such as the file, print and gateway servers. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- By **October 1976** the *Alto User's Handbook* described a complete personal distributed computing system: OS, display editor, illustrators, high-quality printing, and shared file storage and email via the network to a time-sharing machine. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

**File servers** — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- For its **first three years**, the Alto system used CSL's Tenex mainframe as its file server, through a Pup version of ARPANET FTP written by Ed Taft. Tenex ran on MAXC, PARC's PDP-10 clone.
- **WFS**, the Woodstock File Server, was written by David Boggs:
  - a connectionless, single-datagram request/response protocol;
  - one 512-byte page per transfer, and files only, with no directories;
  - implemented in **two months on a Data General Nova**, later ported to the Alto;
  - clients included Officetalk and Smalltalk.
- **IFS**, the Interim File System, was assembled by **David Boggs and Ed Taft**:
  - built from existing Alto packages: the OS file system, FTP and Ed McCreight's B-tree;
  - squeezed into a **128 KB** Alto, driving **300 MB** disks, for "several GBytes" per server;
  - served "as the main file server throughout the Alto system for at least seven years", with "dozens of IFS servers" installed;
  - supports file versions and write locking;
  - later gained single-packet protocols, an interim mail server and Grapevine-based access control.
- **Juniper** was designed by Howard Sturgis, Jim Mitchell, Jim Morris, Jay Israel and others. It was a multi-machine random-access file server with **transactions** and fine-grained locking, and was:
  - the **first Mesa server**;
  - the first to use an RPC-like protocol;
  - put in service in **1977**.
  
  Its performance on the Alto was marginal, and it was never widely used. Its successor was Alpine in Cedar.

**Naming and mail: Grapevine**
- The system at first relied on Pup host names and Tenex mail, which "began to break down" when the system grew to hundreds of machines. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Grapevine** was designed by Andrew Birrell, Roy Levin, Roger Needham and Mike Schroeder. It entered service in **1980** and provides naming, mail transport, distribution lists and access control lists. Its database is **replicated** across servers, so reliably that other components depend on it. It was also used to register RPC exporters. By about 1985, "dozens of servers" supported about **2,000 machines and 7,000 registered users**. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- **Grapevine paper** (Birrell, Levin, Needham, Schroeder, *CACM*, April 1982): a "multicomputer system on the Xerox research internet" providing message delivery; naming of people, machines and services; authentication; and service location. — [Microsoft Research publication page](https://www.microsoft.com/en-us/research/publication/grapevine-an-exercise-in-distributed-computing/) (read)
- **"Experience with Grapevine"** (Schroeder, Birrell, Needham, *ACM TOCS* 2(1), Feb 1984) reports a registration database of about **4,400 individuals and 1,500 groups**, and more than **8,500 messages** per workday yielding over **35,000 message receptions**. — [All Things Distributed](https://www.allthingsdistributed.com/2015/03/grapevine-distributed-computing.html) (search summary)
- **Laurel**, the Alto mail client by Doug Brotz, Roy Levin, Mike Schroeder and Ben Wegbreit, used Grapevine for transport. It had a three-window layout: message list, reading pane and composing pane. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

**Network boot**
- Booting a machine and collecting diagnostic reports used raw Pup internet datagrams. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- The IFS reimplementation includes the original **"Breath Of Life" (BOL)** packet, "containing the Alto ethernet bootstrap code":
  - It is broadcast periodically to Ethernet host **0377 octal** (255, commented "boot address"), with Ethernet packet type **0602 octal**.
  - Separately, an **EFTP boot server** hands out boot files indexed by "boot numbers", keeping "the file numbers conventionally used at Xerox PARC".
  - IFS also provides **CopyDisk**, which images whole Alto disk packs over the network, plus name lookup, time service and gateway routing.
  
  — [IFS repo, read](https://github.com/livingcomputermuseum/IFS) (files PUP/Boot/BreathOfLife.cs, PUP/readme.txt)
- The emulator's default configuration broadcasts BOL every **5,000 ms**. This is a modern configuration value, not a verified historical interval. — [IFS repo, read: PUP/Conf/ifs.cfg](https://github.com/livingcomputermuseum/IFS)
- IFS supported "ftp, network boot, network disk copying, network services, gateways". — [Shirriff README, read](https://github.com/shirriff/alto-ethernet-interface/blob/master/README.md)

**The Worm programs**
- John F. Shoch and Jon A. Hupp, "The 'Worm' Programs — Early Experience with a Distributed Computation", *CACM* 25(3), **March 1982**, pp. 172–180. — [ACM DL](https://dl.acm.org/doi/10.1145/358453.358455) (search summary)
- **The name:** Shoch and Hupp coined "worm" during mobile-software experiments at PARC in **1979**. It was inspired by the network "tapeworm" in John Brunner's 1975 novel *The Shockwave Rider*. — [Wikipedia: John Shoch](https://en.wikipedia.org/wiki/John_Shoch); [Wikipedia: Computer worm](https://en.wikipedia.org/wiki/Computer_worm) (search summary)
- **How worms worked:**
  - The test bed was **over a hundred Ethernet-connected Altos**.
  - A worm was a multi-machine computation. Each machine held a **segment**, and segments communicated with each other.
  - Worms sought machines left idle after hours.
  
  — [Peter Schafhalter's notes on the paper](https://pschafhalter.com/blog/os-prelim/distributed-systems/worm-programs/) (search summary)
- **The worm applications:**
  - **existential** worm: a test whose only aim was to survive and spread;
  - **billboard** worm: displayed messages across machines;
  - **alarm clock** worm: a distributed, fault-tolerant alarm that could phone a user;
  - **multimachine animation**;
  - **diagnostic** worm.
  
  — [Schafhalter notes](https://pschafhalter.com/blog/os-prelim/distributed-systems/worm-programs/) (search summary)
- **Safety features and the rogue worm:**
  - Worms had limited lifetimes and responded to a special **"kill" packet**.
  - Even so, one worm, apparently corrupted during copying, **ran out of control and crashed many machines overnight**. Its failed replication attempts left dozens of Altos out of action by morning.
  - Later worms kept a log of all colonized Altos, much like routing tables.
  
  — [Wikipedia: Computer worm / Timeline](https://en.wikipedia.org/wiki/Timeline_of_computer_viruses_and_worms) (search summary); [Christian Science Monitor, Oct 21, 1981](https://www.csmonitor.com/1981/1021/102126.html) (search summary)
- A contemporary press account (CSMonitor 1981) describes a companion "WORM-Watcher" program that monitored worms and could restrict or purge them, and notes that the worm ran only on Ethernet-connected Altos. — [CSMonitor 1981](https://www.csmonitor.com/1981/1021/102126.html) (search summary)
- Lampson: the Worm was "the only truly distributed program" in the Alto system besides the Pup internet router. The **150 Altos and 50 Dorados** at PARC were otherwise never used as a multiprocessor. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- **The Worm relied on network boot.** Each segment had to bootstrap itself into an idle Alto's memory over the Ethernet, which is the same capability the BOL/EFTP mechanism provided. The rogue episode shows the risk of machines that will run whatever code arrives on the wire.
- **Grapevine is an early example of a replicated, highly available directory service.** It sits conceptually between the Pup name lookup and later systems like Clearinghouse, DNS and Active Directory. Lampson's list pairs it with XNS Clearinghouse.
- **Animation ideas:**
  - (a) An Alto powering up, hearing the BOL broadcast, and loading its bootstrap from the wire.
  - (b) Worm segments hopping between idle screens at night, and the "morning after" of dead machines.
  - (c) IFS as a single Alto holding gigabytes of shared files for dozens of users, whose own Altos each had only a 2.5 MB Diablo disk.
  - Caveat: the Diablo disk size comes from general Alto knowledge, not from sources read here.

### Gaps
- I could not read the Worm paper itself. Unverified:
  - the exact wording and mechanism of the "emergency escape" kill;
  - how many machines the rogue worm actually crashed ("dozens" comes from secondary accounts);
  - the date of that incident.
- Not verified here:
  - exactly how the Alto initiated a network boot (which keys are held at power-on);
  - the historical BOL broadcast interval.
- IFS's first deployment date is not established. Lampson implies the late 1970s, after Tenex became overloaded.
- The Pup "name lookup" and "misc services" server details come from the modern reimplementation, not from period documents.

---

## 5. How big was the PARC / Xerox internet by ~1979–80?

### Takeaway
By about 1979–80 the Xerox research internet running Pup connected **about 1,000 computers on 25 networks of 5 types through 20 gateways**. About **150 Altos** (plus about 50 Dorados later) were at PARC itself. By one widely cited count, nearly **1,000 Ethernet-linked Altos** were in use at Xerox and **about 500** more at universities and government sites by 1979. Around 1984–85, Grapevine served about 2,000 machines and 4,400–7,000 registered users.

### Cited Findings
- The Pup paper (1979/80) reports an operational internet of **about 1000 computers on 25 networks of 5 different types, using 20 internetwork gateways**. — [Semantic Scholar abstract of Boggs et al.](https://www.semanticscholar.org/paper/Pup:-An-Internetwork-Architecture-Boggs-Shoch/741882d8dfa32605b10187709d219f43f662c3e5) (search summary)
- The Worm experiments ran on **over a hundred Altos** on the PARC Ethernet. — [Schafhalter notes](https://pschafhalter.com/blog/os-prelim/distributed-systems/worm-programs/); [CSMonitor 1981](https://www.csmonitor.com/1981/1021/102126.html) (search summary)
- Lampson counts "the 150 Altos" at PARC and, elsewhere, "the 150 Altos or 50 Dorados available at PARC". — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- By 1979, nearly **1,000** Ethernet-linked Altos were in operation at Xerox and another **500** at collaborating universities and government offices. Total production is given as about 120 Alto Is and about 2,000 Alto IIs. — [Wikipedia: Xerox Alto](https://en.wikipedia.org/wiki/Xerox_Alto) (search summary)
- The PARC Ethernet included a high-performance laser printer, an Alto-based file server with hundreds of megabytes, and **gateways to other Xerox sites' networks and to the ARPANET**. — [Wikipedia: Xerox Alto](https://en.wikipedia.org/wiki/Xerox_Alto) (search summary)
- Growth to "hundreds of machines" broke the simple Pup-name and Tenex-mail approach, prompting Grapevine in 1980. By about 1985 Grapevine served about **2,000 machines and 7,000 users**. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- About **50 Dover/Spruce** print servers were built and distributed. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- "Dozens" of IFS servers were installed. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
- A good on-screen stat block for about 1979–80 is "~1,000 hosts · 25 nets · 20 gateways". Label it as the Pup paper's own figure. Most of those hosts were Altos, with some Novas, MAXC/Tenex and other machines. The 5 network types probably included 3 Mbit Ethernet, leased lines, ARPANET and packet radio, but that is unverified.
- Because networks were 8-bit numbered, 25 nets used about 10% of the Pup network-number space. Hosts per net were also capped at 256 by the 8-bit address, which explains why DIX moved to 48-bit addresses.

### Gaps
- I could not confirm the breakdown of the 5 network types or the geographic spread (Palo Alto, El Segundo, Webster, and so on) from the Pup paper.
- The "A Field Guide to Alto-Land" (April 1979) would give precise server names and counts, but it was blocked.
- The Alto production totals (about 2,000) come from Wikipedia and should be cross-checked with the hardware researcher's notes.

---

## 6. Anecdotes and "clever ideas worth animating"

### Takeaway
The strongest story beats all come with sources:
- the memo that renamed the "ALTO ALOHA Network" to "the ETHER Network";
- the physics-myth name;
- Xerox lawyers gagging PARC staff at the TCP meetings until someone blurted "You guys have already done this, haven't you?";
- EARS's absurd surplus capacity;
- printers that must "race the paper";
- a broadcast packet that literally carries boot code ("Breath of Life");
- a sci-fi-named worm that took down dozens of Altos overnight.

### Cited Findings
- The memo's cover note (May 22, 1973) proposed renaming "the ALTO ALOHA Network" to "The ETHER Network". — [CHM TDIH](https://www.computerhistory.org/tdih/may/22/); [ETHW](https://ethw.org/Ethernet) (search summary)
- Metcalfe chose "ether" after a discredited 19th-century concept, on purpose, because it stood for a passive, medium-agnostic carrier. — [DEV article](https://dev.to/fluidwire/why-ethernet-is-named-after-a-physics-myth-44ae) (search summary)
- At an INWG meeting, Xerox attendees who were barred from discussing Pup kept poking holes in proposals until a Stanford participant said "You guys have already done this, haven't you?" — [Wikipedia: PUP](https://en.wikipedia.org/wiki/PARC_Universal_Packet) (search summary)
- Metcalfe insisted that Lampson and Thacker be named on the Ethernet patent. — [Wikipedia: David Boggs](https://en.wikipedia.org/wiki/David_Boggs) (search summary)
- EARS could print 80 pages an hour for each person in a 40-person lab, and "of course we never used more than a fraction of its capacity" (Lampson). — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- EARS's controller hardware was about three times the size of the Alto driving it. Dover's Orbit board was about half the Alto's size, which Lampson calls "a better balance". — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- Press moved fonts into the printer "since font management proved to be too hard for document creators" (Lampson). — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- WFS was built in two months on a Data General Nova, because it did nothing but move 512-byte pages. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)
- The "Breath of Life" boot broadcast carried the Alto's Ethernet bootstrap code inside the packet itself. — [IFS repo, read](https://github.com/livingcomputermuseum/IFS)
- The Worm was named after Brunner's *Shockwave Rider* tapeworm. A corrupted worm crashed dozens of machines overnight. — [Wikipedia: John Shoch](https://en.wikipedia.org/wiki/John_Shoch); [Wikipedia: Computer worm](https://en.wikipedia.org/wiki/Computer_worm) (search summary)
- Shoch's rule, as cited in RFC 791: "A name indicates what we seek." An address says where it is, and a route says how to get there. — [RFC 791](https://www.rfc-editor.org/info/rfc791/) (search summary)
- Lampson frames the whole enterprise as "personal distributed computing": a system built at PARC between 1973 and 1978 and extended from 1978 to 1983, which by 1976 already "met nearly all" the computing needs of the labs. — [Lampson, read](https://www.microsoft.com/en-us/research/wp-content/uploads/1988/01/ACM-Alto-software-paper.pdf)

### Inferences
Suggested animation sequence for the "distributed system, not standalone machine" argument:
1. An Alto boots from the wire (BOL).
2. The user logs in; Grapevine authenticates.
3. The user pulls a file from IFS via FTP over Pup.
4. The user edits it and sends a Press file to the Dover/Spruce print server, where the imager races the paper.
5. The user mails it via Laurel/Grapevine to a colleague at another site, with the packet crossing a gateway.
6. At night, idle Altos get recruited by worms.

Each step is supported by the findings above.

### Gaps
- No verified sources were reachable for:
  - the "first laser-printed page" anecdote;
  - a specific Ethernet collision demonstration;
  - Metcalfe's personal telling of the naming beyond the memo cover note.
- Starkweather's and Metcalfe's CHM/ETHW oral histories should be checked for these.
