import * as CodeMirror from "codemirror"
import * as Spans from "./Spans"
import * as Utils from "./Utils"
import { TokenDiff }  from "./Utils"
import * as Positions from "./Positions"
import { h } from "snabbdom"
import { VNode } from "snabbdom/vnode"

function table(cols: VNode[][], cls: Record<string, boolean> = {}): VNode {
  return h('div', {class: {row: true, ...cls}},
    cols.map(col => h('div', {class: {column: true}}, col)))
}

// todo: keys on VNodes

const span = (t ?: string, cls: Record<string, boolean> = {}) =>
  t ? h('span', {class: {...cls, LadderCell: true}}, t)
    : h('span', {class: {...cls, LadderCell: true}})

const avg = (xs: number[]) => {
  if (xs.length == 0) {
    return null
  } else {
    return xs.reduce((x,y) => x+y, 0) / xs.length
  }
}

type Link
  = { type: 'segment', from: string, to: string }
  | { type: 'upper', from: string, converge: string }
  | { type: 'lower', to: string, converge: string }

export function ladder_diff(diff: Spans.RichDiff[], pos_dict: Positions.PosDict): VNode {
  const links = [] as Link[]
  // If we are only doing drag or drop and previous did as well,
  // we don't need to start a new column, we can just push onto its parts
  let last_moved = false
  const cols = [] as [VNode[], VNode[]][]
  const name = (vnode: VNode, prefix: string, i: number, j: number|undefined = undefined) => {
    return Positions.posid(prefix+i+(j == undefined ? '' : '.'+j), pos_dict, vnode)
  }
  diff.slice(0, 30).map((d, i) => {
    function elements(): [VNode | null, VNode | null] {
      switch (d.edit) {
        case 'Unchanged':
          links.push({ type: 'segment', from: 'top'+i, to: 'bot'+i })
          return [
            name(span(d.source), 'top', i),
            name(span(d.source), 'bot', i)
          ]
        case 'Edited':
          if (d.target.length == 1 && d.source.length == 1) {
            links.push({ type: 'segment', from: 'top'+i+'.0', to: 'bot'+i+'.0' })
          } else {
            const converge = 'edit'+i
            d.source.map((_, j) => links.push({ type: 'upper', from: 'top'+i+'.'+j, converge }))
            d.target.map((_, j) => links.push({ type: 'lower', to: 'bot'+i+'.'+j, converge }))
          }
          return [
            name(h('span', {class: {CenterCell: true}}, d.source_diffs.map(deletes).map((xs, j) => name(h('span', {class: {LadderCell: true}}, xs), 'top', i, j))), 'top', i),
            name(h('span', {class: {CenterCell: true}}, d.target_diffs.map(inserts).map((xs, j) => name(h('span', {class: {LadderCell: true}}, xs), 'bot', i, j))), 'bot', i)
          ]
        case 'Deleted':
          return [span(d.source, {Delete: true}), null]
        case 'Dragged':
          links.push({type: 'upper', from: 'top'+i, converge: d.join_id})
          return [name(h('span', {class: {LadderCell: true}}, deletes(d.source_diff)), 'top', i), null]
        case 'Dropped':
          links.push({type: 'lower', to: 'bot'+i, converge: d.join_id})
          return [null, name(h('span', {class: {LadderCell: true}}, inserts(d.target_diff)), 'bot', i)]
        case 'Inserted':
          return [null, span(d.target, {Insert: true})]
        default:
          return d
      }
    }
    const [top, bot] = elements().map(x => x == null ? [] : [x])
    const moved = d.edit == 'Dragged' || d.edit == 'Dropped' || d.edit == 'Inserted' || d.edit == 'Deleted'
    if (moved && last_moved) {
      cols[cols.length-1][0].push(...top)
      cols[cols.length-1][1].push(...bot)
    } else {
      cols.push([top, bot])
    }
    last_moved = moved
  })
  const ladder = Positions.posid('table', pos_dict, table(cols.map(([u, d]) => [
    h('span', {class: {CenterCell: true}}, u),
    h('span', {class: {CenterCell: true}}, d)
  ]), {LadderTable: true}))
  const m = {} as Record<string, number[]>
  links.map(link => {
    //console.log(link)
    if (link.type == 'upper') {
      const c = link.converge;
      if (link.from in pos_dict.dict) {
        (m[c] || (m[c] = [])).push(Positions.hmid(pos_dict.dict[link.from]));
      }
    } else if (link.type == 'lower') {
      const c = link.converge;
      if (link.to in pos_dict.dict) {
        (m[c] || (m[c] = [])).push(Positions.hmid(pos_dict.dict[link.to]));
      }
    }
  })
  const table_pos = pos_dict.dict['table']
  const ym = table_pos ? Positions.vmid(table_pos) - 2 : null

  const svg = ym == null ? h('span') :
    h('svg', {class: {Width100Pct: true}}, links.map(link => {
      if (link.type == 'upper') {
        const top = pos_dict.dict[link.from]
        if (!top) return;
        const x1 = Positions.hmid(top)
        const y1 = Positions.bot(top)
        const x2 = avg(m[link.converge])
        const y2 = ym
        const d = 15
        if (x2 == null) return
        return h('path', {attrs: {
          d: ['M', x1, y1, 'Q', x1, y1 + d, x2, y2].join(' '),
          stroke: "#777",
          'stroke-width': '1.5',
          fill: "none"
        }})
      } else if (link.type == 'lower') {
        const bot = pos_dict.dict[link.to]
        if (!bot) return;
        const x1 = Positions.hmid(bot)
        const y1 = bot.top
        const x2 = avg(m[link.converge])
        const y2 = ym
        const d = -15
        if (x2 == null) return
        return h('path', {attrs: {
          d: ['M', x1, y1, 'Q', x1, y1 + d, x2, y2].join(' '),
          stroke: "#777",
          'stroke-width': '1.5',
          fill: "none"
        }})
      } else if (link.type == 'segment') {
        const top = pos_dict.dict[link.from]
        const bot = pos_dict.dict[link.to]
        if (!top || !bot) return;
        const x1 = Positions.hmid(top)
        const y1 = Positions.bot(top)
        const x2 = Positions.hmid(bot)
        const y2 = bot.top
        const d = 35 * (-1 / (Math.abs(x1 - x2) + 1) + 1)
        return h('path', {attrs: {
          d: ['M', x1, y1, 'C', x1, y1 + d, x2, y2 - d, x2, y2].join(' '),
          stroke: "#777",
          'stroke-width': '1.5',
          fill: "none"
        }})
      }
    }).filter(x => x != null))
  return Positions.relative(ladder, svg, {LadderRoot: true})
}

