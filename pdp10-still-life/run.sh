#!/usr/bin/env bash
# Ray trace a still life, Clawd and a glass of water, on a simulated KA10.
#
# Builds simh's KA10 simulator, boots TOPS-10 6.03 on it, reads still.mac
# in from the paper tape reader, assembles and runs it with MACRO-10 and
# LINK-10, and turns what it punched on the paper tape punch into a PNG.
#
# Everything it downloads or makes goes in build/.  Set PDP10_KA to use a
# pdp10-ka binary you already have.
set -euo pipefail

cd "$(dirname "$0")"
HERE=$PWD
BUILD=$HERE/build

SIMH_REPO=https://github.com/open-simh/simh.git
SIMH_COMMIT=87eb7d5e96f9ce0ee6ac183e20160e5c486b0712
# TOPS-10 6.03 on four RP03 packs, set up for the KA10 by Richard Cornwell
# (https://sky-visions.com/dec/tops10.shtml)
DISKS_URL=https://sky-visions.com/dec/tops603/603_kadp_dsk.zip
DISKS_SHA256=6409d2f5a2d4ed8a9d4e826f6e702f0f4917e0db85fc281f39c7a93e8bd380dd

mkdir -p "$BUILD"

sha256() {
    if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

# The simulator
SIM=${PDP10_KA:-$BUILD/simh/BIN/pdp10-ka}
if [ ! -x "$SIM" ]; then
    echo "Building simh's pdp10-ka (log in build/simh-build.log)..."
    rm -rf "$BUILD/simh"
    git init -q "$BUILD/simh"
    git -C "$BUILD/simh" fetch -q --depth 1 "$SIMH_REPO" "$SIMH_COMMIT"
    git -C "$BUILD/simh" checkout -q FETCH_HEAD
    jobs=$(getconf _NPROCESSORS_ONLN 2> /dev/null || echo 2)
    if ! make -C "$BUILD/simh" -j"$jobs" pdp10-ka > "$BUILD/simh-build.log" 2>&1; then
        tail -20 "$BUILD/simh-build.log"
        exit 1
    fi
fi

# The disk packs
if [ ! -f "$BUILD/dsk/ka_dskb3.rp3" ]; then
    echo "Downloading the TOPS-10 6.03 disk packs..."
    curl -fL --progress-bar -o "$BUILD/603_kadp_dsk.zip" "$DISKS_URL"
    if [ "$(sha256 "$BUILD/603_kadp_dsk.zip")" != "$DISKS_SHA256" ]; then
        echo "603_kadp_dsk.zip doesn't have the expected checksum" >&2
        exit 1
    fi
    unzip -o -q "$BUILD/603_kadp_dsk.zip" -d "$BUILD"
fi

# A fresh copy of the packs for this run, the program on paper tape (with
# CR LF line ends), and a blank tape in the punch
RUN=$BUILD/run
rm -rf "$RUN"
mkdir -p "$RUN"
cp "$BUILD"/dsk/ka_dskb?.rp3 "$RUN/"
awk '{ printf "%s\r\n", $0 }' still.mac > "$RUN/still.ptr"
: > "$RUN/still.ptp"

# The simh script.  The expect rules type the answers to TOPS-10's
# questions in turn.  We log in as the operator, [1,2], because only a
# privileged job may turn off spooling and use the real punch.
cat > "$RUN/still.ini" << 'EOF'
set cpu 256k idle
set dpb disable
set mta disable
set dc disable
attach dpa0 ka_dskb0.rp3
attach dpa1 ka_dskb1.rp3
attach dpa2 ka_dskb2.rp3
attach dpa3 ka_dskb3.rp3
attach ptr still.ptr
attach ptp still.ptp
deposit ptp time 200
expect "RELOAD:" send "hard\r"; continue
expect "DATE:" send "05-25-78\r"; continue
expect "TIME:" send "1200\r"; continue
expect "STARTUP OPTION:" send "no ini\r"; continue
expect "\r\n." send "set tty lc\r"; continue
expect "\r\n." send "set tty width 132\r"; continue
expect "\r\n." send "login 1,2\r"; continue
expect "Password:" send "FAILSA\r"; continue
expect "\r\n." send "set spool none\r"; continue
expect "\r\n." send "copy still.mac=ptr:\r"; continue
expect "\r\n." send "execute still.mac\r"; continue
expect "CPU time.\r\n" send "kjob/f\r"; continue
expect "\r\n?" send "kjob/f\r"; continue
expect "\n\n." exit
send after=2000000 "\r"
boot dpa0
EOF

echo "Booting TOPS-10 and running STILL (about ten minutes)..."
limit=()
if command -v timeout > /dev/null; then limit=(timeout 3600); fi
(cd "$RUN" && "${limit[@]}" "$SIM" still.ini < /dev/null 2>&1 | tee console.log) || true
tr -d '\r' < "$RUN/console.log" | cat -s > "$BUILD/transcript.txt"
if ! grep -q "CPU time" "$BUILD/transcript.txt"; then
    tail -30 "$BUILD/transcript.txt"
    echo "STILL didn't finish; the whole console log is in build/transcript.txt" >&2
    exit 1
fi
python3 untape.py "$RUN/still.ptp" "$BUILD/still-life.png"
echo "Done: build/still-life.png, and the console session in build/transcript.txt"
