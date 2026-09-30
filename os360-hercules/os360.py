#!/usr/bin/env python3
"""Boot OS/360 MVT under Hercules, run some jobs, and shut it down again.

    os360.py [options] RUNDIR [DECK ...]

RUNDIR is where Hercules runs: it holds mvt.conf's dasd/, prt/, pun/ and
log/ directories.  Each DECK is a card deck, a text file with one card per
line, that goes through the card reader as a job.

The master console, 010, is a 3270; this script drives it through s3270.
The other console, 01F, is built into Hercules, so its output turns up in
the Hercules log and commands go to it on Hercules' standard input.  The
session is written to stdout and RUNDIR/transcript.txt, with the operator's
input marked by where it was typed:

    herc>   a Hercules command
    010>    the 3270 master console
    01F>    the typewriter console built into Hercules
"""

import argparse
import os
import re
import subprocess
import sys
import time


class Failure(Exception):
    pass


class Transcript:
    def __init__(self, path):
        self.file = open(path, 'w')

    def write(self, line):
        line = line.rstrip()
        self.file.write(line + '\n')
        self.file.flush()
        print(line, flush=True)


class Hercules:
    """Hercules without its panel: commands in on stdin, log out on stdout."""

    def __init__(self, exe, conf, rundir, transcript):
        self.transcript = transcript
        logpath = os.path.join(rundir, 'hercules.log')
        self.proc = subprocess.Popen(
            [exe, '-n', '-f', conf], cwd=rundir, text=True,
            stdin=subprocess.PIPE, stdout=open(logpath, 'w'),
            stderr=subprocess.STDOUT)
        self.log = open(logpath)
        self.partial = ''
        self.consolelines = []

    def pump(self):
        """Read new log lines, copying console 01F's output to the
        transcript.  Returns the new lines."""
        self.partial += self.log.read()
        *lines, self.partial = self.partial.split('\n')
        for line in lines:
            # Log lines start with a timestamp.  01F's output looks like
            # "hh:mm:ss /*00 IEE114A ...", and what we type at it is
            # echoed in an HHC00013I message.
            m = re.match(r'\d\d:\d\d:\d\d /(.*)', line)
            if m:
                self.transcript.write(m.group(1).rstrip())
                self.consolelines.append(m.group(1))
            m = re.match(r'\d\d:\d\d:\d\d HHC00013I .*: "(.*)"$', line)
            if m:
                self.transcript.write('01F> ' + m.group(1))
        if self.proc.poll() is not None:
            raise Failure('Hercules has stopped')
        return lines

    def command(self, cmd, shown=None):
        """A Hercules command, or with a leading slash, an OS/360 one.
        The transcript shows it as shown, if that's given."""
        if not cmd.startswith('/'):
            self.transcript.write('herc> ' + (shown or cmd))
        self.proc.stdin.write(cmd + '\n')
        self.proc.stdin.flush()

    def wait_log(self, pattern, timeout):
        """Wait for a line of the Hercules log to match."""
        end = time.time() + timeout
        while time.time() < end:
            for line in self.pump():
                m = re.search(pattern, line)
                if m:
                    return m
            time.sleep(0.2)
        raise Failure(f'timed out waiting for {pattern!r} in the Hercules log')

    def wait_console(self, pattern, timeout, start=0):
        """Wait for console 01F to show a matching line, looking back as
        far as its start'th line.  Returns the match."""
        end = time.time() + timeout
        seen = start
        while True:
            self.pump()
            for line in self.consolelines[seen:]:
                m = re.search(pattern, line)
                if m:
                    return m
            seen = len(self.consolelines)
            if time.time() > end:
                raise Failure(f'timed out waiting for {pattern!r} on the console')
            time.sleep(0.2)

    def quit(self):
        """Stop Hercules.  It reads commands from standard input as a
        script, and only exits once that script has ended."""
        if self.proc.poll() is None:
            try:
                self.command('quit')
                self.proc.stdin.close()
                self.proc.wait(30)
            except (OSError, subprocess.TimeoutExpired):
                self.proc.kill()
                self.proc.wait()


