/** Parallel corpus as a graph

Missing functions:

    revert           // revert (i.e. undo) at a certain position
    auto_insert      // split prefix or suffixes token if they are the only change
    auto_revert      // split up edges into smaller pieces if there is no diff anymore
    invert           // swap source and target
    trail_whitespace // makes all whitespace be trailing whitesapec

*/
import * as Utils from './Utils'
import { Diff, Dragged, Dropped } from './Diff'
import * as D from './Diff'
import { Token, Span } from './Token'
import * as T from './Token'
import { Lens, Store } from 'reactive-lens'

export interface Graph {
  readonly source: Token[],
  readonly target: Token[],
  readonly edges: Record<string, Edge>
}

export interface Edge {
  readonly id: string,
  readonly ids: string[],
  readonly labels: string[]
}

export function Edge(ids: string[], labels: string[]): Edge {
  return { id: 'e-' + ids.join('-'), ids, labels }
}

export function edge_record(es: Edge[]): Record<string, Edge> {
  const out = {} as Record<string, Edge>
  es.forEach(e => out[e.id] = e)
  return out
}

/** Checks that the invariant of the graph holds

  check_invariant(init('apa bepa cepa')) // => 'ok'

It's ok for edges to be connected with only tokens from one side.

*/
export function check_invariant(g: Graph): 'ok' | {violation: string, g: Graph} {
  try {
    const tokens = g.source.concat(g.target)
    {
      const unique_id = Utils.unique_check<string>()
      tokens.forEach(t => unique_id(t.id) || Utils.raise('Duplicate id: ' + t))
    }
    const check_tokens = (toks: string[]) => toks.forEach((t, i) => {
      if (i != toks.length - 1) {
        t.match(/^\s*\S+\s+$/) || Utils.raise('Bad text token: ' + JSON.stringify(t))
      } else {
        t.match(/^\s*\S+\s*$/) || Utils.raise('Bad last token: ' + JSON.stringify(t))
      }
    })
    check_tokens(target_texts(g))
    check_tokens(source_texts(g))
    const ids = new Set(tokens.map(t => t.id))
    {
      const unique_id = Utils.unique_check<string>()
      Utils.record_forEach(g.edges, e =>
        e.ids.forEach(id => {
          unique_id(id) || Utils.raise('Duplicate id in edge id list: ' + id)
          ids.has(id) || Utils.raise('Edge talks about unknown id: ' + id)
        }))
      Utils.record_forEach(g.edges, e =>
        unique_id(e.id) || Utils.raise('Duplicate edge id: ' + e.id)
      )
    }
    Utils.record_forEach(g.edges, e =>
      e.ids.length > 0 ||
      Utils.raise('Edge without any associated identifiers')
    )
  } catch (e) {
    console.error(e)
    console.error(JSON.stringify(g, undefined, 2))
    return {violation: e, g}
  }
  return 'ok'
}

/** Makes spans from an original text by tokenizing it and assumes no changes

  const g = init('w1 w2')
  const source = [{text: 'w1 ', id: 's0'}, {text: 'w2', id: 's1'}]
  const target = [{text: 'w1 ', id: 't0'}, {text: 'w2', id: 't1'}]
  const edges = edge_record([Edge(['s0', 't0'], []), Edge(['s1', 't1'], [])])
  g // => {source, target, edges}

*/
export function init(s: string): Graph {
  return init_from(T.tokenize(s))
}

/** Makes a graph from tokens */
export function init_from(tokens: string[]): Graph {
  return {
    source: T.identify(tokens, 's'),
    target: T.identify(tokens, 't'),
    edges: edge_record(tokens.map((_, i) => Edge(['s' + i, 't' + i], []))),
  }
}

