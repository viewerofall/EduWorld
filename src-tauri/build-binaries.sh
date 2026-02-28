#!/usr/bin/env bash
# build-binaries.sh
# Run this BEFORE `tauri build` to compile all hello world binaries.
# Requires: nasm, ld (binutils), gcc, g++, zig, gfortran
#
# CachyOS / Arch: sudo pacman -S nasm gcc zig gcc-fortran

set -e

BINDIR="binaries"
cd "$(dirname "$0")"

echo "==> Compiling hello world binaries..."

# ── x86-64 Assembly ──
echo "  [1/5] ASM (nasm + ld)"
nasm -f elf64 "$BINDIR/hello.asm" -o /tmp/hello_asm.o
ld /tmp/hello_asm.o -o "$BINDIR/hello_asm"
rm /tmp/hello_asm.o

# ── C ──
echo "  [2/5] C (gcc -O2 -std=c99)"
gcc -O2 -std=c99 "$BINDIR/hello.c" -o "$BINDIR/hello_c"

# ── C++ ──
echo "  [3/5] C++ (g++ -O2 -std=c++20)"
g++ -O2 -std=c++20 "$BINDIR/hello.cpp" -o "$BINDIR/hello_cpp"

# ── Zig ──
echo "  [4/5] Zig (zig build-exe -O ReleaseSafe)"
zig build-exe "$BINDIR/hello.zig" -O ReleaseSafe \
    --name hello_zig \
    -femit-bin="$BINDIR/hello_zig"
# Zig emits a .o alongside — clean it up
rm -f "$BINDIR/hello_zig.o" "$BINDIR/hello_zig.pdb"

# ── Fortran ──
echo "  [5/5] Fortran (gfortran -O2)"
gfortran -O2 "$BINDIR/hello.f90" -o "$BINDIR/hello_fortran"

echo ""
echo "==> All binaries built:"
ls -lh "$BINDIR"/hello_{asm,c,cpp,zig,fortran}
echo ""
echo "==> Now run: cargo tauri build"
echo "    or:      cargo tauri dev"