class Master3270:
    """The 3270 master console, through s3270."""

    def __init__(self, port, devnum, transcript, hercules):
        self.transcript = transcript
        self.hercules = hercules
        # Hercules gives us the device in the "@devnum" suffix of the
        # terminal type
        self.proc = subprocess.Popen(
            ['s3270', '-model', '3278-2', '-tn', f'IBM-3278-2@{devnum}'],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        self.action(f'Connect(localhost:{port})')

    def action(self, action):
        self.proc.stdin.write(action + '\n')
        self.proc.stdin.flush()
        out = []
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise Failure('s3270 has stopped')
            line = line.rstrip('\n')
            if line == 'ok':
                return out
            if line == 'error':
                raise Failure(f's3270: {action} failed: {out}')
            out.append(line)

    def screen(self):
        return [l[6:].rstrip() for l in self.action('Ascii()')
                if l.startswith('data: ')]

    def wait(self, pattern, timeout, record=False):
        """Wait for the screen to show a line that matches, and copy that
        line to the transcript if record is set."""
        end = time.time() + timeout
        while time.time() < end:
            self.hercules.pump()
            for line in self.screen():
                m = re.search(pattern, line)
                if m:
                    if record:
                        self.transcript.write(line.lstrip(' |'))
                    return m
            time.sleep(0.5)
        raise Failure(f'timed out waiting for {pattern!r} on the 3270')

    def type(self, text):
        self.transcript.write('010> ' + text)
        if text:
            self.action(f'String("{text}")')
        self.action('Enter')

    def stop(self):
        if self.proc.poll() is None:
            self.proc.stdin.close()
            self.proc.wait()


def run(args, transcript):
    herc = Hercules(args.hercules, args.conf, args.rundir, transcript)
    master = None
    try:
        port = herc.wait_log(r'HHC01024I Waiting for console connections '
                             r'on port (\d+)', 30).group(1)
        master = Master3270(port, '0010', transcript, herc)
        herc.wait_log(r'0:0010 COMM: client .* connected', 30)

        # NIP talks only to the master console.  Take the default system
        # parameters.
        herc.command('ipl 150')
        master.wait(r'IEA101A', 120)
        for line in master.screen():
            if line.strip():
                transcript.write(' ' + line.lstrip(' |'))
        master.type('')

        # The master scheduler asks for the date and whether to start ASP
        # automatically.  We want HASP instead.  Before answering, have
        # 01F show jobs starting and ending too, and have the 3270 roll its
        # messages off when the screen is full rather than stop.
        herc.wait_console(r'IEE114A', 120)
        herc.command('/mn jobnames,t')
        master.type('k s,del=r,rnum=19,rtme=1')
        master.wait(r'IEE163I MODE= R', 30)
        master.type(f'r 0,date={args.date},auto=n')
        reply = master.wait(r'\*(\d\d) \$ SPECIFY HASP OPTIONS', 120,
                            record=True).group(1)
        master.type(f'r {reply},warm,noreq')
        herc.wait_console(r'ALL AVAILABLE FUNCTIONS COMPLETE', 120)

        for deck in args.decks:
            mark = len(herc.consolelines)
            herc.command(f'devinit 00c {os.path.abspath(deck)} eof',
                         f'devinit 00c {deck} eof')
            job = herc.wait_console(r'JOB +(\d+) ON READER1', 60, mark).group(1)
            herc.wait_console(rf'JOB +{job} IS PURGED', args.timeout, mark)

        # Stop HASP, and then the system
        herc.command('/$phasp')
        herc.wait_console(r'IEF404I HASP +ENDED', 60)
        herc.command('/z eod')
        herc.wait_console(r'IEE334I HALT +EOD SUCCESSFUL', 60)
        time.sleep(1)
        herc.pump()
    finally:
        if master:
            master.stop()
        herc.quit()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--hercules', default='hercules',
                    help='the hercules program')
    ap.add_argument('--conf', default=os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 'mvt.conf'),
        help='Hercules configuration')
    ap.add_argument('--date', default='64.098',
                    help="date for the operator to give, YY.DDD")
    ap.add_argument('--timeout', type=int, default=900,
                    help='seconds to allow each job')
    ap.add_argument('rundir')
    ap.add_argument('decks', nargs='*')
    args = ap.parse_args()
    args.conf = os.path.abspath(args.conf)

    transcript = Transcript(os.path.join(args.rundir, 'transcript.txt'))
    try:
        run(args, transcript)
    except Failure as e:
        print(f'os360.py: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
