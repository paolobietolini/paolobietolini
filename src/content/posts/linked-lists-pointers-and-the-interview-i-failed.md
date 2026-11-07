---
title: Linked Lists, Pointers, and the Interview I Failed
date: 2026-11-07
lang: en
description: "A few months ago I failed a technical interview at ElevenLabs. I was asked to implement three methods for a TextEditor class: roughly write, delete and undo. Conceptually simple, and yet the result was a disaster. I might write a separate post about the experience, because on a human level it was an interesting one."
tags: [c, javascript, data-structures, computer-science]
---

A few months ago I failed a technical interview at ElevenLabs. I was asked to implement three methods for a `TextEditor` class: roughly `write`, `delete` and `undo`.

Conceptually simple, and yet the result was a disaster. I might write a separate post about the experience, because on a human level it was an interesting one.

The funny thing is that the logic wasn't the problem. The editor's content is just a buffer of characters, so in `write()` I used JavaScript's `push()` to add each character to an array. For `delete` and `undo` I was reasoning in terms of a LIFO stack: the last thing in is the first thing out. That was the right intuition.

What went wrong was everything around it. The skeleton I was given was a JavaScript `class`, something I had never actually used, and I panicked. Then I couldn't remember that JavaScript arrays have a `pop()` method, so I fell back on how I would do it in C and started removing the last element of the array by hand. I had the right model in my head and the wrong tools in my hands.

That interview gave me the push (pun intended) to go back over the fundamentals, both of JavaScript and of data structures. Last week I started studying objects and inheritance, and among other things I read that in JavaScript objects are passed by reference, while primitives are passed by value.

It turns out that's not quite true, and figuring out why is what sent me down this rabbit hole.

## Pass by value, pass by reference… or neither?

When you pass a primitive, say an integer, to a function, the function receives a copy. Whatever it does to that copy, the original stays the same. In the following example `n` keeps its value of `42`:

```javascript
function modifyInteger(value) {
  value = 24;
}

let n = 42;

modifyInteger(n);

console.log(n); // 42
```

Objects (and therefore arrays and functions too) seem to behave differently. Pass one to a function, and the function can modify it:

```javascript
const myNumber = { num: 42 };

function modifyNumber(obj) {
  obj.num = 24;
}

modifyNumber(myNumber);

console.log(myNumber.num); // 24
```

So objects are passed by reference? Not exactly. Look at what happens if, instead of changing a property, we reassign the parameter:

```javascript
const myNumber = { num: 42 };

function replaceNumber(obj) {
  obj = { num: 0 };
}

replaceNumber(myNumber);

console.log(myNumber.num); // 42
```

If JavaScript really passed by reference, `myNumber` would now be `{ num: 0 }`. It isn't.

What actually happens is that JavaScript **always passes by value**. For objects, though, the value being copied is a *reference* to the object. The caller and the function each hold their own copy of that reference, and both copies point to the same object. Change a property through either one, and the other sees it. Reassign the parameter, and you've only changed where the local copy points. This model has a name: [**call by sharing**](https://en.wikipedia.org/wiki/Evaluation_strategy#Call_by_sharing).

If you come from C, this should sound familiar: it's exactly what happens when you pass a pointer to a function. The pointer is copied, but the copy points to the same memory. Keep this in mind, because it's the key to the C code that follows. Whenever a function needs to change *the caller's pointer itself*, and not just what it points to, we'll have to pass a pointer to that pointer.

Thinking about all this, I realised there were still a few things about pointers I wasn't clear on. And since I like to dig deep when I learn something (and tend to wander far down the rabbit hole), I went back to linked lists. I implemented them in C first, to see what really happens in memory, and then rewrote them in JavaScript.

This article is a collection of my notes on singly linked lists and pointers, and of what I learned implementing them. The code is in both C and JavaScript.

## What a linked list is

A singly linked list is a dynamic data structure made of a sequence of nodes. Each node holds a value and a reference to the next node. Unlike an array, the nodes don't sit next to each other in memory: each one only knows where the following one is.

This is worth clarifying, because I had it wrong: JavaScript arrays are **not** linked lists. They are dynamic arrays, and engines store dense arrays as contiguous blocks of memory under the hood. A stack is an abstract idea, a collection that follows the LIFO principle, and it can be implemented with either an array or a linked list. In JavaScript, the array version looks like this:

```javascript
const stack = [];
stack.push(1);
stack.push(2);

stack.pop(); // 2
stack.pop(); // 1
```

