#!/usr/bin/env bash
# Boot OS/360 on Hercules and run a job on it.
#
# Builds SDL Hercules, downloads Kevin Leonard's turnkey OS/360 MVT 21.8F
# system, IPLs it, starts HASP, reads the jobs in through the card reader
# and shuts the system down again.  With no arguments the job is
# jobs/mandel.jcl.
#
# Everything it downloads or makes goes in build/.  Set HERCULES to use a
# hercules binary you already have.
set -euo pipefail

cd "$(dirname "$0")"
HERE=$PWD
BUILD=$HERE/build

HERC_REPO=https://github.com/SDL-Hercules-390/hyperion.git
HERC_COMMIT=2d2c4054e442b491314ec9c6e51806cdc4277c70  # Release_4.9
# The turnkey system, from Jay Maynard's collection of IBM public domain
# software (https://www.ibiblio.org/jmaynard/)
MVT_URL=https://www.ibiblio.org/jmaynard/asp.zip
MVT_SHA256=78a29dc7231c1b06a9390388d48b0545e2c3fc052536914940765fbcecb0c66c

if [ $# -eq 0 ]; then
    set -- jobs/mandel.jcl
fi

if ! command -v s3270 > /dev/null; then
    echo "run.sh needs s3270, from the x3270 suite (apt install s3270, brew install x3270)" >&2
    exit 1
fi

mkdir -p "$BUILD"

sha256() {
    if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

# Hercules
HERCULES=${HERCULES:-$BUILD/hercules/bin/hercules}
if [ ! -x "$HERCULES" ]; then
    echo "Building Hercules (log in build/hercules-build.log)..."
    rm -rf "$BUILD/hyperion" "$BUILD/hercules"
    git init -q "$BUILD/hyperion"
    git -C "$BUILD/hyperion" fetch -q --depth 1 "$HERC_REPO" "$HERC_COMMIT"
    git -C "$BUILD/hyperion" checkout -q FETCH_HEAD
    jobs=$(getconf _NPROCESSORS_ONLN 2> /dev/null || echo 2)
    if ! (cd "$BUILD/hyperion" &&
          ./configure --prefix="$BUILD/hercules" &&
          make -j"$jobs" &&
          make install) > "$BUILD/hercules-build.log" 2>&1; then
        tail -20 "$BUILD/hercules-build.log"
        echo "Hercules didn't build.  If it's lt_dlerror that's missing, install libltdl (apt install libltdl-dev, brew install libtool)." >&2
        exit 1
    fi
fi

# The turnkey system
if [ ! -f "$BUILD/asp/dasd/aspres.150.cckd" ]; then
    echo "Downloading the turnkey MVT system..."
    curl -fL --progress-bar -o "$BUILD/asp.zip" "$MVT_URL"
    if [ "$(sha256 "$BUILD/asp.zip")" != "$MVT_SHA256" ]; then
        echo "asp.zip doesn't have the expected checksum" >&2
        exit 1
    fi
    unzip -o -q "$BUILD/asp.zip" -x '__MACOSX/*' '*.DS_Store' -d "$BUILD"
fi

# A fresh copy of the disks for this run, and empty printers, punch and logs
RUN=$BUILD/run
rm -rf "$RUN"
mkdir -p "$RUN/dasd" "$RUN/prt" "$RUN/pun" "$RUN/log"
cp "$BUILD"/asp/dasd/*.cckd "$RUN/dasd/"

echo "Booting OS/360..."
limit=()
if command -v timeout > /dev/null; then limit=(timeout 1800); fi
"${limit[@]}" python3 os360.py --hercules "$HERCULES" "$RUN" "$@"
cp "$RUN/transcript.txt" "$BUILD/transcript.txt"
tr -d '\r' < "$RUN/prt/prt00e.txt" > "$BUILD/printout.txt"
echo "Done: the printout is in build/printout.txt, and the console session in build/transcript.txt"
