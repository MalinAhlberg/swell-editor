
import * as Dmp from "diff-match-patch"
export const dmp = new Dmp.diff_match_patch()

export interface Pair<A, B> {
  readonly first: A,
  readonly second: B
}

export function Pair<A, B>(first: A, second: B): Pair<A, B> {
  return {first, second}
}

export function pair<A, B>({first, second}: Pair<A, B>): [A, B] {
  return [first, second]
}

export function triple<A, B, C>({first, second}: Pair<A, Pair<B, C>>): [A, B, C] {
  return [first, second.first, second.second]
}


export type TokenDiff = [number, string][]

/** Make a stream of all unicode characters

  const next = char_stream()
  next().charCodeAt(0) = 0
  next().charCodeAt(0) = 1
  next().charCodeAt(0) = 2
  next().charCodeAt(0) = 3

*/
export function char_stream(): () => string {
  let i = 0
  return () => {
    return String.fromCharCode(parseInt((i++).toString(), 16))
  }
}

export type ChangeInt = -1 | 0 | 1

/**

  raw_diff('abca'.split(''), 'bac'.split('')).map(pair) // => [[-1, 'a'], [0, 'b'], [1, 'a'], [0, 'c'], [-1, 'a']]
  raw_diff('abc'.split(''), 'cab'.split('')).map(pair) // => [[1, 'c'], [0, 'a'], [0, 'b'], [-1, 'c']]
  raw_diff('bca'.split(''), 'a1234bc'.split('')).map(pair) // => [[1, 'a'], [1, '1'], [1, '2'], [1, '3'], [1, '4'], [0, 'b'], [0, 'c'], [-1, 'a']]
  raw_diff(['anything', 'everything'], ['anything']).map(pair) // => [[0, 'anything'], [-1, 'everything']]
  const n = 10000
  raw_diff(range(n), range(2*n)) // => range(2*n).map(i => Pair(i < n ? 0 : 1, i))

*/
export function raw_diff<A>(xs: A[], ys: A[], cmp: (a: A) => string = a => a.toString()): Pair<ChangeInt, A>[] {
  return hdiff(xs, ys, cmp, cmp).map(c => Pair(c.change, c.change == 1 ? c.b : c.a))
}

interface Deleted<A> {
  change: -1,
  a: A
}

interface Constant<A, B> {
  change: 0,
  a: A,
  b: B,
}

interface Inserted<B> {
  change: 1,
  b: B,
}

export type Change<A, B> = Deleted<A> | Constant<A, B> | Inserted<B>

/** Hetrogenuous diff

  const abca = 'abca'.split('')
  const BAC = 'BAC'.split('')
  const lower = (s: string) => s.toLowerCase()
  const expect = [
    {change: -1, a: 'a'},
    {change: 0, a: 'b', b: 'B'},
    {change: 1, b: 'A'},
    {change: 0, a: 'c', b: 'C'},
    {change: -1, a: 'a'}
  ] as Change<string, string>[]
  hdiff(abca, BAC, lower, lower) // => expect

*/
export function hdiff<A, B>(xs: A[], ys: B[],
    a_cmp: (a: A) => string = a => a.toString(),
    b_cmp: (b: B) => string = b => b.toString()): Change<A, B>[] {
  const to = new Map<string, string>()
  const a_from = new Map<string, A[]>()
  const b_from = new Map<string, B[]>()
  const next = char_stream()
  function assign<C>(c: C, c_cmp: (c: C) => string, c_from: Map<string, C[]>): string {
    const s = c_cmp(c)
    let u = to.get(s)
    if (u === undefined) {
      u = next()
      to.set(s, u)
    }
    let arr = c_from.get(u)
    if (!arr) {
      arr = []
      c_from.set(u, arr)
    }
    arr.push(c)
    return u
  }
  const s1 = xs.map(a => assign(a, a_cmp, a_from)).join('')
  const s2 = ys.map(b => assign(b, b_cmp, b_from)).join('')
  return flatMap(dmp.diff_main(s1, s2), ([change, cs]) => {
    return str_map(cs, (c: string) => {
      if (change == 0) {
        const a = (a_from.get(c) as A[]).shift() as A
        const b = (b_from.get(c) as B[]).shift() as B
        return {change: 0 as 0, a, b}
      } else if (change == -1) {
        const a = (a_from.get(c) as A[]).shift() as A
        return {change: -1 as -1, a}
      } else if (change == 1) {
        const b = (b_from.get(c) as B[]).shift() as B
        return {change: 1 as 1, b}
      }
      throw 'diff match patch returned change not in range [-1, 1]: ' + change
    })
  })
}