Yes, `pop()`. I won't forget it again.

Stacks and sequential access will come up a lot in this article, because the examples are based on everyday things that also work sequentially.

## The node

First we need a blueprint for each node in the list: a data type that represents exactly one node in memory.

```c
typedef struct node {
  int data;
  struct node *next;
} Node;
```

```javascript
class Node {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}
```

In C, `next` is a pointer to another `Node` in memory. In JavaScript we initialise it to `null` directly in the constructor; in C that happens in a separate function:

```c
/**
 * Creates and returns a new node.
 *
 * Allocates memory for a new Node, initializes its data
 * field and sets its next pointer to NULL.
 *
 * @param data The value to store in the new node.
 * @return A pointer to the newly created node.
 */
Node *create_node(int data) {
  Node *new_node = (Node *)malloc(sizeof(Node));

  if (!new_node)
    exit(EXIT_FAILURE);
  new_node->data = data;
  new_node->next = NULL;

  return new_node;
}
```

With the blueprint in place, we can create the head. In C, the head is a *pointer* to a `Node`, initialised to `NULL`, which means the list is empty:

```c
Node *head = NULL;
```

In JavaScript, I wrap the head (and later the tail) in a list object:

```javascript
const list = { head: null, tail: null };
```

This object isn't just for tidiness. Thanks to call by sharing, a function that receives `list` can change `list.head`, and the caller will see the change. In C, the same job is done by `Node **head`: a pointer to the caller's head pointer. Different syntax, same idea.

With a head, we can start thinking about inserting at the beginning or at the end of the list. I won't cover insertion in the middle: it would complicate things without adding anything to the concepts the first two operations already cover.

## Insertion at the beginning

Insertion at the beginning is the simpler one. Every time I create a new node, I point its `next` at the current head, and then make the new node the head.

Picture washing the dishes and stacking them in the cupboard. At the start the shelf is empty: that's our `NULL`. When we put down the first plate, its bottom (its `next`) rests on the wooden shelf, and that plate becomes the head, the top of the pile. The second plate rests on the first one and becomes the new head. And so on.

With insertion at the beginning, the head is always the most recent element. Sound familiar? It's a stack.

```c
/**
 * Inserts a new node at the beginning of the linked list.
 *
 * @param head Pointer to pointer to the first node.
 * @param data The value to store in the new node.
 */
void insertion_beginning(Node **head, int data) {
  Node *n = create_node(data);
  n->next = *head;
  *head = n;
}
```

```javascript
function insertionBeginning(list, value) {
  const newNode = new Node(value);
  newNode.next = list.head;
  list.head = newNode;
  if (list.tail === null) list.tail = newNode; // first node is also the last
}
```

Note the `Node **head` in the C version. The function has to change the caller's `head` variable, so passing `head` by value (a `Node *`) wouldn't be enough: it would change only the local copy, exactly like `replaceNumber` above.

## Insertion at the end

This is the operation that gave me the most headaches, I'll admit. The new node has to be attached after the current last one, but how do we reach the last one?

We have to look for it by walking the whole list, and when we find the node whose `next` is null, we're at the end and can attach the new node there.

Back to the real world: we're writing a book and need to know which page is the last one, so we can add the next one in order. Starting from the first page we ask: is this the last page written? If so, we add the new one after it. Otherwise we keep flipping.

> Spoiler alert: I wrote four different versions of this operation.

### Version 1: walk the list

The first version is fairly inefficient, but the easiest to write:

```c
void insertion_end(Node **head, int data) {
  Node *n = create_node(data);
  if (!(*head)) {
    *head = n;
    return;
  }

  Node *tail = *head;
  while (tail->next) {
    tail = tail->next;
  }
  tail->next = n;
}
```

We start from `head`. If it's `NULL`, the new node becomes the head and we return. Otherwise we create a local variable `tail` that starts at the head, and use it to walk the list to the end (the `while` loop). Once we've found the last node, we set its `next` to the new node.

### Version 2: Linus's good taste