const diff_to_spans = (rules: (string | null)[]) => (d: [number, string][]) =>
  diff_helper(d, rules, (text, cls) => h('span', classes([cls]), text))

const inserts = diff_to_spans([null, '', 'Insert'])

const deletes = diff_to_spans(['Delete', '', null])

function diff_helper<A>(token_diff: [number, string][], rules: (string | null)[], cb: (text: string, className: string) => A): A[] {
  const out = [] as A[]
  token_diff.map(([type, text]) => {
    const cls = rules[type + 1]
    if (cls != null) {
      out.push(cb(text, cls))
    }
  })
  return out
}

function classes(cls: string[]): {class: Record<string, boolean>} {
  const d = {} as Record<string, boolean>
  cls.map(c => { if (c != '') { d[c] = true }})
  return {class: d}
}

const diff_and_whitespace = (diff: TokenDiff) => {
  if (diff.length == 0) {
    return {diff, whitespace: ''}
  } else {
    const [type, string] = diff[diff.length - 1]
    const [word, whitespace] = Utils.whitespace_split(string)
    const init = diff.slice(0, diff.length-1)
    if (word.length > 0) {
      return {diff: [...init, [type, word]] as TokenDiff, whitespace}
    } else {
      return {diff: init, whitespace}
    }
  }
}

/** Draws a diff onto a code mirror */
export const draw_diff = (diff: Spans.RichDiff[], editor: CodeMirror.Editor) => editor.operation(() => {
  const diff_doc = editor.getDoc()
  diff_doc.setValue('')
  diff_doc.getAllMarks().map((m) => m.clear())
  function push(text: string, className: string = '') {
    diff_doc.replaceSelection(text)
    if (className) {
      const end = diff_doc.getCursor()
      const begin = diff_doc.posFromIndex(diff_doc.indexFromPos(end) - text.length)
      diff_doc.markText(begin, end, {className})
    }
  }
  function push_diff(token_diff: TokenDiff, className: string = '') {
    diff_helper(token_diff, [' Delete', '', ' Insert'], (text, cls) => push(text, className + cls))
  }
  const rename_map = {} as {[x: string]: string}
  let i = 0
  diff.map(d => {
    if (d.edit == 'Dropped') {
      d.ids.map(id => id in rename_map || (rename_map[id] = ++i + ''))
    }
  })
  const rename = (id: string) => rename_map[id] || '?'
  diff.map(d => {
    if (d.edit == 'Unchanged') {
      push(d.source)
    } else if (d.edit == 'Edited') {
      push_diff(Utils.token_diff(d.source.join(''), d.target.join('')))
    } else if (d.edit == 'Dropped') {
      const m = diff_and_whitespace(d.target_diff.filter(([t, _]) => t != -1))
      push_diff(m.diff, 'Dropped')
      push(d.ids.map(rename).join(','), 'Subscript')
      push(m.whitespace)
    } else if (d.edit == 'Dragged') {
      const m = diff_and_whitespace(d.source_diff.filter(([t, _]) => t != 1))
      push_diff(m.diff, 'Dragged')
      push(rename(d.id), 'Subscript')
      push(m.whitespace)
    } else if (d.edit == 'Inserted') {
      const [s, t] = Utils.whitespace_split(d.target)
      push(s, 'Insert')
      push(t)
    } else if (d.edit == 'Deleted') {
      const [s, t] = Utils.whitespace_split(d.source)
      push(s, 'Delete')
      push(t)
    } else {
      push(d)
    }
  })
})
