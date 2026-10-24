---
title: Making hexdump 23 times faster (and what I've learned)
date: 2026-08-03
lang: en
description: I made my from-scratch hexdump 23× faster on a 50 MiB file. The bit twiddling was the small part, most of the win was 128 million stdio calls becoming 800.
---

> Both versions are on my [Codeberg](https://codeberg.org/sprawz/c-learning/src/branch/main/projects/hexdump): `hexdumb.c` is the original, `hexdumb_buffered.c` is the one this post is about.

At the end of [writing hexdump from scratch](/posts/writing-hexdump-from-scratch/) I wrote this:

> Ideally I wouldn't use `printf()` for every row, to avoid the overhead of format-string parsing, but I don't know a good alternative yet.

That sentence bothered me for weeks. The program worked, the output matched hexdump byte for byte, but I knew it was leaving performance on the table. Eventually I decided to find out how much. After a bit of refactoring and a few benchmarks with [`hyperfine`](https://github.com/sharkdp/hyperfine), the answer turned out to be: quite a lot.

On a 50 MiB file:

```
Benchmark 1: ./hexdumb -C /tmp/big > /dev/null        (my v1)
  Time (mean ± σ):      1.754 s ±  0.018 s

Benchmark 2: ./hexbuff -C /tmp/big > /dev/null        (my v2)
  Time (mean ± σ):      75.7 ms ±   2.1 ms

Benchmark 3: xxd /tmp/big > /dev/null
  Time (mean ± σ):     759.5 ms ±  15.9 ms

Benchmark 4: hexdump -C /tmp/big > /dev/null
  Time (mean ± σ):      4.138 s ±  0.073 s

Benchmark 5: hexdump -Cv /tmp/big > /dev/null
  Time (mean ± σ):      4.224 s ±  0.094 s

Summary
  ./hexbuff ran
   10.03 ± 0.35 times faster than xxd
   23.17 ± 0.68 times faster than ./hexdumb
   54.65 ± 1.78 times faster than hexdump -C
```

23× over my own first attempt, 10× over `xxd`, 54× over the system `hexdump`. Output byte-for-byte identical to `hexdump -C`, verified with `diff` in both modes.

Before anyone gets excited about [bit twiddling](https://graphics.stanford.edu/~seander/bithacks.html): the bit twiddling is the *small* part. Let me break the number down honestly, because that's the part these posts usually skip.

## Where the 23× actually comes from

Three separate things changed, and they are not remotely equal in size.

**One: the number of stdio calls.** The old `canonical` made about 39 calls into stdio per line, between the `printf("%02x ")` per byte, the `putchar` per ASCII character, the separators and the newline. At 16 bytes per line, a 50 MiB file is 3,276,800 lines, which comes to roughly **128 million calls** into stdio.

The new version makes one `fwrite` per 64 KiB chunk. That's **800 calls**. Five orders of magnitude fewer.

**Two: what each of those calls costs.** Every `printf` parses its format string at runtime, walks the bytes, finds `%`, dispatches on the conversion, formats the argument. That work is identical every single time and it is thrown away every single time. On top of that, every stdio call takes and releases a lock on the stream, because C stdio is thread-safe whether you asked for it or not.

**Three: the hex conversion itself.** This is the nibble lookup, the thing I thought was the point when I started. It's real, and it's the smallest of the three.

So the headline isn't "hand-rolled hex beats printf". It's "one buffered write beats 128 million library calls". If I'd only replaced `printf("%02x ")` with a lookup table and kept calling it per byte, I'd have gotten a fraction of this.

## Why it also beats the system tools

54× faster than the tool shipped with my distro is the kind of claim that should make you suspicious, so here's the explanation.

**`hexdump` is not a hex dumper. It's a format interpreter.** Its actual interface is a format specification language, and `-C` is a canned preset that expands to something like `"%08.8_ax  " 8/1 "%02x " ... "|%_p|"`. util-linux parses that spec into a linked list of format units at startup, and then for **every byte** walks that structure, dispatches on the conversion type, and calls `printf` with a format string it looked up at runtime. My version has the layout compiled in.

The giveaway is in my own numbers: my *naive* v1, the one making 128 million stdio calls, already beat `hexdump` by 2.3×. If stdio overhead were the whole story that shouldn't be possible. The interpreter is the difference.

I also guessed that line deduplication was costing something, without `-v`, `hexdump` collapses runs of identical lines into `*`, which means comparing each line against the previous one. **That guess was wrong.** `-Cv` came in at 4.224 s against 4.138 s, identical within noise. Worth stating plainly, because I'd have published it as fact if I hadn't measured.

So the fair comparison isn't `hexdump` at all, it's `xxd`, which is purpose-built with no format engine. 10× is a much more meaningful number than 54×, and `perf` shows where `xxd` spends it:

```
12,40%  _IO_getc
 8,59%  __memset_avx512_unaligned_erms
 6,51%  __printf_buffer
 3,76%  _IO_fputs
 1,10%  __sprintf_chk
 1,07%  __vsprintf_internal
 1,06%  _itoa_word
```

`_IO_getc` at the top means it reads the input **one byte at a time** through stdio. Then it builds each line with `sprintf` and ships it with `fputs`. So: per-byte function call on the way in, format-string machinery on the way out.

The `__memset_avx512` at 8.6% is a nice detail, `xxd` uses the same blank-the-line-with-spaces trick I ended up at independently (more on that below). It's just paying for it on a small per-line buffer while doing `getc` per byte.

## The thing I actually learned: you can't optimize what you don't own

> This paragraph echoes the basic idea of antirez’s post [Control the ideas, not the code](https://antirez.com/news/169) 

The old render functions looked like this:

```c
static void canonical(const unsigned char buf[], size_t size, size_t row) {
    putchar(' ');
    for (size_t j = row; j < row + BYTES_PER_LINE; j++) {
        if (j % 8 == 0)
            putchar(' ');
        if (j < size)
            printf("%02x ", buf[j]);
        else
            printf("   ");
    }
    /* ... */
}
```
I sat there trying to work out how to put a nibble lookup into that, and I couldn't because **there was nowhere to put the two characters.** The function's job was to *emit*. It had no buffer, no position, no concept of a line as an object. Two characters had nowhere to go except straight out to stdout, one call at a time, which is the thing I was trying to eliminate.

The optimization was impossible until the architecture allowed it. So the order had to be:

1. change who owns the output
2. *then* optimize

And those had to be two separate steps, each verified independently, because changing the interface and the implementation at the same time is how you end up with broken output and no idea which change broke it.

The first thing I did, before touching a line of code, was this:

```bash
./hexdumb -C /bin/ls > /tmp/before.txt
```

After every single change I used `diff`to check I did not break something.

## The new shape

Three levels, each of which knows only its own job:

| function | takes | produces | owns |
|---|---|---|---|
| `hexdump` | a file | chunks | the input buffer, the output buffer, `fwrite` |
| `dump` | a chunk | rows | where each line lands in the output buffer |
| render | a row | one line | the column layout inside that line |

The render signature became:

```c
typedef size_t LineRender(unsigned char dst[], size_t dst_size,
                          const unsigned char buf[], size_t len, size_t addr);
```

A render function now builds a line into `dst` and returns how long that line is. It does not print, it doesn't know it's writing into the middle of a 320 KB buffer, doesn't know what a chunk is, doesn't know `fwrite` exists.

`dump` then just accumulates:

```c
static size_t dump(unsigned char out[], const size_t dst_size,
                   const DumpFmt *fmt, const unsigned char buf[], size_t size,
                   size_t offset) {
    size_t written = 0;
    for (size_t row = 0; row < size; row += BYTES_PER_LINE) {
        size_t line_size = min(BYTES_PER_LINE, size - row);
        written +=
            fmt->renderfn(out + written, min(MAX_LINE, dst_size - written),
                          buf + row, line_size, offset + row);
    }
    return written;
}
```

`written` is the only thing connecting the two levels. It means "byte offset in `out` where the next line starts", so `out + written` is where the next render writes. That's the whole mechanism.

Passing the address in as a parameter also let me delete `addr_width` from `DumpFmt` entirely. The 7-vs-8 column difference between the two formats *is* part of each format's layout, so each render now owns its own, and `DumpFmt` collapsed to a single function pointer.

## Positional writing, and how padding stopped existing

This is my favourite part of the rewrite, and it's the idea I'd keep if I forgot everything else.

There are two ways to fill a buffer.

**Sequential**: keep a cursor, append. `*p++ = c`. The layout emerges from the order of your writes.

**Positional**: decide the layout up front, compute each slot. `dst[pos(i)] = c`. Writes are independent of each other, and you can leave gaps.

Once I switched to positional, one line at the top of each render did something I didn't expect:

```c
memset(dst, ' ', dst_size);
```

Fill the whole line with spaces *before* writing anything. Now every gap in the output is already correct. And look what happened to the short-line handling. Old version:

```c
if (j < size)
    printf("%02x ", buf[j]);
else
    printf("   ");     /* pad the missing byte */
```

New version:

```c
if (i < len) {
    write_bytes(dst + pos, buf[i]);
    dst[ascii_pos++] = (buf[i] >= 0x20 && buf[i] <= 0x7e) ? buf[i] : '.';
}
```

There is no `else`. Absent bytes get **no code at all**, because the space is already there. Padding stopped being a case to handle and became the absence of one.

The catch is that the two techniques don't mix inside one field. If you `memset` and then advance a cursor, you consume the pre-filled spaces in order and a short line's ASCII column drifts left. I hit exactly that bug: my first attempt had a branch that advanced the cursor by 4 for a missing byte and 3 for a present one, and every short line came out one column off per missing byte.

The fix was to stop using a cursor for the hex field and compute the position instead:

```c
size_t pos = hex_start + i * 3 + (i / 8);
```

Three columns per byte, plus one extra per group of eight. No branch, correct by construction for any `i`. The group separator stopped being a special case and became a term in an expression.

The ASCII column *is* still a cursor, because it only ever appends and never leaves gaps. Mixed is fine when the fields genuinely differ.

## The nibbles

Now the part I originally thought was the whole story.

Hex is base 16, which is 2⁴, so one hex digit is exactly 4 bits and one byte is exactly two digits. No arithmetic needed, just cut the byte into two halves and use each as an index into a 16-character table:

```c
static const char hex[] = "0123456789abcdef";

static void write_bytes(unsigned char *dst, const unsigned char c) {
    dst[0] = hex[c >> 4];
    dst[1] = hex[c & 0x0f];
}
```

`>> 4` throws away the low four bits and slides the high four down into positions 0–3. `& 0x0f` doesn't move anything at all, it zeroes the high four and leaves the low four where they already were. **Shift moves, mask erases.** Both results are between 0 and 15 by construction, so no bounds check is ever needed.

`c / 16` and `c % 16` compile to the same instructions on an unsigned value, if you find that clearer. Dividing by a power of two *is* a shift.

One detail that matters: `buf` is `unsigned char`. On a signed `char` with the top bit set, `>>` is implementation-defined and can propagate the sign, giving you a negative index. The type is what makes this correct, not the shift.

The address uses the same trick, from the other end. To emit digits in the right order you walk the field right-to-left, taking the least significant nibble each time:

```c
static void write_offset(unsigned char line[], size_t addr_width,
                         size_t offset) {
    for (ssize_t i = addr_width - 1; i >= 0; i--) {
        line[i] = hex[offset & 0x0f];
        offset >>= 4;
    }
}
```

Zero-padding falls out for free, once `offset` hits zero you keep writing `'0'` into the remaining leading positions, which is exactly what `%08zx` does.

## A consequence I didn't expect

`hexdump` ends its output with a bare address, the total byte count, on its own line. In the old version that was a special `printf` after the loop.

In the new version I call the render with `len == 0`, that is:
```c
    if (offset > 0) {
        size_t len = fmt->renderfn(out, sizeof out, NULL, 0, offset);
        fwrite(out, 1, len, stdout);
    }
```
Here's `two_bytes`:

```c
size_t pos = addr_width + 1;
write_offset(dst, addr_width, addr);
for (size_t i = 0; i < len; i += 2) {
    /* ... */
    pos += 5;
}
dst[pos - 1] = '\n';
return pos;
```

With `len == 0` the loop never runs, `pos` stays at `addr_width + 1`, and `dst[pos - 1] = '\n'` puts the newline immediately after the address. The totals line comes out correct with no special case whatsoever.

I want to be honest that I did not plan this. I noticed it afterwards and checked that it held. 
That's a real thing about programming that I'm still getting used to: you don't hold the whole program in your head, and when a consequence surprises you the useful skill isn't foresight, it's being able to go back and verify. The design was clean enough to *have* a property I hadn't thought of, which I'll take.

`canonical` doesn't get this for free, its line ends with `|`, not a space, so overwriting the last character would eat the pipe. It needs an explicit early return such as:

```c
    if (len == 0) {
        dst[addr_width] = '\n';
        return addr_width + 1;
    }
```

## How I got the benchmark wrong four times

This is the part I'd want to read, so I'm keeping it in.
    if (len == 0) {    if (len == 0) {
        dst[addr_width] = '\n';
        return addr_width + 1;
    }
        dst[addr_width] = '\n';
        return addr_width + 1;
    }
**Attempt one.** I benchmarked on the source file itself, 7 KB.

```
./hexdumb ran 1.92 ± 1.03 times faster than ./hexbuff
```

The old version winning, by a factor with an error bar of ±1.03, the uncertainty was over half the effect. 7 KB is about 460 lines of output, microseconds of work inside a 1–2 ms process lifetime. I was measuring `fork` and `exec`, not my code. I'd also compiled without `-O2`, which makes any comparison about instruction counts meaningless.

**Attempt two.** Bigger file:

```bash
cat /usr/lib/libc.so.6 /usr/lib/libc.so.6 > /tmp/big
cat: /usr/lib/libc.so.6: No such file or directory
```

I didn't read that line. `/tmp/big` was zero bytes. I benchmarked an empty file, got beautifully precise numbers, and believed them.

**Attempt three.** Real 50 MiB file this time, and:

```bash
hyperfine -N --warmup 3 './hexdumb -C /tmp/big > /dev/null'
```

`-N` disables the shell. No shell means no redirect, so `>` and `/dev/null` were passed to my program as literal filenames. It dutifully told me `hexdumb >: No such file or directory` and then dumped 50 MiB to my terminal. (Small consolation: that was an accidental end-to-end test, and the output was correct.)

**Attempt four** gave me a clean 2.13×, with the *old* version winning. I then spent a genuinely embarrassing amount of time theorising about why: cache locality, the 320 KB output buffer blowing past L2, `fwrite` reading back memory that had already been evicted. Plausible. Confident. Detailed.

The binary was stale. I had rebuilt one and not the other, so I'd been measuring a build from before a one-line fix. `ls -l` on the source and the binary would have told me in two seconds.

The lesson is smaller and more useful than any of the theories: **verify the fixture before trusting the number.** Check the input exists. Check it's the size you think. Check the binary is newer than the source. Same reflex as running `diff` instead of eyeballing the output.

There was a real bug in there too, incidentally, and it's a nice one. I'd been passing the *remaining* buffer size to each render, so the first row of each chunk called `memset` over the entire remaining 320 KB. Per row. That's quadratic: 4096 rows each blanking up to 320 KB is around 650 MB of `memset` per 64 KB of input. `min(MAX_LINE, dst_size - written)` fixed it, each render only ever needs its own line blanked.

## What perf says

```
 Performance counter stats for './hexbuff -C /tmp/big':
       369 970 103      cycles
     1 750 069 046      instructions      #    4,73  insn per cycle
           401 857      cache-misses
```

4.73 instructions per cycle is close to what this machine can issue. 400k cache misses across 50 MiB of input is nothing, so the cache theory I'd invented in attempt four was wrong on the merits as well as being applied to the wrong binary. There is no memory bottleneck.

The profile is boring in the best way:

```
79,34%  canonical
 7,59%  [k] _copy_to_iter
 3,79%  __memset_avx512_unaligned_erms
 2,86%  hexdump
```

79% in the function that formats bytes, 7.6% in the kernel actually writing them out. Nothing wasted anywhere.

And then the annotated assembly gave me a present:

```asm
and    $0xf,%edx              ; buf[i] & 0x0f
shr    $0x4,%sil              ; buf[i] >> 4
movzbl (%r8,%rdx,1),%ebx      ; hex[low]
mov    (%r8,%rsi,1),%cl       ; hex[high]
mov    %cx,0xa(%rsi,%rdx,1)   ; both characters, one 16-bit store
```

That last instruction is the compiler noticing my two adjacent byte stores are contiguous and fusing them into a **single 16-bit write**. Two characters, one store. I didn't ask for that. It fell out of writing to fixed positions instead of calling a function.

Nearby, the printable-ASCII check:

```asm
cmp    $0x5f,%cl
cmovae %r10d,%edx
```

`cmovae` is a conditional move, **branchless**. The `(buf[i] >= 0x20 && buf[i] <= 0x7e) ? buf[i] : '.'` ternary compiled to no branch at all, which is why random binary input doesn't wreck the branch predictor.

## How much room is left

Ratios are a bad way to end, because they only tell you about the thing you're beating. Here's the absolute number.

A canonical line is 79 bytes including the newline. 3,276,800 lines is **246.9 MiB of output**, produced in 75.7 ms. That's about **3.4 GB/s**.

That is within range of plain `memcpy` bandwidth on this machine. Which means there is no second 23× hiding in here, and probably not another 2×: at this point most of the time is the cost of writing bytes into memory and the kernel copying them out again. The formatting has stopped being the bottleneck and the *data movement* is.

The one place left to look is the 7.9 ms of system time, now over 10% of the runtime. That's `write(2)`, and shrinking it would mean fewer and larger writes, or `vmsplice` to hand the kernel my pages instead of having it copy them. Not cleverer arithmetic. If I ever come back to this a third time, that's the direction, and it would be a different kind of post, about syscalls rather than about bytes.

Knowing where the floor is feels more useful than the speedup ratio. It tells me when to stop.

## What I learned

**The first working version is not the end.** That's the actual lesson, and it's why this post exists. v1 was correct, matched `hexdump` byte for byte, and I could have shipped it and moved on, I nearly did. The 23× was sitting there the whole time behind a design decision I'd made without noticing I was making it.

The technical version of that: I could not optimize the render functions until I'd changed what they were *responsible for*. Performance work that looks like it's about instructions is very often about interfaces first. Owning the output buffer was the change; the nibble lookup was a consequence.

**Positional beats sequential when the layout is fixed.** `memset` plus a position formula made an entire category of special case disappear, no padding branch, no group-separator branch. Fewer branches, and the layout stated once in an expression instead of emerging from control flow.

**My instincts about where time goes were wrong three times in one afternoon.** I assumed format-string parsing was the main cost (it was a distant second to call count). I diagnosed a cache problem that didn't exist. I blamed `hexdump`'s line deduplication when `-v` proved it cost nothing. `perf` and `hyperfine` settled all three in under a minute each. Measure first, theorise second, I knew that before, and apparently knowing it isn't the same as doing it.

The next project is still the HTTP server. Now I want to write it knowing what a syscall costs.