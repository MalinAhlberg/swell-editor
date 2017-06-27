import * as CodeMirror from "codemirror";

console.log('Reload')

export interface Norm {
  original: string[],
  spans: Span[],
}

export interface SpanData {
  readonly links: number[],
  readonly labels: string[],
}

export function merge_data(spans: Span[]): SpanData {
  return {
    links: flatten(spans.map(s => s.data.links)),
    labels: flatten(spans.map(s => s.data.labels)),
  }
}

export interface Span {
  readonly text: string,
  readonly data: SpanData,
}

export function identity_spans(original: string): Span[] {
  const segments = (original + ' ').match(/\S*\s+/g) || []
  return segments.map((s, i) => ({
    text: s,
    data: {
      links: [i],
      labels: []
    }
  }))
}

export function check_invariant(spans: Span[]): Span[] {
  const texts = spans.map(s => s.text)
  for (let i = 0; i < spans.length; i++) {
    const text = spans[i].text
    if (!text.match(/^\w(.|\n)*\s$/)) {
      if (i == 0 && text.match(/\s$/)) {
        // ok: first token does not need to start on a word,
        // but cannot be empty
      } else {
        throw new Error('Invariant violated on span ' + i + ' ' + text)
      }
    }
  }
  return spans
}

function flatten<A>(xss: A[][]): A[] {
  return ([] as any).concat(...xss)
}

// index-based, use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert
export function modify(spans: Span[], from: number, to: number, text: string): Span[] {
  const [from_span, from_ix] = span_index(spans, from)
  let [to_span, to_ix] = span_index(spans, to - 1)
  const before = spans.slice(0, from_span)
  const after = spans.slice(to_span + 1)
  const pre = spans[from_span].text.slice(0, from_ix)
  const post = spans[to_span].text.slice(to_ix + 1)
  const new_span: Span = {
    text: pre + text + post,
    data: merge_data(spans.slice(from_span, to_span+1))
  }
  return cleanup_after_raw_modifications(flatten([before, [new_span], after]))
}

// Changes the spans with a cursor that can modify a window of width 1 (in reverse)
// return null for no change
export function cursor<S>(f: ((prev: S | null, me: S, next: S | null) => (S | null)[] | null)): (spans: S[]) => S[] {
  return (spans) => {
    for (let i = spans.length - 1; i >= 0; i--) {
      const prev = i > 0 ? spans[i-1] : null
      const next = i < spans.length - 1 ? spans[i+1] : null
      const replace = f(prev, spans[i], next)
      if (replace != null) {
        spans = flatten([spans.slice(0, Math.max(i-1,0)), replace.filter((x) => x != null) as S[], spans.slice(i+2)])
      }
    }
    return spans
  }
}

// shuffles initial whitespace from a token to the previous one
const move_whitespace: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (!prev) {
      return null // no change
    } else {
      const m = me.text.match(/^\s+/)
      if (m) {
        const new_prev = {...prev, text: prev.text + m[0]}
        const new_me = {...me, text: me.text.slice(m[0].length)}
        return [new_prev, new_me, next]
      } else {
        return null // no change
      }
    }
  })

// remove empty spans
const remove_empty: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (me.text.length == 0) {
      //console.debug('Removing span with data:', me.data)
      return [prev, next]
    } else {
      return null // no change
    }
  })

// merge tokens which have no final whitespace with next token
const merge_no_final_whitespace: (spans: Span[]) => Span[] =
  cursor<Span>((prev, me, next) => {
    if (me.text.match(/\w$/) && next) {
      const new_me_next = {
        text: [me, next].map(s => s.text).join(''),
        data: merge_data([me, next])
      }
      return [prev, new_me_next]
    } else {
      return null // no change
    }
  })

function cleanup_after_raw_modifications(spans: Span[]): Span[] {
  const new_spans = merge_no_final_whitespace(remove_empty(move_whitespace(spans)))
  //console.group('cleanup_after_raw_modifications')
  //console.log('old', spans.map(x => x.text))
  //console.log('new', new_spans.map(x => x.text))
  //console.groupEnd()
  const len = spans.reduce((n, s) => n + s.text.length, 0)
  const new_len = new_spans.reduce((n, s) => n + s.text.length, 0)
  if (len != new_len) {
    throw new Error('Internal error: length modified')
  }
  check_invariant(new_spans)
  return new_spans
}

export function span_index(spans: Span[], index: number): [number, number] {
  let passed = 0
  for (let i = 0; i < spans.length; i++) {
    const w = spans[i].text.length
    passed += w
    if (passed > index) {
      return [i, index - passed + w]
    }
  }
  throw new Error('Out of bounds')
}




// properties?

const example_text = `De väder var inte fint.`

const cm = CodeMirror(document.body, {
  value: example_text,
  extraKeys: {
    "Ctrl-X": () => {
      console.log('c-x')
    }
  }
});

let cm_spans = identity_spans(example_text)
console.log(cm_spans.map(({text}) => text))