export function token_diff(s1: string, s2: string) {
  const d = dmp.diff_main(s1, s2)
  dmp.diff_cleanupSemantic(d)
  return d
}

export const invert_token_diff = (ds : TokenDiff) => ds.map(([i, s]) => [-i, s] as [number, string])

// ss must be nonempty and all strings must be nonempty
export function multi_token_diff(ss: string[], s2: string): TokenDiff[] {
  let lengths = ss.map(s => s.length)
  const diff = token_diff(ss.join(''), s2)
  let cur = [] as [number, string][]
  const out = [cur]
  diff.map(([i, s]) => {
    if (i == 0 || i == -1) {
      while (s.length > lengths[0]) {
        const n = lengths.shift()
        cur.push([i, s.slice(0, n)])
        cur = []
        out.push(cur)
        s = s.slice(n)
      }
      if (s.length > 0) {
        cur.push([i, s])
        lengths[0] -= s.length
      }
    } else {
      cur.push([i, s])
    }
  })
  return out
}

/** Compare two arrays for shallow equality */
export function shallow_array_eq<A>(xs: A[], ys: A[]): boolean {
  return xs.length == ys.length && xs.every((x, i) => x == ys[i])
}

/** Check if two lists are a permutation of each other

  array_multiset_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa', 'apa', 'apa']) // => false
  array_multiset_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa', 'apa']) // => true
  array_multiset_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa']) // => false
  array_multiset_eq(['apa', 'bepa', 'apa'], ['bepa']) // => false

*/
export function array_multiset_eq<A>(xs: A[], ys: A[]): boolean {
  const xm = new Map<A, number>()
  const ym = new Map<A, number>()
  let tmp
  xs.map(x => xm.set(x, (tmp = xm.get(x), tmp === undefined ? 1 : tmp + 1)))
  ys.map(y => ym.set(y, (tmp = ym.get(y), tmp === undefined ? 1 : tmp + 1)))
  return map_equal(xm, ym)
}

/** Are these two maps equal? */
export function map_equal<A, B>(a: Map<A, B>, b: Map<A, B>): boolean {
  let ok = true
  a.forEach((k, v) => ok = ok && b.get(v) == k)
  b.forEach((k, v) => ok = ok && a.get(v) == k)
  return ok
}

/** Are these two sets equal? */
export function set_equal<A>(a: Set<A>, b: Set<A>): boolean {
  let ok = true
  a.forEach(k => ok = ok && b.has(k))
  b.forEach(k => ok = ok && a.has(k))
  return ok
}

/** Check if two lists are a permutation of each other

  array_set_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa', 'apa', 'apa']) // => true
  array_set_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa', 'apa']) // => true
  array_set_eq(['apa', 'bepa', 'apa'], ['bepa', 'apa']) // => true
  array_set_eq(['apa', 'bepa', 'apa'], ['bepa']) // => false

*/
export function array_set_eq<A>(xs: A[], ys: A[]): boolean {
  return set_equal(new Set(xs), new Set(ys))
}

/** map for strings */
export function str_map<A>(s: string, f: (c: string, i: number) => A): A[] {
  const out = [] as A[];
  for (let i = 0; i < s.length; ++i) {
    out.push(f(s[i], i))
  }
  return out
}

/** Show a JSON object with indentation */
export function show(x: any): string {
  return JSON.stringify(x, undefined, 2)
}

/** Numeric sort */
export function numsort(xs: number[]): number[] {
  return xs.slice().sort((u,v) => u - v)
}

/** Trims initial whitespace */
export function ltrim(s: string): string {
  const m = s.match(/^\s*(.*)$/)
  if (m) {
    return m[1]
  } else {
    return s // unreachable, the regex always matches
  }
}

/** Splits a string up in the initial part and all trailing whitespace

  whitespace_split('  XY  ') // => ['  XY', '  ']
  whitespace_split('XY  ') // => ['XY', '  ']
  whitespace_split('  XY') // => ['  XY', '']

*/
export function whitespace_split(s: string): [string, string] {
  const m = s.match(/^(.*?)(\s*)$/)
  if (m && m.length == 3) {
    return [m[1], m[2]]
  }
  return [s, ''] // unreachable (the regexp matches any string)
}