/** Map from token and edge identifiers to edges

  const g = init('w')
  const e = Edge(['s0', 't0'], [])
  const lhs = [...edge_map(g).entries()]
  const rhs = [['s0', e], ['t0', e]]
  lhs // => rhs

*/
export function edge_map(g: Graph): Map<string, Edge> {
  return new Map(Utils.flatten(Utils.record_traverse(g.edges,
    e => e.ids.map(id => [id, e] as [string, Edge]))))
}

/**

  const g = init('a b c')
  const e = Edge(['s1', 't1'], [])
  const source = [g.source[1]]
  const target = [g.target[1]]
  partition_ids(g)(e) // => {source, target}

*/
export function partition_ids(g: Graph): (edge: Edge) => {source: Token[], target: Token[]} {
  const sm = source_map(g)
  const tm = target_map(g)
  return (edge: Edge) => {
    const source = [] as Token[]
    const target = [] as Token[]
    edge.ids.forEach(id => {
      const s = sm.get(id)
      if (s !== undefined) {
        source.push(g.source[s])
      }
      const t = tm.get(id)
      if (t !== undefined) {
        target.push(g.target[t])
      }
    })
    return {source, target}
  }
}

/** Map from source identifiers to offsets

  const g = init('a b c')
  const m = source_map(g)
  m.get('s0') // => 0
  m.get('s1') // => 1
  m.has('t0') // => false

*/
export function source_map(g: Graph): Map<string, number> {
  return new Map(g.source.map((s, i) => [s.id, i] as [string, number]))
}

/** Map from target identifiers to offsets

  const g = init('a b c')
  const m = target_map(g)
  m.get('t0') // => 0
  m.get('t1') // => 1
  m.has('s0') // => false

*/
export function target_map(g: Graph): Map<string, number> {
  return new Map(g.target.map((t, i) => [t.id, i] as [string, number]))
}


/** The edge at a position (in the target text)

  const g = init('apa bepa cepa')
  edge_at(g, 1) // => Edge(['s1', 't1'], [])

*/
export function edge_at(g: Graph, index: number): Edge {
  const target_id  = g.target[index].id
  return edge_map(g).get(target_id) || Utils.raise('Out of bounds: ' + JSON.stringify({g, index}))
}

/** The related ids at a position (in the target text)

  const g = init('apa bepa cepa')
  related(g, 1) // => ['s1', 't1']

*/
export function related(g: Graph, index: number): string[] {
  return edge_at(g, index).ids
}

/** The text in the target

  target_text(init('apa bepa cepa ')) // => 'apa bepa cepa '

*/
export function target_text(g: Graph): string {
  return T.text(g.target)
}

/** The text in the source

  source_text(init('apa bepa cepa ')) // => 'apa bepa cepa '

*/
export function source_text(g: Graph): string {
  return T.text(g.source)
}

/** The texts in the target

  target_texts(init('apa bepa cepa ')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function target_texts(g: Graph): string[] {
  return T.texts(g.target)
}

/** The texts in the source

  source_texts(init('apa bepa cepa ')) // => ['apa ', 'bepa ', 'cepa ']

*/
export function source_texts(g: Graph): string[] {
  return T.texts(g.source)
}

/**

  const abc = ['012', '3456', '789']
  token_at(abc, 0) // => {token: 0, offset: 0}
  token_at(abc, 2) // => {token: 0, offset: 2}
  token_at(abc, 3) // => {token: 1, offset: 0}
  token_at(abc, 6) // => {token: 1, offset: 3}
  token_at(abc, 7) // => {token: 2, offset: 0}
  token_at(abc, 9) // => {token: 2, offset: 2}
  Utils.throws(() => token_at(abc, 10)) // => true

*/
export function token_at(tokens: string[], character_offset: number): {token: number, offset: number} {
  let passed = 0
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i].length
    passed += w
    if (passed > character_offset) {
      return {token: i, offset: character_offset - passed + w}
    }
  }
  return Utils.raise('Out of bounds: ' + JSON.stringify({tokens, character_offset}))
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello']
  show(modify(g, 0, 0, 'new')) // => ['newtest ', 'graph ', 'hello']
  show(modify(g, 0, 1, 'new')) // => ['newest ', 'graph ', 'hello']
  show(modify(g, 0, 5, 'new ')) // => ['new ', 'graph ', 'hello']
  show(modify(g, 0, 5, 'new')) // => ['newgraph ', 'hello']
  show(modify(g, 5, 5, ' ')) // => ['test ', ' graph ', 'hello']
  show(modify(g, 5, 6, ' ')) // => ['test ', ' raph ', 'hello']

