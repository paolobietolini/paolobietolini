---
title: "Learning C: Conway's Game of Life, Three Times"
date: 2026-06-12
lang: en
description: I challenged myself into writing the Conway's Game of Life three times, and improving at each iteration.
tags: [c]
---

## Introduction

As I mentioned in another [post](/posts/leaving-the-tracking-pixel-machine/), I'm learning C.

I had started back in January, then dropped it because I wanted to try moving toward data engineering. Only to discover that every time I had a free moment, I'd drift back to practicing pointers and structs. A couple of Sundays ago I caught myself trying to understand [`string_view`](https://en.cppreference.com/cpp/string/basic_string_view) — a C++ idea — just to better grasp how strings and memory interact in C. At that point I looked into the proverbial (inner) mirror and decided to be honest with myself. I want to program.

So I picked K&R back up, alongside Antirez's course, [Impariamo il C](https://www.youtube.com/watch?v=HjXBXBgfKyk&list=PLrEMgOSrS_3cFJpM2gdw8EGFyRBZOyAKY) (in Italian). Lesson 8 of Salvatore's videos is an [implementation](https://gist.github.com/antirez/4f3f523154302413ce172e071b1d5d7d) of [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway's_Game_of_Life).

Before watching the video, though, I challenged myself to implement the game on my own.

This article describes what I learned over two days and three implementations.

> The full programs are at the bottom of the page or on [Codeberg](https://codeberg.org/sprawz/c-learning/src/branch/main/projects/CGoL). Throughout the article I'll only include snippets that help follow the reasoning.

> I won't go deep into the game itself, to keep the article from ballooning and drifting from its purpose. The Wikipedia page covers the details very well; here I'll only state the general rules, as context for the code.

<p><a href="https://commons.wikimedia.org/wiki/File:Gospers_glider_gun.gif#/media/File:Gospers_glider_gun.gif"><img src="https://upload.wikimedia.org/wikipedia/commons/e/e5/Gospers_glider_gun.gif" alt="Animation of Gosper's glider gun in Conway's Game of Life emitting a steady stream of gliders"></a><br>By <a href="//commons.wikimedia.org/wiki/User:LucasVB" title="User:LucasVB">Lucas Vieira</a> - <span class="int-own-work" lang="en">Own work</span>, <a href="http://creativecommons.org/licenses/by-sa/3.0/" title="Creative Commons Attribution-Share Alike 3.0">CC BY-SA 3.0</a>, <a href="https://commons.wikimedia.org/w/index.php?curid=101736">Link</a></p>

## The World: a grid that wraps

After reading the rules on Wikipedia, I set out to understand 2D grids. I spent a good hour drawing grids and numbering indices to see how they move across rows and columns. I knew I'd need two nested loops to walk the cells, so I wanted to first understand the foundation of the problem: what the game's world is made of.

The world is the simplest possible 2D grid (greetings, brother Descartes), and the game requires looking at the eight cells around the current one to decide whether that cell will be dead or alive in the next generation.

The rules:

- Any live cell with fewer than two live neighbours dies, as if by underpopulation.
- Any live cell with two or three live neighbours lives on to the next generation.
- Any live cell with more than three live neighbours dies, as if by overpopulation.
- Any dead cell with exactly three live neighbours becomes a live cell, as if by reproduction.

But what happens at the edges of the world? We'd need a condition saying: if we're in the first/last row or column, don't look past the border. Something like:

```c
if (ni >= 0 && ni < MAXGRID && nj >= 0 && nj < MAXGRID)
    /* count this neighbour */
```

But since time immemorial the world has never been a flat plane — so why not make it a [torus](https://en.wikipedia.org/wiki/Torus), where a _glider_ can take a page from Pac-Man's book and reappear on the opposite side, in a world whose edges are stitched together. We can then drop the special case above and define the neighbouring cells as:

```c
int ni = (i + di + MAXGRID) % MAXGRID;
int nj = (j + dj + MAXGRID) % MAXGRID;
```

Congratulations — courtesy of the modulo operator, our world has just become a donut.

The modulo of a division can never reach the divisor: with `MAXGRID` set to 10 (a 10×10 world), every time we're at 9 the next index is 0, and we start over.

<p><a href="https://commons.wikimedia.org/wiki/File:Trefoil_knot_conways_game_of_life.gif#/media/File:Trefoil_knot_conways_game_of_life.gif"><img src="https://upload.wikimedia.org/wikipedia/commons/6/64/Trefoil_knot_conways_game_of_life.gif" alt="Game of Life on the surface of a trefoil knot"></a><br>By <a href="//commons.wikimedia.org/w/index.php?title=User:Raphaelaugusto&amp;action=edit&amp;redlink=1" class="new" title="User:Raphaelaugusto (page does not exist)">Raphaelaugusto</a> - <span class="int-own-work" lang="en">Own work</span>, <a href="https://creativecommons.org/licenses/by-sa/4.0" title="Creative Commons Attribution-Share Alike 4.0">CC BY-SA 4.0</a>, <a href="https://commons.wikimedia.org/w/index.php?curid=52336285">Link</a></p>

## Playing God (or Oppenheimer, or the Bhagavad Gita)

"Now I am become Death, the destroyer of worlds."

Which is to say: time to create some worlds. At the top of the program we define two worlds of size `GRID`:

```c
#define GRID 80

static int world[GRID][GRID];
static int new_world[GRID][GRID];
```

We need two worlds because each current state of the world provides the coordinates for generating the next one.

With the two 2D arrays in place, I initialize the main one, `world`, filling it with random `0`s and `1`s:

```c
void init_world(void) {
    for (int i = 0; i < GRID; i++)
        for (int j = 0; j < GRID; j++)
            world[i][j] = rand() % 2;
}
```

I'm using [`rand()`](https://www.man7.org/linux/man-pages/man3/rand.3.html), which returns a pseudo-random integer in the range 0 to `RAND_MAX` inclusive. In `main()` I'll also need to call `srand()` once to seed the generator — otherwise `rand()` produces the same sequence on every run.

The world now looks like this:

```bash
0 0 0 1 0 1
1 1 0 1 1 0
0 1 0 0 1 0
1 0 1 0 1 1
1 0 0 0 1 1
1 1 0 1 1 0
```

Now for the interesting part: the game logic. Once `init_world()` has created the inhabitants, the actual game begins. We iterate over the grid to work out the population of the next world:

```c
void step(void) {
    for (int i = 0; i < GRID; i++)
        for (int j = 0; j < GRID; j++) {
            generate_world(i, j, count_neighbours(i, j));
        }
    commit_world();
}
```

This is the main loop's engine: count each cell's live neighbours, generate the next world, then copy the result back into the current world to serve as the base for the next iteration.

```c
/* alive is the sum of the live neighbours (each valued at 1) */
int count_neighbours(int i, int j) {
    int alive = 0;
    for (int di = -1; di <= 1; di++) {
        for (int dj = -1; dj <= 1; dj++) {
            if (di == 0 && dj == 0)
                continue;

            int ni = (i + di + GRID) % GRID;
            int nj = (j + dj + GRID) % GRID;

            alive += world[ni][nj];
        }
    }
    return alive;
}

/* Note how the game's simple rules are checked against each cell */
void generate_world(int i, int j, int alive) {
    if (world[i][j] == 1) {
        if (alive < 2)
            new_world[i][j] = 0;
        else if (alive == 2 || alive == 3)
            new_world[i][j] = 1;
        else
            new_world[i][j] = 0;
    } else
        new_world[i][j] = (alive == 3) ? 1 : 0;
}

/* Copy the next world over the current one */
void commit_world() {
    for (int i = 0; i < GRID; i++)
        for (int j = 0; j < GRID; j++)
            world[i][j] = new_world[i][j];
}
```

The `main()` function looks like this:

```c
#define SLEEP 60
int main(void) {
    srand(time(NULL));
    init_world();
    printf("\033[2J");

    while (1) {
        print_world();
        step();
        sleep_ms(SLEEP);
    }
    return 0;
}
```

A handful of lines in an infinite loop.

## Nice. Can we do better?

I didn't like that the grid size and the delay (in ms) couldn't be parameterized. So I wrote a second version of the game, introducing a few things:

- Handling program interruption
- Error handling
- Command-line arguments

For the first point I used `signal()`, which registers `handle_sigint()` as a callback, and declared the flag as `volatile sig_atomic_t running = 1;` — `volatile` tells the compiler the variable can change outside the normal flow of the program (so it must actually re-read it on every loop iteration instead of caching it), and `sig_atomic_t` guarantees reads and writes are atomic. The handler only flips the flag; the loop then exits through its normal path, at a point where the program's state is consistent.

I also declared `#define _POSIX_C_SOURCE 199309L` to make sure `nanosleep()` is available.

As for the arguments, I collect them at runtime via `argc, argv`. Since `argv` is an array of pointers to `char`, I needed a way to convert the input into an `int`. I could have used `atoi()`, but it's an old function that reports no errors. `strtol()` would have returned a `long`, which I didn't want (yes, I know casting exists — I'm reinventing the wheel to learn). And since in C you have to think about **everything**, I built my own `strtoi()`. Fully homemade, organic, artisanal:

```c
int strtoi(char *s) {
    int r = 0;
    while (*s) {
        if (*s < '0' || *s > '9')
            return -1;
        r = r * 10 + (*s++ - '0');
    }
    return r;
}
```

This converts the string `"60"` into the integer `60`.

PS: the function is not exactly bulletproof. The fix lands in v3.

### Now I am become malloc, creator of worlds

In this new version I had to (and wanted to) use pointers, so that the worlds' size could be allocated dynamically. Instead of declaring arrays like in v1, creating a world now means calling:

```c
World *world_create(int grid, int delay_ms) {
    World *w = malloc(sizeof *w);
    if (!w)
        return NULL;
    w->cells = grid_init(grid);
    w->next = grid_init(grid);
    if (!w->cells || !w->next) {
        if (w->cells) {
            for (int i = 0; i < grid; i++)
                free(w->cells[i]);
            free(w->cells);
        }
        if (w->next) {
            for (int i = 0; i < grid; i++)
                free(w->next[i]);
            free(w->next);
        }
        free(w);
        return NULL;
    }
    w->grid = grid;
    w->delay_ms = delay_ms;
    return w;
}
```

Tied to the existence of `world_create()` is `world_destroy()`, which frees the memory `malloc` allocated:

```c
void world_destroy(World *w) {
    for (int i = 0; i < w->grid; i++) {
        free(w->cells[i]);
        free(w->next[i]);
    }

    free(w->cells);
    free(w->next);
    free(w);
}
```

The world's parameters also became a `struct`, so they could be part of the world itself rather than loose variables. A world now carries its own characteristics: its cells, the next world's cells, its size, and the sleep delay.

```c
typedef struct {
    char **cells;
    char **next;
    int grid;
    int delay_ms;
} World;
```

This way I can create as many worlds as I like:

```c
World *w1 = world_create(10, 40);
World *w2 = world_create(80, 50);
```

A nice upgrade over the first version — with trade-offs attached: more lines of code, and manual memory management, with the very real risk of introducing segmentation faults and dangling pointers.

The game logic is unchanged, so we can move on to the final part — the one that gave me the most satisfaction, because it let me combine the best parts of v1 and v2.

## v3: Trinity

> I just realized I made three versions, and the nuclear test in Oppenheimer's project was called Trinity. And I had already name-dropped Oppenheimer and God earlier. Nice coincidence.

First things first, a promise kept — the `strtoi()` fix:

```c
int strtoi(char *s) {
    int r = 0;
    if (!*s)
        return -1;

    while (*s) {
        if (*s < '0' || *s > '9')
            return -1;
        int digit = *s - '0';
        if (r > (INT_MAX - digit) / 10)
            return -1;

        r = r * 10 + digit;
        s++;
    }
    return r;
}
```

It now rejects empty strings and refuses numbers that would overflow an `int`.

Few things changed in this version, but they brought outsized benefits. First of all, the worlds are now a one-dimensional array:

```c
w->cells = malloc((size_t)grid * grid);
```

This gives me the contiguous allocation of v1 _and_ the dynamic sizing of v2. Freeing memory got much simpler too:

```c
World *world_create(int grid, int delay_ms) {
    World *w = malloc(sizeof *w);
    if (!w)
        return NULL;

    w->cells = malloc((size_t)grid * grid);
    w->next = malloc((size_t)grid * grid);
    if (!w->cells || !w->next) {
        free(w->cells);
        free(w->next);
        free(w);
        return NULL;
    }

    w->grid = grid;
    w->delay_ms = delay_ms;
    return w;
}

void world_destroy(World *w) {
    free(w->cells);
    free(w->next);
    free(w);
}
```

To access a cell, all I do now is `w->cells[i * w->grid + j]` — a neat little trick that lets you walk a flat array as if it were two-dimensional.

The second benefit is in how worlds are "copied": instead of looping and copying every cell into the new world, I just swap the pointers.

```c
void world_commit(World *w) {
    char *t = w->cells;
    w->cells = w->next;
    w->next = t;
}
```

The [time complexity](https://www.bigocheatsheet.com/) drops from O(n²) to O(1).

### Smaller things

Among the minor changes: signal handling moved from `signal()` to `sigaction()`. They do the same job — registering a handler — but `signal()` is the 1970s API, with semantics that historically varied between Unix systems (on some, the handler would unregister itself after the first signal; the behavior of interrupted system calls was unspecified). `sigaction()` is the POSIX interface where every behavior is explicit. A pleasant side effect of the default flags: when SIGINT arrives during `nanosleep()`, the sleep is interrupted and returns immediately, so Ctrl+C exits the loop right away instead of waiting out the delay — responsiveness for free, straight from signal semantics.

And the printing function changed: you can now choose between a half-block rendering (`--hb`) and the plain one with `#` and `.` characters. The half-block trick uses the ▀ character (U+2580, upper half block): the foreground color paints the top half and the background color the bottom half, so one terminal row renders two rows of the world — doubling vertical resolution and making cells nearly square.

```c
void world_print(World *w, int hb) {
    printf("\033[H");

    if (hb) {
        for (int i = 0; i < w->grid; i += 2) {
            for (int j = 0; j < w->grid; j++) {
                int top = w->cells[i * w->grid + j];
                int bot =
                    (i + 1 < w->grid) ? w->cells[(i + 1) * w->grid + j] : 0;

                printf("\033[%d;%dm\xE2\x96\x80", top ? 37 : 30, bot ? 47 : 40);
            }
            printf("\033[0m\n");
        }
    } else {
        for (int i = 0; i < w->grid; i++) {
            for (int j = 0; j < w->grid; j++) {
                printf("%c ", w->cells[i * w->grid + j] ? '#' : '.');
            }
            putchar('\n');
        }
    }

    fflush(stdout);
}
```

## Epilogue

### A Bug's Life

I'd love to tell you that everything went smoothly across the three versions, as linear as this article makes it look. It didn't, and this chapter is a small [retro](https://www.atlassian.com/team-playbook/plays/retrospective) on what actually happened.

In v2 I wanted to write `strtoi()`, and I did — in a couple of minutes, without much thought, without even considering edge cases or possible overflows. Maybe one extra minute of thinking would have saved me the ten minutes I later spent rewriting it.

But v3 is what really made me lower my head and remember humility. Confidently striding along, sure I knew the program by heart, I rewrote everything without testing along the way — and the first compilation buried me under an avalanche of errors.

Once I'd fixed all the typos and missing includes, I recompiled and... saw something resembling a QR code. The _gliders_ weren't _gliding_. I knew it had to be an error in the math, and I suspected `world_alive()` was the function responsible. I went over the whole process — generation, neighbour counting, world commit — again and again, but the bug wouldn't show itself.

I had to ask Claude, who noticed that in the declaration of `nj` I was computing the diagonal, using `di` instead of `dj`: `(j + di + grid)`.

```c
int ni = (i + di + grid) % grid;
int nj = (j + dj + grid) % grid;
```

I had read that line multiple times and seen what I _expected_ to be there, not what was there.

What would have caught this quickly is a test with `assert()` — which I didn't write, partly because I don't have the habit yet, partly because I'm still learning how. And honestly, for such a small project, I've already absorbed so much material that I feel a bit overwhelmed by everything I'm digesting. No harm done, though: now I'm curious about how to write proper tests, and maybe a v4 will have them.

### The Scripts

The full programs are also available on my [Codeberg repo](https://codeberg.org/sprawz/c-learning/src/branch/main/projects/CGoL).

```c
// Game Of Life v1
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

#define GRID 80
#define SLEEP 60 // ms

static int world[GRID][GRID];
static int new_world[GRID][GRID];

void sleep_ms(long ms) {
    struct timespec ts;
    ts.tv_sec = ms / 1000;
    ts.tv_nsec = (ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
}

void init_world(void) {
    for (int i = 0; i < GRID; i++)
        for (int j = 0; j < GRID; j++)
            world[i][j] = rand() % 2;
}

void print_world(void) {
    printf("\033[H");
    for (int i = 0; i < GRID; i++) {
        for (int j = 0; j < GRID; j++)
            printf("%c ", world[i][j] ? '#' : '.');
        putchar('\n');
    }
    fflush(stdout);
}
void print_world_hb(void) {
    /* Unicode half blocks — the classic trick. The ▀ character (U+2580,
    upper half block) splits a cell into two vertical halves. With ANSI
    colors you set the foreground for the top half and the background for
    the bottom one: a single row of characters renders two rows of the
    world. You double the vertical resolution and cells become nearly
    square (a character cell is ~1:2, half a cell is ~1:1). */
    // prints two world rows per terminal row
    printf("\033[H");
    for (int i = 0; i < GRID; i += 2) {
        for (int j = 0; j < GRID; j++) {
            int top = world[i][j];
            int bot = (i + 1 < GRID) ? world[i + 1][j] : 0;
            // fg = top, bg = bottom, character = ▀
            printf("\033[%d;%dm\xE2\x96\x80", top ? 37 : 30, bot ? 47 : 40);
        }
        printf("\033[0m\n");
    }
    fflush(stdout);
}
int count_neighbours(int i, int j) {
    int alive = 0;
    for (int di = -1; di <= 1; di++) {
        for (int dj = -1; dj <= 1; dj++) {
            if (di == 0 && dj == 0)
                continue;

            int ni = (i + di + GRID) % GRID;
            int nj = (j + dj + GRID) % GRID;

            alive += world[ni][nj];
        }
    }
    return alive;
}

void generate_world(int i, int j, int alive) {
    if (world[i][j] == 1) {
        if (alive < 2)
            new_world[i][j] = 0;
        else if (alive == 2 || alive == 3)
            new_world[i][j] = 1;
        else
            new_world[i][j] = 0;
    } else
        new_world[i][j] = (alive == 3) ? 1 : 0;
}

void commit_world() {
    for (int i = 0; i < GRID; i++)
        for (int j = 0; j < GRID; j++)
            world[i][j] = new_world[i][j];
}

void step(void) {
    for (int i = 0; i < GRID; i++)
        for (int j = 0; j < GRID; j++) {
            generate_world(i, j, count_neighbours(i, j));
        }
    commit_world();
}
int main(void) {
    srand(time(NULL));
    init_world();
    printf("\033[2J");

    while (1) {
        print_world();
        step();
        sleep_ms(SLEEP);
    }
    return 0;
}
```

```c
// v2

#define _POSIX_C_SOURCE 199309L
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

enum COLOURS { RED = 31 };
volatile sig_atomic_t running = 1;

void handle_sigint(int sig) {
    running = 0;
}
typedef struct {
    char **cells;
    char **next;
    int grid;
    int delay_ms;
} World;

/* Utility */
int strtoi(char *s) {
    int r = 0;
    while (*s) {
        if (*s < '0' || *s > '9')
            return -1;
        r = r * 10 + (*s++ - '0');
    }
    return r;
}

void sleep_ms(int delay_ms) {
    struct timespec ts;
    ts.tv_sec = delay_ms / 1000;
    ts.tv_nsec = (delay_ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
}

char **grid_init(int grid) {
    char **g = malloc(grid * sizeof *g);
    if (!g)
        return NULL;
    for (int i = 0; i < grid; i++) {
        g[i] = malloc(sizeof *g[i] * grid);
        if (!g[i]) {
            for (int f = 0; f < i; f++)
                free(g[f]);
            free(g);
            return NULL;
        }
    }
    return g;
}

/* World Setup */
World *world_create(int grid, int delay_ms) {
    World *w = malloc(sizeof *w);
    if (!w)
        return NULL;
    w->cells = grid_init(grid);
    w->next = grid_init(grid);
    if (!w->cells || !w->next) {
        if (w->cells) {
            for (int i = 0; i < grid; i++)
                free(w->cells[i]);
            free(w->cells);
        }
        if (w->next) {
            for (int i = 0; i < grid; i++)
                free(w->next[i]);
            free(w->next);
        }
        free(w);
        return NULL;
    }
    w->grid = grid;
    w->delay_ms = delay_ms;
    return w;
}
void world_destroy(World *w) {
    for (int i = 0; i < w->grid; i++) {
        free(w->cells[i]);
        free(w->next[i]);
    }

    free(w->cells);
    free(w->next);
    free(w);
}

void world_populate(World *w) {
    for (int i = 0; i < w->grid; i++)
        for (int j = 0; j < w->grid; j++)
            w->cells[i][j] = rand() % 2;
}
void world_print(World *w) {
    printf("\033[H");
    for (int i = 0; i < w->grid; i++) {
        for (int j = 0; j < w->grid; j++)
            printf("%c ", w->cells[i][j] ? '#' : '.');
        putchar('\n');
    }
    fflush(stdout);
}
/* Game Logic */
void world_commit(World *w) {
    char **t = w->cells;
    w->cells = w->next;
    w->next = t;
}
int world_alive(World *w, int i, int j) {
    int alive = 0;
    int grid_size = w->grid;

    for (int di = -1; di <= 1; di++) {
        for (int dj = -1; dj <= 1; dj++) {
            if (di == 0 && dj == 0)
                continue;

            int ni = (i + di + grid_size) % grid_size;
            int nj = (j + dj + grid_size) % grid_size;
            alive += w->cells[ni][nj];
        }
    }
    return alive;
}
void world_generate(World *w, int i, int j, int alive) {
    int current = w->cells[i][j];
    w->next[i][j] = current ? (alive == 2 || alive == 3) : (alive == 3);
}
void world_step(World *w) {
    int grid_size = w->grid;
    for (int i = 0; i < grid_size; i++) {
        for (int j = 0; j < grid_size; j++) {

            int alive = world_alive(w, i, j);
            world_generate(w, i, j, alive);
        }
    }

    world_commit(w);
}

/* Main */
int main(int argc, char **argv) {
    srand(time(NULL));
    if (argc != 3) {
        fprintf(stderr, "\033[%dmUsage: %s <grid_size> <sleep_ms>\033[m\n", RED,
                argv[0]);
        exit(EXIT_FAILURE);
    }
    int grid = strtoi(argv[1]);
    int delay_ms = strtoi(argv[2]);
    if (grid < 1 || delay_ms < 1) {
        fprintf(
            stderr,
            "\033[%dmgrid and delay values must be greater than zero\033[m\n",
            RED);
        exit(EXIT_FAILURE);
    }

    World *w = world_create(grid, delay_ms);
    if (!w) {
        fprintf(stderr, "Failed to allocate world\n");
        exit(EXIT_FAILURE);
    }
    world_populate(w);
    printf("\033[2J");
    signal(SIGINT, handle_sigint);
    printf("\033[?25l"); // hide cursor

    while (running) {
        world_print(w);
        world_step(w);
        sleep_ms(delay_ms);
    }

    printf("\033[?25h");
    world_destroy(w);

    return EXIT_SUCCESS;
}
```

```c
// v3
#define _POSIX_C_SOURCE 199309L
#include <limits.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
enum COLOURS { RED = 31 };

volatile sig_atomic_t running = 1;

void handle_sigint(int sig) {
    (void)sig;
    running = 0;
}

typedef struct {
    char *cells;
    char *next;
    int grid;
    int delay_ms;
} World;

int strtoi(char *s) {
    int r = 0;
    if (!*s)
        return -1;

    while (*s) {
        if (*s < '0' || *s > '9')
            return -1;
        int digit = *s - '0';
        if (r > (INT_MAX - digit) / 10)
            return -1;

        r = r * 10 + digit;
        s++;
    }
    return r;
}

void sleep_ms(int delay_ms) {
    struct timespec ts;
    ts.tv_sec = delay_ms / 1000;
    ts.tv_nsec = (delay_ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
}

World *world_create(int grid, int delay_ms) {
    World *w = malloc(sizeof *w);
    if (!w)
        return NULL;

    w->cells = malloc((size_t)grid * grid);
    w->next = malloc((size_t)grid * grid);
    if (!w->cells || !w->next) {
        free(w->cells);
        free(w->next);
        free(w);
        return NULL;
    }

    w->grid = grid;
    w->delay_ms = delay_ms;
    return w;
}

void world_destroy(World *w) {
    free(w->cells);
    free(w->next);
    free(w);
}

void world_populate(World *w) {
    for (int i = 0; i < w->grid; i++)
        for (int j = 0; j < w->grid; j++)
            w->cells[i * w->grid + j] = rand() % 2;
}

void world_print(World *w, int hb) {
    printf("\033[H");

    if (hb) {
        for (int i = 0; i < w->grid; i += 2) {
            for (int j = 0; j < w->grid; j++) {
                int top = w->cells[i * w->grid + j];
                int bot =
                    (i + 1 < w->grid) ? w->cells[(i + 1) * w->grid + j] : 0;

                printf("\033[%d;%dm\xE2\x96\x80", top ? 37 : 30, bot ? 47 : 40);
            }
            printf("\033[0m\n");
        }
    } else {
        for (int i = 0; i < w->grid; i++) {
            for (int j = 0; j < w->grid; j++) {
                printf("%c ", w->cells[i * w->grid + j] ? '#' : '.');
            }
            putchar('\n');
        }
    }

    fflush(stdout);
}
int world_alive(World *w, int i, int j) {
    int alive = 0;
    int grid = w->grid;

    for (int di = -1; di <= 1; di++) {
        for (int dj = -1; dj <= 1; dj++) {
            if (di == 0 && dj == 0)
                continue;

            int ni = (i + di + grid) % grid;
            int nj = (j + dj + grid) % grid;

            alive += w->cells[ni * grid + nj];
        }
    }
    return alive;
}
void world_generate(World *w, int i, int j, int alive) {
    int cell_current_state = w->cells[i * w->grid + j];

    w->next[i * w->grid + j] =
        cell_current_state ? (alive == 2 || alive == 3) : (alive == 3);
}
void world_commit(World *w) {
    char *t = w->cells;
    w->cells = w->next;
    w->next = t;
}
void world_step(World *w) {
    int grid = w->grid;
    for (int i = 0; i < grid; i++) {
        for (int j = 0; j < grid; j++) {

            int alive = world_alive(w, i, j);
            world_generate(w, i, j, alive);
        }
    }
    world_commit(w);
}
int main(int argc, char **argv) {
    if (argc < 3 || argc > 4) {
        fprintf(stderr,
                "\033[%dmUsage: %s <grid_size> <sleep_ms> [--hb]\033[m\n", RED,
                argv[0]);
        exit(EXIT_FAILURE);
    }
    int hb = 0;
    int grid = 0;
    int delay_ms = 0;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--hb") == 0)
            hb = 1;
    }
    grid = strtoi(argv[1]);
    delay_ms = strtoi(argv[2]);
    if (grid < 1 || delay_ms < 1) {
        fprintf(
            stderr,
            "\033[%dmgrid and delay values must be greater than zero\033[m\n",
            RED);
        exit(EXIT_FAILURE);
    }
    World *w = world_create(grid, delay_ms);
    if (!w) {
        fprintf(stderr, "Failed to allocate world\n");
        exit(EXIT_FAILURE);
    }

    srand(time(NULL));
    world_populate(w);

    printf("\033[2J");
    struct sigaction sa = {0};
    sa.sa_handler = handle_sigint;
    sigaction(SIGINT, &sa, NULL);
    printf("\033[?25l");

    while (running) {
        world_print(w, hb);
        world_step(w);
        sleep_ms(delay_ms);
    }

    printf("\033[?25h");
    world_destroy(w);
    return EXIT_SUCCESS;
}
```
