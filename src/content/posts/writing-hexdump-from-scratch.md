---
title: Writing hexdump from scratch
date: 2026-07-07
lang: en
description: "Say we want to inspect a corrupted file. To figure out its real type we can check its signature,  the first few bytes of the file. On Unix-like systems, the tool for the job is hexdump: a program that shows the hexadecimal content of a file or of a data stream."
tags: [c]
---

There's a video version of this post: [watch it on YouTube](https://www.youtube.com/watch?v=UhkKQR7jHBc).

> The script is available on my [Codeberg](https://codeberg.org/sprawz/c-learning/src/branch/main/projects/hexdump/hexdumb.c)

## What is hexdump?

Say we want to inspect a corrupted file. To figure out its real type we can check its [signature](https://en.wikipedia.org/wiki/List_of_file_signatures), the first few bytes of the file. On Unix-like systems, the tool for the job is [hexdump](https://en.wikipedia.org/wiki/Hex_dump): a program that shows the hexadecimal content of a file or of a data stream.

Take this example:

```bash
0000000 6170 6c6f 626f 6569 6f74 696c 696e 632e
0000010 6d6f 000a
0000013
```

Reading each group of two bytes (pairs of two hex characters, `0` to `f`), the byte `70` is `p`, `61` is `a`, and so on. Notice that within each two-byte group the characters read "backwards": the byte that comes first in the file is printed on the right. This is a consequence of [endianness](https://en.wikipedia.org/wiki/Endianness), and we'll come back to it [when we print the bytes](#printing-the-bytes).

## Why

I wanted to rewrite parts of hexdump without looking at the [original source](https://github.com/util-linux/util-linux/blob/master/text-utils/hexdump.c). This is a small exercise in reverse engineering an existing tool: it forces me to ask "how did they do this?", and above all it gives me a real target, a tool that, toy as it is, actually works. I tried to reason as if it had to go to production (it doesn't; there are improvements to be made that are beyond my level for now).

## The problem

`hexdump` essentially does one thing: it takes one or more files as input, reads their bytes, and prints them out. If no files are given, it reads from `stdin`. The output format changes according to flags passed on the command line.

For example, the `-C` (canonical) flag prints the bytes in hex alongside their ASCII representation. With the same input as before:

```bash
00000000  70 61 6f 6c 6f 62 69 65  74 6f 6c 69 6e 69 2e 63  |paolobietolini.c|
00000010  6f 6d 0a                                          |om.|
00000013
```

I focused on this format and on the two-byte format shown in the previous section.

To summarize the problem:

- parse the command line
  - if a known flag is present, the program's mode changes
  - anything else is treated as a file name, to be opened and processed according to the chosen mode
- read the bytes from the file (or the stream) into a buffer
- print the bytes according to the mode

## The flags

I only want to handle three flags:

- `C` for canonical
- `V` to print the version
- `h` to print the help

I start by defining the functions for _version_ and _help_:

```c
static void version(void) {
    puts(VERSION);
    exit(EXIT_SUCCESS);
}

static void help(void) {
    fprintf(stdout, "Usage:\n %s [options] <file>...\n", PROGRAM_NAME);
    putchar('\n');
    for (size_t i = 0; i < ARRLEN(options); i++) {
        fprintf(stdout, "-%c\t%s\n", options[i].short_flag,
                options[i].description);
    }
    exit(EXIT_SUCCESS);
}
```

Note that we're iterating over an array called `options`, which holds a `struct` at each index. `options` is an array of type `Flag`, defined as follows:

```c
typedef struct {
    const char short_flag;
    const char *description;
    ActionFn *fn;
} Flag;

const Flag options[] = {
    {'C', "canonical hex+ASCII display", set_canonical},
    {'V', "display version", version},
    {'h', "display this help", help},
};
```

A `Flag` groups together a char, a pointer to char (a string, if you like) and a function pointer of type `ActionFn`. Each `Flag` in `options` will call the function assigned to it. This means adding a new flag is a one-line change: add an entry to the array, and both the parser and the help text pick it up automatically.

## Command-line arguments

I decided to [reinvent the wheel](https://alessandro.desi/reinvent-the-wheel) precisely in order to learn. I know I could have used [`getopt`](https://en.wikipedia.org/wiki/Getopt), but this is an exercise, and its purpose is that I learn something.

In the past I've used `argparse` in Python, and I understood how complex it can be to abstract over command-line arguments: anything can show up there, and you need crystal-clear rules if you don't want bugs creeping in. The first rule is that you cannot anticipate every possible input, so you define the behavior you want from the command line, anything outside those expectations is an error. This, to me, is where good design shows: a parser should be extensible according to the needs of the program itself, not an attempt to abstract every conceivable input.

I split the parsing logic into three functions.

`parse_args` scans `argv`: arguments starting with `-` are flags, everything else is a file name. A bare `--` stops flag parsing, so anything after it is treated as a file even if it starts with `-`:

```c
static void parse_args(int argc, char **argv, Files *f) {
    f->files = argv;
    f->filesc = 0;
    int done_flags = 0;

    for (int i = 1; i < argc; i++) {
        if (!done_flags && argv[i][0] == '-' && argv[i][1] != '\0') {
            if (argv[i][1] == '-' && argv[i][2] == '\0') {
                /* stop parsing */
                done_flags = 1;
                continue;
            }
            parse_short(argv[i]);
        } else
            f->files[f->filesc++] = argv[i];
    }
}
```

`parse_short` walks the characters after the `-` (so grouped flags like `-Ch` work too) and, through a call to `find_flag`, checks whether each one is an actual flag. If it is, it calls the function pointed to by `ActionFn *fn`; if not, it errors out:

```c
static void parse_short(const char *arg) {
    for (arg++; *arg; arg++) { /* skips '-' */
        const Flag *flag = find_flag(*arg);
        if (flag == NULL)
            invalid("unknown flag -", *arg);
        flag->fn();
    }
}
```

Finally, `find_flag` looks up the flag in `options` and returns a pointer to the matching entry, or `NULL`:

```c
static const Flag *find_flag(const char c) {
    for (size_t i = 0; i < ARRLEN(options); i++) {
        if (options[i].short_flag == c)
            return &options[i];
    }
    return NULL;
}
```

One more detail borrowed from the real tool: a file name of `-` means "read from stdin", which is handled in `main`.

## Reading the input

Now the heart of the program. A file, or the content of `stdin`, which is [a file in its own right](https://en.wikipedia.org/wiki/Everything_is_a_file), is nothing more than an array of bytes, which we load into a buffer to be processed.

The `hexdump` function does exactly this: it creates a `buffer` of size `MAX_BUFFER` (64 KiB here) and uses `fread()` to fill it from the input file, chunk by chunk:

```c
static void hexdump(FILE *fptr, Mode mode) {
    unsigned char buffer[MAX_BUFFER];
    DumpFmt *fmt = &formats[mode];
    size_t size, offset = 0;
    while ((size = fread(buffer, 1, sizeof buffer, fptr)) > 0) {
        dump(buffer, size, offset, fmt);
        offset += size;
    }
    check(ferror(fptr), "fread", __LINE__);
    if (offset > 0)
        printf("%0*zx\n", fmt->addr_width, offset);
}
```

This function also tracks the _offset_: the column of numbers on the left that tells you where you are in the file. It's simply the running count of bytes read so far, accumulated across chunks (`offset += size`). I need it for two reasons: to print that left-hand column, and to keep the addresses correct across buffer refills, each row's address is its position within the current buffer plus the offset of everything read before it. After the loop, the total offset is printed as the final line, which is why the example output above ends with `0000013` (19 bytes).

There's one constraint worth calling out: `MAX_BUFFER` must be a multiple of `BYTES_PER_LINE` (16). Since `dump` is called once per chunk, if the buffer size weren't a multiple of 16 a line could be split across two chunks and the output would break. I enforce this at compile time:

```c
static_assert(MAX_BUFFER % BYTES_PER_LINE == 0,
              "MAX_BUFFER must be a BYTES_PER_LINE multiple");
```

## dump

`dump` is a short function that does two very simple things: it loops over the buffer one row (16 bytes) at a time, and for each row it prints the offset and then calls the line-rendering function selected by the current `mode`:

```c
static void dump(const unsigned char buf[], size_t size, size_t offset,
                 DumpFmt *fmt) {
    for (size_t row = 0; row < size; row += BYTES_PER_LINE) {
        printf("%0*zx", fmt->addr_width, row + offset);
        fmt->line_fn(buf, size, row);
        putchar('\n');
    }
}
```

## Function pointers and dynamic dispatch

To decide which function to call based on the `mode`, I defined an enum with the modes I care about and an array, similar in spirit to `options[]`, where each entry bundles the address width with the line-rendering function:

```c
typedef enum { DEFAULT, CANONICAL } Mode;

typedef struct {
    short addr_width;
    line_render *line_fn;
} DumpFmt;

DumpFmt formats[] = {[DEFAULT] = {7, two_bytes}, [CANONICAL] = {8, canonical}};
```

Note how the design mirrors the parser: given a specific piece of data, I call a specific function through its pointer. Adding a new output format means writing one function and adding one entry to `formats[]`, nothing else changes.

## Printing the bytes

To print the bytes I wrote two functions, `two_bytes` and `canonical`.

The more interesting one is `two_bytes`, because it does something `canonical` doesn't: its output reflects the _endianness_ of the processor, i.e. the order in which the bytes of a multi-byte integer are laid out in memory. On most modern machines you'll find a little-endian representation, where the _least_ significant byte is stored first (at the lowest address).

To be clear about what's happening: the bytes in the file never change order. My name in hexadecimal is:

```c
  70 61 6f 6c 6f 0a
// p  a  o  l  o  \n
```

and that's exactly how it sits in the buffer. But the default format prints the data as 16-bit _words_, two bytes at a time. When we load the pair `70 61` into a `uint16_t` on a little-endian machine, the first byte (`70`) lands in the low half of the integer and the second (`61`) in the high half, so the value is `0x6170`, and `printf("%04x", ...)` prints:

```bash
6170 6c6f 0a6f
```

Each pair _looks_ swapped, but it's just the same bytes being interpreted as a little-endian integer. This is exactly what the real hexdump does in its default format, which is why its output looks byte-swapped on x86.

Replicating this was trivial: I use `memcpy()` to copy two bytes from the buffer into a `uint16_t`, so the word is built exactly the way the processor sees it in memory:

```c
static void two_bytes(const unsigned char buf[], size_t size, size_t row) {
    putchar(' ');
    for (size_t j = row; j < row + BYTES_PER_LINE; j += 2) {
        if (j < size) {
            uint16_t word;
            if (j + 1 < size)
                memcpy(&word, &buf[j], sizeof word);
            // portable little-endian alternative: word = buf[j] | (uint16_t)buf[j+1] << 8
            else
                word = buf[j];
            printf("%04x ", word);
        } else
            printf("     ");
    }
}
```

Using `memcpy` here is also a best practice, because it avoids the misaligned access I could get by reinterpreting the buffer through a pointer cast, like:

```c
uint16_t word = *(uint16_t *)&buf[j];
```

On strict-alignment architectures this is undefined behavior when `&buf[j]` isn't properly aligned. `memcpy` has no such problem, and compilers optimize it down to a single load anyway.

If instead I wanted output that is _always_ little-endian regardless of the host, the portable way is bit-shifting:

```c
word = buf[j] | (uint16_t)buf[j + 1] << 8;
```

Note also the edge case: if the file has an odd number of bytes, the last word only has its low byte (`word = buf[j]`), which is why the example at the top ends with `000a`, a lone newline.

`canonical` is more straightforward, since it prints the bytes in file order, one at a time. It makes two passes over the same 16 bytes: first the hex column (with an extra space every 8 bytes, and padding when the line is short), then the ASCII column between `|` pipes, where anything outside the printable range `0x20`–`0x7e` is replaced by a dot:

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
    printf(" |");
    for (size_t j = row; j < row + BYTES_PER_LINE && j < size; j++) {
        const char c = buf[j];
        putchar((c >= 0x20 && c <= 0x7e) ? c : '.');
    }
    putchar('|');
}
```

## Performance

The buffer has a fixed size because I don't need to hold the whole file before printing: each row is printed as soon as it's read. This spares me the memory management dance with `malloc` and `realloc`, and above all it means huge files don't eat memory, when the buffer fills up, I simply overwrite it, since by then its content has already been printed.

Ideally I wouldn't use `printf()` for every row, to avoid the overhead of format-string parsing, but I don't know a good alternative yet. Where I could, I used `puts` and `putchar` precisely to avoid that overhead.

## What I learned

It was a demanding project, but not a difficult one. I had fun, and more than the language itself (though I do feel more confident with pointers now), it taught me _design_. I spent time figuring out how to make things modular, I don't like designs that are single, unextendable blocks doing more than one thing. I was happy to understand and use function pointers, which are essentially _callbacks_.

I don't have a next project lined up for now, because I want to give priority to CS:APP and its labs. The goal, though, is to write an HTTP server from scratch, _that_ is going to be fun.
