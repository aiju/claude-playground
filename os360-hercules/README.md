# OS/360 on Hercules

IBM's OS/360, the operating system written for the System/360, running on the [Hercules](https://sdl-hercules-390.github.io/html/) mainframe emulator. [`run.sh`](run.sh) builds Hercules, downloads a ready-to-run OS/360 MVT 21.8F system, IPLs it and starts HASP. It then reads a job in through the card reader and shuts the system down again. The job is a System/360 assembler program that prints the Mandelbrot set on the 1403 printer:

```
      THE MANDELBROT SET, COMPUTED IN SYSTEM/360 HEXADECIMAL FLOATING POINT           DATE 64.098   TIME 18.17.40

                                                                                   ............
                                                                              ........,;::,,,.......
                                                                          ..........,,:;--;:,,,,.......
                                                                       ...........,,,,::-X-;::::,........
                                                                     ............,,,,::;;-+--*==:,.........
                                                                  .............,,,,,,:;;;-=+*=-;::,,.........
                                                                ..............,,,,,,:;;;-==*+=-;;:,,,,........
                                                              ..............,,,,,,::;-+==+@@#+---;:,,,,,........
                                                            ..............,,,,,:::;;*+X#X#@@#X+++-;:,,,,,,.......
                                                          ..............,,,,:::::;;;-=*#@@@@@@@%=-;;::,,,,,,,.....
                                                        ..............,,,::::::;;;;;-+@@@@@@@@@X+-;;;::::,,,,,,....
                                                      ............,,,,:;;;;;;;;;;----=+@@@@@@@@X=--;;;;::::::;;,,...
                                                    ...........,,,,,::;++%%=----*X=+@++*@@@@@%*++++=+%+;;;;;;-*;:,...
                                                  .........,,,,,,,:::;;%X*X%%%=+@@#@@@@@@@@@@@@@@@@@@@+---==-=#--,,...
                                                ......,,,,,,,,,,,::::;;-=*@@@@#@@@@@@@@@@@@@@@@@@@@@@@X@=*XX*X*+;:,,..
                                              ....,,,,,,,,,,,,,:::::;;;-=*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*=-;:,,...
                                           ....,,,,,,,,,,,,,,::::::;-=+=+*%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=;;:,,,...
                                       .....,:::::,,,,,,,,::::::;;;-*%XX#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=-;;::,,...
                                  .......,,:==-::::::::::::;;;;;;;;-=*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@X-;;;,,....
                             .........,,,,::;+-;;;;;;;==;;;;;;;;;;-=**#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+*=%-:,....
                         ...........,,,,,:::;=====----*+=---;;;---=+#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%-:,.....
                       ...........,,,,,,,::;;--=*%*+==+X%+X+=-----X%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=;;:,.....
                     ...........,,,,,,,,::;;;--+X@@@X@@@@#%@*@====+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+==;:,.....
                   ............,,,,,,,,:;;;;--==+X@@@@@@@@@@@@%+++@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+;,,......
                  ...........,,,,,,,,::;;;--=+%#@@@@@@@@@@@@@@@@**@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=;:,,......
                 ...........,,::::::;;;+=--==*%@@@@@@@@@@@@@@@@@@X@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=;::,,......
                ...,,....,,::::::;;;;;-=+*+***@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+-;:,,,......
                .,,,:::;;-;;;;;;;;;-X-=*+#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=;;::,,,......
                @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@X+=-;;::,,,......
                .,,,:::;;-;;;;;;;;;-X-=*+#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=;;::,,,......
                ...,,....,,::::::;;;;;-=+*+***@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+-;:,,,......
                 ...........,,::::::;;;+=--==*%@@@@@@@@@@@@@@@@@@X@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=;::,,......
                  ...........,,,,,,,,::;;;--=+%#@@@@@@@@@@@@@@@@**@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=;:,,......
                   ............,,,,,,,,:;;;;--==+X@@@@@@@@@@@@%+++@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+;,,......
                     ...........,,,,,,,,::;;;--+X@@@X@@@@#%@*@====+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+==;:,.....
                       ...........,,,,,,,::;;--=*%*+==+X%+X+=-----X%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=;;:,.....
                         ...........,,,,,:::;=====----*+=---;;;---=+#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%-:,.....
                             .........,,,,::;+-;;;;;;;==;;;;;;;;;;-=**#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+*=%-:,....
                                  .......,,:==-::::::::::::;;;;;;;;-=*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@X-;;;,,....
                                       .....,:::::,,,,,,,,::::::;;;-*%XX#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=-;;::,,...
                                           ....,,,,,,,,,,,,,,::::::;-=+=+*%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+=;;:,,,...
                                              ....,,,,,,,,,,,,,:::::;;;-=*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*=-;:,,...
                                                ......,,,,,,,,,,,::::;;-=*@@@@#@@@@@@@@@@@@@@@@@@@@@@@X@=*XX*X*+;:,,..
                                                  .........,,,,,,,:::;;%X*X%%%=+@@#@@@@@@@@@@@@@@@@@@@+---==-=#--,,...
                                                    ...........,,,,,::;++%%=----*X=+@++*@@@@@%*++++=+%+;;;;;;-*;:,...
                                                      ............,,,,:;;;;;;;;;;----=+@@@@@@@@X=--;;;;::::::;;,,...
                                                        ..............,,,::::::;;;;;-+@@@@@@@@@X+-;;;::::,,,,,,....
                                                          ..............,,,,:::::;;;-=*#@@@@@@@%=-;;::,,,,,,,.....
                                                            ..............,,,,,:::;;*+X#X#@@#X+++-;:,,,,,,.......
                                                              ..............,,,,,,::;-+==+@@#+---;:,,,,,........
                                                                ..............,,,,,,:;;;-==*+=-;;:,,,,........
                                                                  .............,,,,,,:;;;-=+*=-;::,,.........
                                                                     ............,,,,::;;-+--*==:,.........
                                                                       ...........,,,,::-X-;::::,........
                                                                          ..........,,:;--;:,,,,.......
                                                                              ........,;::,,,.......
                                                                                   ............

      X FROM -2.25 TO 0.75, Y FROM -1.17 TO 1.17.  @ MEANS STILL BOUNDED AFTER 64 ITERATIONS.
```