/*
for (const t of ["change", "changes", "beforeChange", "cursorActivity", "update", "mousedown", "dblclick", "touchstart", "contextmenu", "keydown", "keypress", "keyup", "cut", "copy", "paste", "dragstart", "dragenter", "dragover", "dragleave", "drop"]) {
  cm.on(t, (_cm: CodeMirror.Editor, ...args: any[]) => console.log(t, ...args))
}
*/

// disable a bunch of "complicated" events for now
for (const t of ["cut", "copy", "paste", "dragover", "drop", "dragenter", "dragleave", "dragstart"]) {
  (cm.on as any)(t, (_cm: CodeMirror.Editor, evt: Event) => {
    console.log('Preventing', evt)
    evt.preventDefault()
  })
}

cm.on('cursorActivity', (_: CodeMirror.Editor) => {
  const cursor = cm.getDoc().getCursor()
  const index = cm.getDoc().indexFromPos(cursor)
  const [span, i] = span_index(cm_spans, cm.getDoc().indexFromPos(cursor));
  console.log(cursor, index, span, i, cm_spans[span], cm_spans[span].data.links)

})

cm.on('beforeChange', (_, change) => {
  // need to do this /beforeChange/ (not after),
  // otherwise indexFromPos does not work anymore
  // since the position might be removed
  console.log('beforeChange', change.origin, change)
  const from = cm.getDoc().indexFromPos(change.from)
  const to = cm.getDoc().indexFromPos(change.to)
  cm_spans = modify(cm_spans, from, to, change.text.join('\n'))
  console.log(cm_spans.map(({text}) => text))
})

/*
// old twiddlings about well-behaved cut
interface CutState {
  from: CodeMirror.Position,
  to: CodeMirror.Position,
  text: string,
  mark: CodeMirror.TextMarker
}

function cutState(from: CodeMirror.Position, to: CodeMirror.Position): CutState {
  const text = cm.getDoc().getRange(from, to)
  cm.getDoc().replaceRange(text, from, undefined, 'cutState')
  const mark = cm.getDoc().markText(from, to, {
    clearOnEnter: true,
    readOnly: true,
    css: 'color: #f33'
  })
  return {from, to, text, mark}
}

let cut_state : CutState | null = null;

cm.on('beforeChange', (_, change) => {
  console.log('beforeChange', change.origin, change);
  if (change.origin == 'cut') {
    change.cancel();
  }
  if (change.origin == 'undo') {
    // we will do our undos ourselves
    change.cancel();
  }
});

cm.on('change', (_, change) => {
  console.log('change', change.origin, change)
})
*/

// Tests

// test cursor
for (let i = 0; i < 100; i++) {
  const arr = randomString(i, 'xyz').split('')
  const arr2 = cursor((prev, me, next) => [prev, me, next])(arr)
  if (arr.some((x, i) => arr2[i] != x)) {
    throw new Error('cursor identity failed')
  }
}

export function dummy_span(text: string) {
  return {text, data: {links: [], labels: []}}
}

// isolated test cases that have failed before
cleanup_after_raw_modifications([' ', 'x', 'ad  '].map(dummy_span))
modify(identity_spans(' ad  '), 1, 1, 'x').map(s => s.text)
modify(identity_spans('c  ed '), 0, 3, 'z  ').map(s => s.text)

/*
for (let i = 0; i < 9; i++) {
  console.log(span_index([exspan('text '), exspan('abcdef ')], i))
}

console.log(modify(['text '].map(exspan), 1, 3, 'ES').map(s => s.text))
for (let i = 1; i < 11; i++) {
  console.log(modify(['abc ', 'defg ', 'hi '].map(exspan), 1, i, 'X Y').map(s => s.text))
}

for (let i = 12; i < 24; i++) {
  console.log(modify(identity_spans('På min telefon. Det väder var inte fint'), 12, i, '').map(s => s.text))
}
*/

function randomString(n: number, alphabet: string): string {
  const r = []
  for (let i = 0; i < n; i++) {
    r.push(alphabet[Math.floor(Math.random()*alphabet.length)])
  }
  return r.join('')
}

for (let i = 0; i < 100; i++) {
  const str = randomString(i, 'abcde \n')
  const repl = randomString(Math.random() * i, 'xyz \n')
  const a = Math.floor(Math.random() * i)
  const b = Math.floor(Math.random() * (i + 1))
  const start = Math.min(a, b)
  const stop = Math.max(a, b)
  //console.group('test input')
  //console.log([str])
  //console.log([repl])
  //console.log(start, stop)
  //console.groupEnd()
  const new_spans = modify(identity_spans(str), start, stop, repl)
  const new_text = new_spans.map(s => s.text).join('')
  const target = str.slice(0, start) + repl + str.slice(stop) + ' '
  //console.log('target', [target])
  //console.log('new_text', [new_text])
  if (target != new_text) {
    throw new Error('Test case failed: ' + target + ' != ' + new_text)
  }
}