In a well-known TED interview with [Chris Anderson](<https://en.wikipedia.org/wiki/Chris_Anderson_(entrepreneur)>), [Linus Torvalds](https://www.youtube.com/watch?v=o8NPllzkFhE&t=858s) shows an example of what he calls *good taste* in writing code.

Instead of an `if` to handle the special case of an empty list, he makes the special case disappear by treating the head like any other link in the list, using a *cursor*:

```c
/**
 * Inserts a new node at the end of the linked list.
 *
 * Traverses the list using a pointer to a pointer, i.e.
 * a cursor, then writes the new node into the last
 * empty slot.
 *
 * @param head Pointer to pointer to the first node.
 * @param data The value to store in the new node.
 */
void insertion_end_Linus(Node **head, int data) {
  Node *n = create_node(data);
  Node **cursor = head;

  while (*cursor) {
    cursor = &(*cursor)->next;
  }
  *cursor = n;
}
```

The trick is in what `cursor` points to. It doesn't point to a node. It points to **a slot that holds a node's address**. That slot can be the `head` variable itself, or the `next` field of some node. From the function's point of view, there is no difference.

```
  &head          &n1->next        &n2->next
    |                |                |
    v                v                v
 [ head ] ---> [ 1 | next ] ---> [ 2 | next ] ---> NULL
```

The cursor starts at `&head` and moves along the top row, one slot at a time. When the slot it points to contains `NULL`, that's where the new node belongs, and `*cursor = n` writes it there.

And the empty list? The cursor starts at `&head`, which contains `NULL`, so the loop never runs and the new node is written straight into `head`. Same code path, no `if`. The special case wasn't handled at all as it just stopped existing.

### Version 3: O(1) with a tail pointer

At this point I didn't like having to walk the whole list every time: that's O(n) for each insertion. If the problem is finding the last node, we can just remember where it is and update it after every insertion.

```c
/**
 * Inserts a new node at the end of the linked list.
 *
 * Instead of traversing the list, the caller keeps a pointer
 * to the last node, which is updated at every insertion.
 *
 * @note Time complexity O(1)
 *
 * @param head Pointer to pointer to the first node.
 * @param tail Pointer to pointer to the last node.
 * @param data The value to store in the new node.
 */
void insertion_end_efficient(Node **head, Node **tail, int data) {
  Node *n = create_node(data);
  if (!(*head)) {
    *head = n;
    *tail = n;
    return;
  }

  (*tail)->next = n;
  *tail = n;
}
```

The only difference is that the caller keeps track of the tail, so on every call we already know which node is the last one.

There's a price, though: from now on *every* operation has to keep `tail` up to date. If you remove the last node and forget to update `tail`, it will point to freed memory.

### Version 4: O(1) and good taste

Combining Linus's idea with the tail pointer gives us an insertion that is both O(1) and free of special cases:

```c
/**
 * Inserts at the tail in O(1), with no special case
 * for the empty list.
 *
 * @param tail Pointer to the caller's cursor, which points to
 *             the last node's next field (or to head if the
 *             list is empty).
 * @param data The value to store in the new node.
 */
void insertion_end_efficient_Linus(Node ***tail, int data) {
  Node *n = create_node(data);
  **tail = n;
  *tail = &n->next;
}
```

Here the caller declares the cursor as `Node **tail = &head;` and calls the function with `&tail`. Inside the function:

- `*tail` is the caller's cursor, and `**tail` is the slot it points to.
- `**tail = n` writes the new node into that slot: `head` on the first call, the previous node's `next` on every call after that.
- `*tail = &n->next` moves the caller's cursor to the new node's `next` slot, ready for the next insertion.

Why three stars? Because the function has to change the caller's cursor, which is itself a `Node **`. It's call by sharing again, just one level deeper.

I'll be honest: `Node ***` is where I got lost, and I suspect I'm not the only one. A cleaner way to write the same thing is to wrap head and cursor in a struct:

```c
typedef struct {
  Node *head;
  Node **tail; /* the slot where the next node will go */
} List;

void list_init(List *list) {
  list->head = NULL;
  list->tail = &list->head;
}

void list_append(List *list, int data) {
  Node *n = create_node(data);
  *list->tail = n;
  list->tail = &n->next;
}
```

Same logic, one star fewer, and it mirrors the `list` object we use in JavaScript.

## Insertion at the end in JavaScript

JavaScript has no `&` operator: we can't take the address of the `head` variable or of a `next` field, so we can't copy Linus's trick literally. We can still get both results, though.

The O(1) version keeps a `tail` reference, like version 3:

```javascript
function insertionEnd(list, value) {
  const newNode = new Node(value);
  if (list.head === null) {
    list.head = newNode;
    list.tail = newNode;
    return;
  }
  list.tail.next = newNode;
  list.tail = newNode;
}
```

Confession: my first version of this function never updated `list.tail` after inserting. It still produced the right list, because the `while` loop I had in there caught up one step on each call, but `tail` no longer meant "the last node". And if the list had been started with `insertionBeginning`, which back then didn't set `tail` at all, the next call crashed on `list.tail.next`. The lesson: if you keep a `tail`, every function that touches the list has to keep it honest.

For the good-taste version, JavaScript's answer to the pointer-to-pointer is a **dummy node** (also called a sentinel): a fake node placed in front of the head. Its `next` plays the role of `&head`, a "next slot" before the first real node, so the empty list stops being a special case here too:

```javascript
function insertionEndDummy(list, value) {
  const dummy = { next: list.head };
  let cursor = dummy;

  while (cursor.next !== null) {
    cursor = cursor.next;
  }
  cursor.next = new Node(value);
  list.head = dummy.next;
}
```

If the list is empty, `dummy.next` is `null`, the loop never runs, the new node is attached to the dummy, and `list.head = dummy.next` makes it the head. No `if`.

## Removing from the head: pop

The last operation is the one I couldn't remember during the interview: removing the most recent element.

In a list where we insert at the beginning, the most recent element is the head. Removing it means moving the head to the next node and, in C, freeing the memory of the old one:

```c
/**
 * Removes the first node and stores its value in out.
 *
 * @param head Pointer to pointer to the first node.
 * @param out  Where to store the removed value.
 * @return 1 if a node was removed, 0 if the list was empty.
 */
int pop(Node **head, int *out) {
  if (!*head)
    return 0;

  Node *old = *head;
  *out = old->data;
  *head = old->next;
  free(old);
  return 1;
}
```

```javascript
function pop(list) {
  if (list.head === null) return undefined;

  const old = list.head;
  list.head = old.next;
  if (list.head === null) list.tail = null; // keep tail honest
  return old.data;
}
```

In JavaScript there's no `free`: once nothing references the old node anymore, the garbage collector takes care of it.

Insertion at the beginning plus removal from the beginning, both O(1). That's a stack: the pile of dishes, built from scratch.

## Back to the interview

Which brings me back to where I started: a text editor with `write`, `delete` and `undo`.

I don't remember the exact spec, so here's my version: `write(str)` appends text, `delete(n)` removes the last `n` characters, and `undo()` reverts the last operation.

The text itself can stay an array of characters, with `push()` and `pop()`. `undo` needs something else: a history of operations, where the last one done is the first one undone. A stack. This time I used the linked list I'd just written:

```javascript
class TextEditor {
  constructor() {
    this.text = [];
    this.history = { head: null, tail: null }; // our linked list, used as a stack
  }

  write(str) {
    const chars = [...str];
    for (const ch of chars) this.text.push(ch);
    insertionBeginning(this.history, { type: "write", count: chars.length });
  }

  delete(n) {
    const removed = [];
    for (let i = 0; i < n && this.text.length > 0; i++) {
      removed.push(this.text.pop());
    }
    insertionBeginning(this.history, { type: "delete", chars: removed });
  }

  undo() {
    const op = pop(this.history);
    if (op === undefined) return;

    if (op.type === "write") {
      for (let i = 0; i < op.count; i++) this.text.pop();
    } else {
      while (op.chars.length > 0) this.text.push(op.chars.pop());
    }
  }

  toString() {
    return this.text.join("");
  }
}
```

```javascript
const editor = new TextEditor();
editor.write("Hello");
editor.write(" world");
editor.delete(6);  // "Hello"
editor.undo();     // "Hello world"
editor.undo();     // "Hello"
```

A few details: `[...str]` splits the string into characters correctly even with emoji, which `str.length` would count as two. `delete` saves the characters it removes, in reverse order, so `undo` can push them back in the right order by popping them again. And it's a class, with `push()` and `pop()`: the three things I froze on in the interview, in about thirty lines.

## What I took away from it

In the interview, my reasoning was right: an undo is a LIFO stack. What I was missing was fluency in the language, and that's a much easier problem to fix than not knowing how to think about the problem.

Writing linked lists in C showed me what actually happens in memory. Rewriting them in JavaScript showed me what the language hides from me, and that it's the same thing underneath. `Node **head` in C and `list.head` in JavaScript solve the same problem: letting a function change something that belongs to the caller. Call by sharing is the bridge between the two, and it's the thing I wish I had understood before that interview.

Next up, probably: doubly linked lists, and maybe that post about the human side of the interview.