## Run it

```sh
./run.sh
```

You need git, make, a C compiler, libltdl (`apt install libltdl-dev`), curl, unzip, python3 and s3270 from the x3270 suite (`apt install s3270`). The first time, the script builds SDL Hercules 4.9 and downloads Kevin Leonard's turnkey MVT system (a 45 MB zip) from [Jay Maynard's collection of IBM public domain software](https://www.ibiblio.org/jmaynard/). Everything goes in `build/`. Building Hercules takes a couple of minutes. After that, a run takes less than ten seconds: it boots OS/360 from a fresh copy of the disks, runs the job, and leaves the printout in `build/printout.txt` and the console session in `build/transcript.txt`. [`transcript.txt`](transcript.txt) and [`printout.txt`](printout.txt) here are from one such run.

To run other jobs, give their card decks to the script: `./run.sh jobs/mandel.jcl my-job.jcl`.

## The session

The system has two consoles. The master console, 010, is a 3270 display, and [`os360.py`](os360.py) works it through s3270. The second, 01F, is a 1052 typewriter console built into Hercules, so everything OS/360 types on it ends up in the Hercules log, and that makes up most of the transcript. In the transcript, `herc>` marks a Hercules command, `010>` something typed on the 3270, and `01F>` something typed on the 1052.

This is what the operator does:

```
herc> ipl 150                          load the system from the pack on drive 150
010>                                   take the default system parameters
010> k s,del=r,rnum=19,rtme=1          let old messages roll off the 3270's screen
01F> mn jobnames,t                     show jobs starting and ending on the 1052 too
010> r 0,date=64.098,auto=n            it's 7 April 1964; start HASP, not ASP
010> r 01,warm,noreq                   warm start HASP
herc> devinit 00c jobs/mandel.jcl eof  put the deck in the card reader
01F> $phasp                            stop HASP when the job is done
01F> z eod                             halt the system
```

OS/360 can't cope with dates after 1999, so Hercules sets its clock back 28 years, which keeps the days of the week right. The operator then gives the date at IPL, like operators did, and 7 April 1964 is the day IBM announced the System/360. The date shows up in the heading of the printout and in the names of the job's temporary data sets, like `SYS64098.T181739.RV000.MANDEL.SYSUT1`.

HASP reads the deck and runs the job in one of its three initiators. The job uses the catalogued procedure ASMFCLG, which has three steps. Assembler F assembles the program, the linkage editor links it, and the GO step runs it. HASP prints the output on PRINTER1, the 1403 at 00E.

## The program

[`jobs/mandel.jcl`](jobs/mandel.jcl) is the whole deck: the JCL, and then the program as cards for the assembler.

Each of the 120 × 57 print positions is a point c of the complex plane. Starting from z = 0, the program sets z to z² + c until |z| > 2 or it has done it 64 times, and prints a character for the number of iterations. The 1403 prints 10 characters to the inch across and 6 lines to the inch down, so a line down is 10/6 of a column across. The line of `@` along the middle is the real axis: every point on it from −2 to ¼ is in the set.

It is written for the System/360, so it sticks to instructions the S/360 had:

- **Floating point** is IBM's hexadecimal floating point, in long format: a sign, a 7-bit exponent of 16, and a fraction of 14 hex digits. The S/360 has only four floating point registers, 0, 2, 4 and 6. The loop keeps z in two of them, works in the other two, and keeps c and z's imaginary part squared in storage.
- **Integer to float** has no instruction. `FLOAT` puts the integer in the low word of a long float whose exponent is 16¹⁴, so that the fraction's hex digits count units, and adds it to zero, which normalises it.
- **Blanking a line** is `MVI LINE,C' '` followed by `MVC LINE+1(132),LINE`. MVC moves a byte at a time from left to right, so the blank spreads along the line.
- **The date and time** come from the `TIME DEC` macro as packed decimal, and `UNPK` turns them into characters.

ASMFCLG asks for its work files on separate channels and drives. This system has only two public work packs, both on channel 1, so the job overrides those requests. Without that, OS/360 stops and asks the operator which drive to use.

[`reference.py`](reference.py) is the same calculation in Python, in IEEE double precision. The printout matches it exactly:

```sh
python3 reference.py build/printout.txt    # 0 of 6840 points differ
```

## S/360 or S/370?

Hercules can't be a System/360. Its oldest architecture is the System/370, the S/360's successor, which IBM made compatible with S/360 programs. OS/360 was written for the S/360, and release 21.8 was its last. This copy was generated for a System/370 Model 158, which is why it says `IEA218I MOD=158 ASSUMED S370` when it loads. Some of the hardware in the configuration is from the S/370's time too, like the 3330 disk drives and the 3270 display.

## Using it yourself

After `./run.sh`, `build/run` holds a set of disks you can boot by hand. Start Hercules there:

```sh
cd build/run
../hercules/bin/hercules -f ../../mvt.conf
```

Connect a 3270 emulator to port 3270, for example `c3270 localhost:3270` in another terminal. The first terminal to connect becomes 010, the master console, which has to be there before the IPL. Then:

1. At the Hercules prompt, type `ipl 150`.
2. On the 3270, press Enter at `IEA101A SPECIFY SYSTEM PARAMETERS`.
3. At `IEE114A`, type `k s,del=r,rnum=19,rtme=1` so that old messages roll off the screen rather than stop it when it's full. Then reply `r 0,auto=n`.
4. At `$ SPECIFY HASP OPTIONS`, reply `r 1,warm,noreq`.

To submit a job, put it in the card reader from the Hercules prompt with `devinit 00c path/to/job.jcl eof`. The printout collects in `prt/prt00e.txt`. You can give OS/360 and HASP commands on the 1052 from the Hercules prompt by starting them with a slash: `/d a` shows what's running, `/$da` what HASP is doing. To shut down, type `/$phasp`, then `/z eod`, then `quit`.

Every job card needs a `REGION`, such as `REGION=256K`. Without one, the initiator runs out of storage and abends with `S804`.

### TSO

The system has TSO, with three terminals: 0C0, 0C1 and 3C0. Once HASP is up, start TCAM and then TSO from the Hercules prompt with `/s tcam` and `/s tso`. Connect a 3270 emulator to one of the terminals. Hercules picks the device from a suffix on the terminal type, so for 0C0:

```sh
c3270 -tn IBM-3278-2@0C0 localhost:3270
```

Press Clear, and TSO answers `IKJ54012A ENTER LOGON -`. Don't type after the prompt: TSO takes the whole line as your input, prompt and all, and rejects it. Move the cursor to the top left, press Erase EOF to empty the screen, and then type `LOGON HERC01`. HERC01 has no password.

```
LOGON HERC01
 IKJ56455I HERC01 LOGON IN PROGRESS AT 18:12:32 ON SEPTEMBER 30, 1998
 IKJ56951I NO BROADCAST MESSAGES
 READY
WHO
 You are TSO user HERC01 at terminal 0C0
   logged on to OS/360 MVT system ASP1
   day Wednesday - date 1998/09/30 - time 18.12.48
 READY
```

`LOGOFF` logs you off. Stop TSO with `/p tso` and TCAM with `/z tp` before you stop HASP.

## Files

| File | What it is |
| --- | --- |
| `run.sh` | Builds Hercules, fetches OS/360, and runs the jobs |
| `os360.py` | Boots the system and works the consoles |
| `mvt.conf` | The Hercules configuration |
| `jobs/mandel.jcl` | The Mandelbrot program and its JCL |
| `reference.py` | The Mandelbrot program in Python, and a checker for the printout |
| `transcript.txt` | The console session from one run |
| `printout.txt` | What the 1403 printed in that run |

## Thanks

To Kevin Leonard, who built the turnkey MVT system with HASP and ASP; to Jay Maynard, who keeps the collection of IBM public domain software it comes from; and to Roger Bowler, Jan Jaeger and everyone else who has worked on Hercules.