/** Splits a string up in the initial whitespace part and the rest of the string

  initial_whitespace_split('  XY  ') // => ['  ', 'XY  ']
  initial_whitespace_split('XY  ')   // => ['', 'XY  ']
  initial_whitespace_split('  XY')   // => ['  ', 'XY']

*/
export function initial_whitespace_split(s: string): [string, string] {
  const m = s.match(/^(\s*)(.*)$/)
  if (m && m.length == 3) {
    return [m[1], m[2]]
  }
  return [s, ''] // unreachable (the regexp matches any string)
}


/** Is every element larger than the previous?

  increases([1,2,3,4]) // => true
  increases([1,3,4,5]) // => true
  increases([3,1]    ) // => false
  increases([])        // => true

*/
export function increases(xs: number[]): boolean {
  return xs.every((v, i) => i == 0 || v > xs[i-1])
}

/** Is every element exactly one larger than the previous?

  contiguous([1,2,3,4]) // => true
  contiguous([1,3,4,5]) // => false
  contiguous([3,1]    ) // => false
  contiguous([])        // => true

*/
export function contiguous(xs: number[]): boolean {
  return xs.every((x, i) => i == 0 || xs[i-1] + 1 == x)
}

/** Flatten an array of arrays */
export function flatten<A>(xss: A[][]): A[] {
  return ([] as any).concat(...xss)
}

/** Flatten an array of arrays */
export function flatMap<A, B>(xs: A[], f: (a: A) => B[]): B[] {
  return flatten(xs.map(f))
}


/** Split an array into two pieces */
export function splitAt<A>(xs: A[], i: number): [A[], A[]] {
  return [xs.slice(0, i), xs.slice(i)]
}

/** Split a string into two pieces */
export function stringSplitAt<A>(s: string, i: number): [string, string] {
  return [s.slice(0, i), s.slice(i)]
}

/** Split an array into three pieces

  splitAt3('0123456'.split(''), 2, 4).map(xs => xs.join('')) // => ['01', '23', '456']
  splitAt3('0123456'.split(''), 2, 2).map(xs => xs.join('')) // => ['01', '', '23456']
  splitAt3('0123456'.split(''), 2, 9).map(xs => xs.join('')) // => ['01', '23456', '']
  splitAt3('0123456'.split(''), 0, 2).map(xs => xs.join('')) // => ['', '01', '23456']

*/
export function splitAt3<A>(xs: A[], start: number, end: number): [A[], A[], A[]] {
  const [ab,c] = splitAt(xs, end)
  const [a,b] = splitAt(ab, start)
  return [a,b,c]
}

/** Split an array into three pieces

  stringSplitAt3('0123456', 2, 4) // => ['01', '23', '456']
  stringSplitAt3('0123456', 2, 2) // => ['01', '', '23456']
  stringSplitAt3('0123456', 2, 9) // => ['01', '23456', '']
  stringSplitAt3('0123456', 0, 2) // => ['', '01', '23456']

*/
export function stringSplitAt3(xs: string, start: number, end: number): [string, string, string] {
  const [ab,c] = stringSplitAt(xs, end)
  const [a,b] = stringSplitAt(ab, start)
  return [a,b,c]
}

export function escape_pipe(x: string): string {
  return x.replace(/\\/g, '\\b').replace(/[|]/g, '\\|')
}

export function unescape_pipe(x: string): string {
  return x.replace(/\\[|]/g, '|').replace(/\\b/g, '\\')
}

export function pipesep(x: string[]): string {
  if (x.length == 0) {
    return '|'
  } else {
    return '|' + x.map(escape_pipe).join('|') + '|'
  }
}

export function pipeunsep(x: string): string[] {
  const m = x.match(/[|](?:\\[|]|[^|])*/g)
  if (!m || m[m.length - 1] != '|') {
    throw 'Not well-formed pipe-separated list: ' + x + ' ' + show(m)
  } else {
    return m.slice(0, m.length - 1).map((x) => unescape_pipe(x.slice(1)))
  }
}

export function cat<A>(xs: (A | null)[]): A[] {
  const out = [] as A[]
  xs.map(x => x != null && out.push(x))
  return out
}