Indexes are character offsets (use CodeMirror's doc.posFromIndex and doc.indexFromPos to convert) */
export function modify(g: Graph, from: number, to: number, text: string): Graph {
  const tokens = target_texts(g)
  const {token: from_token, offset: from_ix} = token_at(tokens, from)
  const {token: to_token, offset: to_ix} = token_at(tokens, to)
  const slice = g.target.slice(from_token, to_token + 1)
  const pre = slice.length > 0 ? slice[0].text.slice(0, from_ix) : ""
  const post = slice.length > 0 ? slice[slice.length - 1].text.slice(to_ix) : ""
  return modify_tokens(g, from_token, to_token + 1, pre + text + post)
}

/** Replace the text at some position, merging the spans it touches upon.

  const show = (g: Graph) => g.target.map(t => t.text)
  const ids = (g: Graph) => g.target.map(t => t.id).join(' ')
  const g = init('test graph hello')
  show(g) // => ['test ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 0, 'this '))     // => ['this ', 'test ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 1, 'this '))     // => ['this ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 1, '  white '))  // => ['  white ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 1, 'this'))      // => ['thisgraph ', 'hello']
  show(modify_tokens(g, 1, 2, 'graph'))     // => ['test ', 'graphhello']
  show(modify_tokens(g, 1, 2, ' graph '))   // => ['test ', ' graph ', 'hello']
  show(modify_tokens(g, 0, 1, 'for this ')) // => ['for ', 'this ', 'graph ', 'hello']
  show(modify_tokens(g, 0, 2, '')) // => ['hello']
  show(modify_tokens(g, 0, 2, '  ')) // => ['  hello']
  show(modify_tokens(g, 1, 3, '  ')) // => ['test   ']
  ids(g) // => 't0 t1 t2'
  ids(modify_tokens(g, 0, 0, 'this '))     // => 't3 t0 t1 t2'
  ids(modify_tokens(g, 0, 1, 'this '))     // => 't3 t1 t2'
  ids(modify_tokens(g, 0, 1, 'this'))      // => 't3 t2'

Indexes are token offsets */
export function modify_tokens(g: Graph, from: number, to: number, text: string): Graph {
  if (text.match(/^\s+$/)) {
    // replacement text is only whitespace: need to find some token to put it on
    if (from > 0) {
      return modify_tokens(g, from - 1, to, g.target[from - 1].text + text)
    } else if (to < g.target.length) {
      return modify_tokens(g, from, to + 1, text + g.target[to].text)
    } else {
      // console.warn('Introducing whitespace into empty graph')
    }
  }
  if (text.match(/\S$/) && to < g.target.length) {
    // if replacement text does not end with whitespace, grab the next word as well
    return modify_tokens(g, from, to + 1, text + g.target[to].text)
  }

  const id_offset = Utils.next_id(g.target.map(t => t.id))
  const tokens = T.tokenize(text).map((t, i) => ({text: t, id: 't' + (id_offset + i)}))
  const [target, removed] = Utils.splice(g.target, from, to - from, ...tokens)
  const ids_removed = new Set(removed.map(t => t.id))
  const new_edge_ids = new Set<string>(tokens.map(t => t.id))
  const new_edge_labels = new Set<string>()
  const edges = Utils.record_filter(g.edges, e => {
    if (e.ids.some(id => ids_removed.has(id))) {
      e.ids.forEach(id => ids_removed.has(id) || new_edge_ids.add(id))
      e.labels.forEach(lbl => new_edge_labels.add(lbl))
      return false
    } else {
      return true
    }
  })
  if (new_edge_ids.size > 0) {
    const e = Edge([...new_edge_ids], [...new_edge_labels])
    edges[e.id] = e
  }
  return {source: g.source, target, edges}
}

/** Moves a slice of the target tokens and puts it at a new destination.

  target_text(rearrange(init('apa bepa cepa depa'), 1, 2, 0)) // => 'bepa cepa apa depa'

Indexes are token offsets
*/
export function rearrange(g: Graph, begin: number, end: number, dest: number): Graph {
  return {...g, target: Utils.rearrange(g.target, begin, end, dest)}
}

/** Calculate the ladder diff without merging contiguous edits */
function calculate_raw_diff(g: Graph): (Dragged | Dropped)[] {
  const m = edge_map(g)
  const lookup = (id: string) => m.get(id) as Edge
  const edge_id = (tok: Token) => lookup(tok.id).id
  const d = Utils.hdiff<Token, Token>(g.source, g.target, edge_id, edge_id)
  return Utils.flatMap(d, c => {
    if (c.change == 0) {
      return [
        D.Dragged(c.a, edge_id(c.a)),
        D.Dropped(c.b, edge_id(c.b)),
      ]
    } else if (c.change == -1) {
      return [D.Dragged(c.a, edge_id(c.a))]
    } else if (c.change == 1) {
      return [D.Dropped(c.b, edge_id(c.b))]
    } else {
      return Utils.absurd(c)
    }
  })
}

/** Merging contiguous edits */
function merge_diff(diff: (Dragged | Dropped)[]): Diff[] {
  const rev = new Map<string, number[]>()
  diff.forEach((d, i) => {
    let m = rev.get(d.id)
    if (m === undefined) {
      m = []
      rev.set(d.id, m)
    }
    m.push(i)
  })
  const out = [] as Diff[]
  for (let i = 0; i < diff.length; i++) {
    const d = diff[i]
    const m = rev.get(d.id)
    if (m && Utils.contiguous(m)) {
      const {dragged, dropped} = D.partition(diff.slice(i, i + m.length))
      out.push(
        D.Edited(
          dragged.map(c => c.source),
          dropped.map(c => c.target),
          d.id))
      i += m.length - 1
    } else {
      out.push(d)
    }
  }
  return out
}

/** Calculate the diff

  const expect = [
    {
      edit: 'Dragged',
      source: {text: 'apa ', id: 's0'},
      id: "e-s0-t0",
    },
    {
      edit: 'Edited',
      source: [{text: 'bepa ', id: 's1'}],
      target: [{text: 'bepa ', id: 't1'}],
      id: "e-s1-t1",
    },
    {
      edit: 'Edited',
      source: [{text: 'cepa ', id: 's2'}],
      target: [{text: 'cepa ', id: 't2'}],
      id: "e-s2-t2",
    },
    {
      edit: 'Dropped',
      target: {text: 'apa ', id: 't0'},
      id: "e-s0-t0",
    }
  ]
  const g = calculate_diff(rearrange(init('apa bepa cepa '), 1, 2, 0))
  g // => expect

  const expect = [
    {
      edit: 'Edited',
      source: [{text: 'apa ', id: 's0'}],
      target: [{text: 'apa ', id: 't0'}],
      id: "e-s0-t0",
    }
    {
      edit: 'Edited',
      source: [{text: 'bepa ', id: 's1'}],
      target: [
        {text: 'depa ', id: 't3'},
        {text: 'epa ', id: 't4'}
      ],
      id: "e-t3-t4-s1",
    },
    {
      edit: 'Edited',
      source: [{text: 'cepa ', id: 's2'}],
      target: [{text: 'cepa ', id: 't2'}],
      id: "e-s2-t2",
    }
  ]
  const g = calculate_diff(modify_tokens(init('apa bepa cepa '), 1, 2, 'depa epa '))
  g // => expect

*/
export function calculate_diff(g: Graph): Diff[] {
  return merge_diff(calculate_raw_diff(g))
}

/** Gets the sentence in the target text around some offset, without thinking about edits */
export function proto_target_sentence(g: Graph, i: number): Span {
  return T.sentence(target_texts(g), i)
}

/** Gets the sentence in the target text around some offset, following edges */
export function target_sentence(g: Graph, i: number): Span {
  let target = proto_target_sentence(g, i)
  const em = edge_map(g)
  const tm = target_map(g)
  let stable = false
  while (!stable) {
    stable = true
    for (let i = target.begin; i <= target.end; ++i) {
      for (let id of (em.get(g.target[i].id) as Edge).ids) {
        let j = tm.get(id)
        if (j !== undefined && !T.span_within(j, target)) {
          target = T.span_merge(target, proto_target_sentence(g, j))
          stable = false
        }
      }
    }
  }
  return target
}

export type Subspans = {source: Span, target: Span}

/** Gets the sentence in the target text around some offset

  const g = init('apa bepa . Cepa depa . epa')
  sentence(g, 0) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentence(g, 1) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentence(g, 2) // => {source: {begin: 0, end: 2}, target: {begin: 0, end: 2}}
  sentence(g, 3) // => {source: {begin: 3, end: 5}, target: {begin: 3, end: 5}}
  const g2 = modify_tokens(g, 1, 4, 'uff ! Hepp plepp ')
  target_text(g2) // => 'apa uff ! Hepp plepp depa . epa'
  sentence(g2, 0) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentence(g2, 1) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentence(g2, 2) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}
  sentence(g2, 3) // => {source: {begin: 0, end: 5}, target: {begin: 0, end: 6}}

*/
export function sentence(g: Graph, i: number): Subspans {
  let target = target_sentence(g, i)
  const em = edge_map(g)
  const sm = source_map(g)
  let source = {begin: g.source.length - 1, end: 0}
  for (let i = target.begin; i <= target.end; ++i) {
    for (let id of (em.get(g.target[i].id) as Edge).ids) {
      let j = sm.get(id)
      if (j !== undefined) {
        source = T.span_merge(source, {begin: j, end: j})
      }
    }
  }
  return {source, target}
}

/** The subgraph from a subspan

  const g = init('apa bepa . cepa depa . epa')
  target_text(subgraph(g, sentence(g, 3))) // => 'cepa depa . '

*/
export function subgraph(g: Graph, s: Subspans): Graph {
  const source = g.source.slice(s.source.begin, s.source.end + 1)
  const target = g.target.slice(s.target.begin, s.target.end + 1)
  const proto_g = {source, target, edges: edge_record([])}
  const sm = source_map(proto_g)
  const tm = target_map(proto_g)
  const edges = Utils.record_filter(g.edges, e => e.ids.some(id => sm.has(id) || tm.has(id)))
  return {source, target, edges}
}

/** Modify the labels at an identifier

  const g = init('word')
  const g2 = modify_labels(g, 'e-s0-t0', (labels: string[]) => [...labels, 'ABC'])
  const g3 = modify_labels(g2, 'e-s0-t0', (labels: string[]) => [...labels, 'DEF'])
  g3.edges['e-s0-t0'].labels // => ['ABC', 'DEF']

*/
export function modify_labels(g: Graph, edge_id: string, k: (labels: string[]) => string[]): Graph {
  const store = Store.init(g)
  const labels = label_store(store, edge_id)
  labels.modify(k)
  return store.get()
}

export function label_store(g: Store<Graph>, edge_id: string): Store<string[]> {
  return g.at('edges').via(Lens.key(edge_id)).via(Lens.def(Edge([], []))).at('labels')
}