export function cycle<A>(n: number, xs: A[]): A[] {
  const out = [] as A[]
  let i = 0
  while (out.length < n) {
    out.push(xs[i])
    i++
    if (i >= xs.length) {
      i = 0
    }
  }
  return out
}

/** Minimum of a non-empty array */
export function minimum(xs: number[]) {
  return xs.reduce((x,y) => Math.min(x,y), xs[0])
}

/** Maximum of a non-empty array */
export function maximum(xs: number[]) {
  return xs.reduce((x,y) => Math.max(x,y), xs[0])
}

/** Returns a copy of the array with duplicates removed, via toString */
export function uniq<A>(xs: A[]): A[] {
  const seen = {} as Record<string, boolean>
  return xs.filter(x => {
    const s = x.toString()
    const duplicate = s in seen
    seen[s] = true
    return !duplicate
  })
}

/** Union-find data structure operations */
interface UnionFind {
  find(x: number): number,
  union(x: number, y: number): number,
  unions(xs: number[]): void,
}

/** Make a union-find data structure */
export function UnionFind(): UnionFind {
  const rev = [] as number[]
  const find = (x: number) => {
    if (rev[x] == undefined) {
      rev[x] = x
    } else if (rev[x] != x) {
      rev[x] = find(rev[x])
    }
    return rev[x]
  }
  const union = (x: number, y: number) => {
    const find_x = find(x)
    const find_y = find(y)
    if (find_x != find_y) {
      rev[find_y] = find_x
    }
    return find_x
  }
  const unions = (xs: number[]) => {
    if (xs.length > 0) {
      xs.reduce(union, xs[0])
    }
  }
  return {find, union, unions}
}

export function splice<A>(xs: A[], start: number, count: number, ...insert: A[]): [A[], A[]] {
  const ys = xs.slice()
  const zs = ys.splice(start, count, ...insert)
  return [ys, zs]
}

/** True iff this function throws an exception

  throws(() => '123')        // => false
  throws(() => raise('123')) // => true

*/
export function throws(m: () => any): boolean {
  try {
    return (m(), false)
  } catch (e) {
    return true
  }
}

/**

  const u = unique_check()
  u(1) // => true
  u(1) // => false
  u(1) // => false
  u(2) // => true
  u(3) // => true
  u(2) // => false

*/
export function unique_check<S>(): (s: S) => boolean {
  const seen = new Set<S>()
  return s => {
    if (seen.has(s)) {
      return false
    }
    seen.add(s)
    return true
  }
}

/** Raise an exception */
export function raise(s: string): any {
  throw s
}

export function overlaps<A>(s: Set<A>, t: Set<A>) {
  return [...s.keys()].some(k => t.has(k))
}

/** Moves a slice of the items and puts back them at some destination.

  rearrange([0, 1, 2, 3], 1, 2, 0) // => [1, 2, 0, 3]
  rearrange([0, 1, 2, 3], 1, 2, 3) // => [0, 3, 1, 2]

  rearrange([0, 1, 2, 3], 1, 2, 1) // => [0, 1, 2, 3]
  rearrange([0, 1, 2, 3], 1, 2, 2) // => [0, 1, 2, 3]

*/
export function rearrange<A>(xs: A[], begin: number, end: number, dest: number): A[] {
  const [a, mid, z] = splitAt3(xs, begin, end + 1)
  const w = end - begin
  if (dest > begin) {
    dest -= w
  }
  const [pre, post] = splitAt(a.concat(z), dest)
  return pre.concat(mid, post)
}

/** All numbers up to and excluding the argument number

  range(0) // => []
  range(1) // => [0]
  range(4) // => [0, 1, 2, 3]

*/
export function range(to: number) {
  const out = []
  for (let i = 0; i < to; ++i) {
    out.push(i)
  }
  return out
}

/** Calculate the next id to use from these identifiers

  next_id([]) // => 0
  next_id(['t1', 't2', 't3']) // => 4
  next_id(['u2v5k1', 'b3', 'a0']) // => 6
  next_id(['77j66']) // => 78

*/
export function next_id(xs: string[]): number {
  let max = -1
  xs.forEach(x => (x.match(/\d+/g) || []).forEach(i => max = Math.max(max, parseInt(i))))
  return max + 1
}

/** Reductio ad Absurdum */
export function absurd<A>(c: never): A {
  return c
}

/** Is this a token of punctation?

  punc('. ')   // => true
  punc('... ') // => true
  punc(' !')   // => true
  punc('!?')   // => true
  punc(', ')    // => false
  punc('apa. ') // => false
  punc('?.., ') // => false

*/
export function punc(s: string): boolean {
  return !!s.match(/^\s*[.!?]+\s*$/)
}

/** Where is the previous punctuation token?

  const s = tokenize('apa bepa . Cepa depa')
  prev_punc(s, 1) // => -1
  prev_punc(s, 2) // => 2
  prev_punc(s, 3) // => 2

*/
export function prev_punc(tokens: string[], i: number): number {
  for (let j = i; j >= 0; --j) {
    if (punc(tokens[j])) {
      return j
    }
  }
  return -1
}

/** Where is the next punctuation token?

  const s = tokenize('apa bepa . Cepa depa')
  next_punc(s, 1) // => 2
  next_punc(s, 2) // => 2
  next_punc(s, 3) // => -1

*/
export function next_punc(tokens: string[], i: number): number {
  for (let j = i; j < tokens.length; ++j) {
    if (punc(tokens[j])) {
      return j
    }
  }
  return -1
}

export type Span = {begin: number, end: number}

/** Merge two spans: makes a span that contains both spans

  span_merge({begin: 1, end: 2}, {begin: 3, end: 4}) // => {begin: 1, end: 4}
  span_merge({begin: 2, end: 4}, {begin: 1, end: 3}) // => {begin: 1, end: 4}

*/
export function span_merge(s1: Span, s2: Span): Span {
  return {begin: Math.min(s1.begin, s2.begin), end: Math.max(s1.end, s2.end)}
}

/** Is this index within the span?

  span_within(0, {begin: 1, end: 2}) // => false
  span_within(1, {begin: 1, end: 2}) // => true
  span_within(2, {begin: 1, end: 2}) // => true
  span_within(3, {begin: 1, end: 2}) // => false

*/
export function span_within(i: number, s: Span): boolean {
  return s.begin <= i && i <= s.end
}

/** Gets the sentence around some offset in a string of tokens

  const s = tokenize('apa bepa . Cepa depa . epa')
  sentence(s, 0) // => {begin: 0, end: 2}
  sentence(s, 1) // => {begin: 0, end: 2}
  sentence(s, 2) // => {begin: 0, end: 2}
  sentence(s, 3) // => {begin: 3, end: 5}
  sentence(s, 4) // => {begin: 3, end: 5}
  sentence(s, 5) // => {begin: 3, end: 5}
  sentence(s, 6) // => {begin: 6, end: 6}

*/
export function sentence(tokens: string[], i: number): Span {
  const begin = prev_punc(tokens, i - 1) + 1
  let end = next_punc(tokens, i)
  if (end == -1) {
    end = tokens.length - 1
  }
  return {begin, end}
}

/** Tokenizes text on whitespace, prefers to have trailing whitespace

  tokenize('') // => []
  tokenize('    ') // => []
  tokenize('apa bepa cepa') // => ['apa ', 'bepa ', 'cepa']
  tokenize('  apa bepa cepa') // => ['  apa ', 'bepa ', 'cepa']
  tokenize('  apa bepa cepa  ') // => ['  apa ', 'bepa ', 'cepa  ']

*/
export function tokenize(s: string): string[] {
  return s.match(/\s*\S+\s*/g) || []
}

export function record_forEach<A>(x: Record<string, A>, k: (a: A, id: string) => void): void {
  Object.keys(x).forEach(id => k(x[id], id))
}

export function record_traverse<A, B>(x: Record<string, A>, k: (a: A, id: string) => B): B[] {
  return Object.keys(x).map(id => k(x[id], id))
}

export function record_map<A, B>(x: Record<string, A>, k: (a: A, id: string) => B): Record<string, B> {
  const out = {} as Record<string, B>
  record_forEach(x, (a, id) => out[id] = k(a, id))
  return out
}

export function record_filter<A>(x: Record<string, A>, k: (a: A, id: string) => boolean): Record<string, A> {
  const out = {} as Record<string, A>
  record_forEach(x, (a, id) => k(a, id) && (out[id] = a))
  return out
}
