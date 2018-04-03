import * as R from 'ramda'
import * as React from 'react'
import {Store, Lens, Undo, Stack} from 'reactive-lens'
import {style, types, getStyles} from 'typestyle'
import * as typestyle from 'typestyle'
import * as csstips from 'csstips'

import {DropZone} from './DropZone'

import * as D from './Diff'
import {Graph} from './Graph'
import * as G from './Graph'
import * as L from './LadderView'
import * as RD from './RichDiff'
import * as T from './Token'
import * as Utils from './Utils'
import * as record from './record'

import * as C from './Compact'

import {VNode} from './LadderView'

import * as CM from './GraphEditingCM'

import 'codemirror/lib/codemirror.css'
import 'lato-font/css/lato-font.min.css'
import 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'

export interface State {
  readonly graph: Undo<Graph>
  readonly hover_id?: string
  readonly label_id?: string
  readonly selected: Record<string, true>
  readonly cursor_index?: number
}

export const init: State = {
  graph: Undo.init(G.init('')),
  hover_id: undefined,
  label_id: undefined,
  selected: {},
  cursor_index: undefined
}

export function Textarea({
  store,
  onRef,
  ...props
}: {store: Store<string>} & React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    onRef?: (e: HTMLTextAreaElement) => void
  }) {
  return (
    <textarea
      {...props}
      value={store.get()}
      ref={e => onRef && e && onRef(e)}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => store.set(e.target.value)}
    />
  )
}

export function Input(store: Store<string>, tabIndex?: number) {
  return (
    <input
      value={store.get()}
      tabIndex={tabIndex}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.set(e.target.value)}
    />
  )
}

interface ex {
  source: string
  target: string
}
const ex = (source: string, target: string): ex => ({source, target})

const examples: ex[] = `
Their was a problem yesteray . // There was a problem yesterday .

The team that hits the most runs get ice cream . // The team that hits the most runs gets ice cream .

Blue birds have blue and pink feathers . // Bluebirds have blue and pink feathers .

I don't know his lives . // I don't know where he~his lives .

He get to cleaned his son . // He got his~his son~his~son to clean the~ room~ .

We wrote down the number . // We wrote the number down~down .

English is my second language with many difficulties that I faced them in
twolast years I moved in United States .
//

In my homeland we didn’t write as structural as here .
//

During the semester , I frustrated many times with my grades and thought I
couldn’t go up any more , because there was a very big difference between
ESOL 40 with other language people .
//

Sometimes , I recognized about why I’m here and studying with this crazy
language that I couldn’t be good at all ​ .
//

In contrast I faced with my beliefs and challenges that helped me to focus
on my mind to write an essay with these difficult subjectswith no experience
as narrative essay , business essay and all argumentative essays .
//

It makes me proud of myself to write something I never thought I can do
in end of this semester and improve my writing skills , have learned my
challenges and discovered strategies to overcome the challenges .
//
`
  .trim()
  .split(/\n\n+/gm)
  .map(line => ex.apply({}, line.split('//').map(side => side.trim())))

const Button = (label: string, title: string, on: () => void) => (
  <button title={title} onClick={on} style={{cursor: 'pointer'}}>
    {label}
  </button>
)

const topStyle = style({
  ...Utils.debugName('topStyle'),
  fontFamily: 'lato, sans-serif, DejaVu Sans',
  color: '#222',
  display: 'grid',
  gridAutoRows: '',
  gridTemplateColumns: 'min-content min-content [main] 1fr',
  gridGap: '0.8em 0.4em',
  paddingTop: '1em',
  paddingBottom: '4em',
  maxWidth: '700px',
  margin: '0 auto',
  alignItems: 'start',

  $nest: {
    '& .CodeMirror': {
      border: '1px solid #ddd',
      height: '300px',
      minWidth: '250px',
      lineHeight: '1.5em',
      fontFamily: "'Lato', sans-serif",
    },
    [`& .${CM.ManualMarkClassName}`]: {
      color: '#26a',
      background: '#e6e6e6',
    },
    '& > .main': {
      gridColumnStart: 'main',
    },
    '& > *': {
      // Non-grid fallback
      display: 'block',
    },
    '& > button': {
      marginTop: '-0.125em',
      // Non-grid fallback
      display: 'inline-block',
    },
    '& pre.pre-box': {
      fontSize: '0.85em',
      background: 'hsl(0,0%,96%)',
      borderTop: '2px hsl(220,65%,65%) solid',
      boxShadow: '2px 2px 3px 0px hsla(0,0%,0%,0.2)',
      borderRadius: '0px 0px 2px 2px',
      padding: '0.25em',
    },
    '& > .TopPad': {
      paddingTop: '4em',
    },
    '& path': {
      stroke: '#222',
    },
    '& input': {
      width: '100%',
      fontFamily: 'inherit',
      color: 'inherit',
    },
    '& .ladder ul': {
      zIndex: 1,
    },
    '& .Selected, & .Selectable': {
      padding: '3px',
    },
    '& .Selected': {
      background: '#eee',
      color: '#222',
      borderRadius: '3px',
      padding: '2px',
      border: '1px solid #888',
    },
    '& .hoverable, & .hoverable *': {
      transition: 'opacity 50ms 50ms',
      opacity: 1.0,
    },
    [`& .hover *, & .hover `]: {
      opacity: 1.0,
      strokeOpacity: 1.0,
    },
    [`& .not-hover *, & .not-hover `]: {
      opacity: 0.8,
      strokeOpacity: 0.8,
      fillOpacity: 0.8,
    },
    '& .Modal': {
      top: '0px',
      left: '0',
      height: '100%',
      width: '100%',
      bottom: 'auto',
      zIndex: 0,
      position: 'fixed',
    },
    '& .ModalInner': {
      top: '0px',
      left: '0',
      padding: '10px 5px',
      width: '200px',
      height: '100%',

      background: 'hsl(0,0%,96%)',
      borderTop: '2px hsl(220,65%,65%) solid',
      boxShadow: '2px 2px 3px 0px hsla(0,0%,0%,0.2)',
      borderRadius: '0px 0px 2px 2px',
    },
    '& .Modal button': {
      fontSize: '0.85em',
      width: '90px',
      marginBottom: '5px',
      marginRight: '5px',
    },
    '& .Modal li button': {
      width: '30px',
    },
  },
})

export class If extends React.Component<
  {
    children: (b: boolean, set: (b?: any) => void) => React.ReactNode
    init?: boolean
  },
  {b: boolean}
> {
  constructor(p: any) {
    super(p)
    this.state = {b: p.init === undefined ? false : p.init}
  }
  render() {
    const b = this.state.b
    return this.props.children(b, next => this.setState({b: typeof next === 'boolean' ? next : !b}))
  }
}

function showhide(what: string, show: string | VNode, init = false) {
  return (
    <If init={init}>
      {(b, flip) => (
        <React.Fragment>
          <a
            style={{opacity: '0.85', justifySelf: 'end'} as any}
            className="main"
            href=""
            onClick={e => (e.preventDefault(), flip())}>
            {b ? 'hide' : 'show'} {what}
          </a>
          {b && (typeof show === 'string' ? <pre className="pre-box main">{show}</pre> : show)}
        </React.Fragment>
      )}
    </If>
  )
}

type side = 'source' | 'target'
const sides = ['source' as side, 'target' as side]
const op = (x: side) => (x == 'source' ? 'target' : 'source')

const ws_url = 'https://ws.spraakbanken.gu.se/ws/swell'

export function App(store: Store<State>): () => VNode {
  const global = window as any
  global.store = store
  global.reset = () => store.set(init)
  global.G = G
  global.Utils = Utils
  store
    .at('graph')
    .at('now')
    .storage_connect('swell-spaghetti-3')

  store
    .at('graph')
    .at('now')
    .ondiff(g => {
      const inv = G.check_invariant(g)
      if (inv !== 'ok') {
        Utils.stderr(inv)
      }
    })

  const inv = G.check_invariant(store.get().graph.now)
  console.log(inv)
  if (inv !== 'ok') {
    Utils.stderr(inv)
    store.set(init)
  }

  global.test = () => {
    store.set({graph: Undo.init(G.init('this is an example', true)), selected: {}})
  }

  const cm_target = CM.GraphEditingCM(store.pick('graph', 'hover_id', 'cursor_index'))
  return () => View(store, cm_target)
}

export function View(store: Store<State>, cm_target: CM.CMVN): VNode {
  const state = store.get()
  const history = store.at('graph')
  const graph = history.at('now')

  const units: Store<G.ST<string>> = store
    .at('graph')
    .at('now')
    .via(
      Lens.iso(
        g => G.with_st(C.graph_to_units(g), us => C.units_to_string(us)),
        state => {
          const s = C.parse(state.source)
          const t = C.parse(state.target)
          return C.units_to_graph(s, t)
        }
      )
    )

  // Utils.stdout(units.get())
  // Utils.stdout(graph.get().target)
  // Utils.stdout(graph.get())

  // const source = now.at('source')
  // const target = now.at('target')

  const g = graph.get()
  const d = RD.enrichen(g, G.calculate_diff(g))

  function advance(k: () => void) {
    store.transaction(() => {
      history.modify(Undo.advance)
      k()
    })
  }

  function current_subgraph() {
    const ci = store.get().cursor_index
    const g = graph.get()
    if (ci) {
      const s0 = G.sentence(g, ci)
      const s1 = G.sentence(g, ci+1)
      return G.subgraph(g, G.subspan_merge([s0, s1]))
    } else {
      return g
    }
  }

  function LabelSidekick() {
    const selected = Object.keys(state.selected)
    if (selected.length > 0) {
      const edges = G.token_ids_to_edges(state.graph.now, selected)
      const edge_ids = edges.map(e => e.id)
      const labels = Utils.uniq(Utils.flatMap(edges, e => e.labels))
      // const spacesep = label_store.via(Lens.iso(xs => xs.join(' '), s => s.split(/ /g)))
      // function blur(e: React.SyntheticEvent<any>) {
      //   console.log('blur')
      //   store.update({label_id: undefined})
      //   e.preventDefault()
      //   Array.from(document.querySelectorAll('.CodeMirror textarea')).map((e: any) =>
      //     e.focus()
      //   )
      // }
      function pop(l: string) {
        advance(() =>
          edge_ids.forEach(id =>
            graph.modify(g => G.modify_labels(g, id, ls => ls.filter(x => x !== l)))
          )
        )
      }
      function push(l: string) {
        advance(() =>
          edge_ids.forEach(id => graph.modify(g => G.modify_labels(g, id, ls => [l, ...ls])))
        )
      }
      function auto() {
        const edge_ids = G.token_ids_to_edges(graph.get(), selected).map(e => e.id)
        graph.modify(g =>
          G.align({
            ...g,
            edges: record.map(g.edges, e => {
              if (edge_ids.some(id => id == e.id)) {
                return G.Edge(e.ids, e.labels, false)
              } else {
                return e
              }
            }),
          })
        )
      }
      function revert() {
        const edge_ids = G.token_ids_to_edges(graph.get(), selected).map(e => e.id)
        const edges = G.token_ids_to_edges(graph.get(), selected)
        graph.modify(g => G.revert(g, edge_ids))
      }
      function disconnect() {
        graph.modify(g => G.disconnect(g, selected))
      }
      function group() {
        const edge_ids = G.token_ids_to_edges(graph.get(), selected).map(e => e.id)
        graph.modify(g => G.connect(g, edge_ids))
      }
      return (
        <div className="Modal" onClick={e => store.update({selected: {}})}>
          <div className="ModalInner" onClick={e => e.stopPropagation()}>
            <div>
              {Button('undo', '', () => history.modify(Undo.undo))}
              {Button('redo', '', () => history.modify(Undo.redo))}
              {Button('revert', '', () => advance(revert))}
              {Button('auto', '', () => advance(auto))}
              {Button('group', '', () => advance(() => (disconnect(), group())))}
              {Button('merge', '', () => advance(group))}
              {Button('disconnect', '', () => advance(disconnect))}
              {Button('deselect', '', () => store.update({selected: {}}))}
            </div>
            <hr />
            <input
              ref={e => e && e.focus()}
              placeholder="Enter label..."
              onKeyDown={e => {
                console.log(e.key)
                const t = e.target as HTMLInputElement
                if (e.key === 'Enter' || e.key === ' ') {
                  push(t.value)
                  t.value = ''
                }
                if (e.key === 'Escape') {
                  store.update({selected: {}})
                  cm_target.cm.focus()
                }
                if (e.key === 'Backspace' && t.value == '' && labels.length > 0) {
                  pop(labels[0])
                }
              }}
            />
            <ul>
              {labels.map((lbl, i) => (
                <li key={i}>
                  {Button('x', '', () => pop(lbl))} {lbl}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    }
  }

  return (
    <DropZone webserviceURL={ws_url} onDrop={g => advance(() => graph.set(g))}>
      <div className={topStyle} style={{position: 'relative'}}>
        {LabelSidekick()}
        {showhide(
          'set source text',
          <input
            className="main"
            onKeyDown={e =>
              e.key === 'Enter' &&
              advance(() => {
                const t = e.target as HTMLInputElement
                graph.modify(g => G.invert(G.set_target(G.invert(g), t.value)))
              })
            }
            placeholder="Input source text.."
            defaultValue={G.source_text(graph.get())}
          />
        )}
        <div className="main" style={{minHeight: '10em'}}>
          <L.LadderComponent
            graph={current_subgraph()}
            onDrop={undefined && (g => advance(() => graph.set(g)))}
            hoverId={state.hover_id}
            onHover={hover_id => store.update({hover_id})}
            selectedIds={Object.keys(state.selected)}
            onSelect={ids => {
              const selected = store.get().selected
              const b = ids.every(id => selected[id]) ? undefined : true
              console.log(ids, b)
              advance(() =>
                ids.forEach(id =>
                  store
                    .at('selected')
                    .via(Lens.key(id))
                    .set(b)
                )
              )
            }}
          />
        </div>
        <div className="main">{cm_target.node}</div>
        {showhide(
          'compact representation',
          <React.Fragment>
            {sides.map((side, i) => (
              <React.Fragment key={i}>
                {Button('\u2b1a', 'clear', () => advance(() => units.at(side).set('')))}
                {Button(i ? '\u21e1' : '\u21e3', 'copy to ' + side, () =>
                  advance(() => units.at(op(side)).set(units.get()[side]))
                )}
                <input
                  defaultValue={units.at(side).get()}
                  onKeyDown={e =>
                    e.key === 'Enter' &&
                    advance(() => {
                      const t = e.target as HTMLInputElement
                      units.at(side).set(t.value)
                    })
                  }
                  tabIndex={(i + 1) as number}
                  placeholder={'Enter ' + side + ' text...'}
                />
              </React.Fragment>
            ))}
          </React.Fragment>
        )}
        {showhide('graph json', Utils.show(g))}
        {showhide('diff json', Utils.show(d))}
        {links(graph.get())}
        <div className="main TopPad">
          <em>Examples:</em>
        </div>
        {examples.map((e, i) => (
          <React.Fragment key={i}>
            {!e.target ? (
              <div />
            ) : (
              Button('\u21eb', 'see example analysis', () =>
                advance(() => units.set({source: e.source, target: e.target}))
              )
            )}
            {Button('\u21ea', 'load example', () =>
              advance(() => units.set({source: e.source, target: e.source}))
            )}
            <span>{e.source}</span>
          </React.Fragment>
        ))}
      </div>
    </DropZone>
  )
}

function links(g: Graph) {
  const stu = C.graph_to_units(g)
  const esc = (s: string) =>
    encodeURIComponent(s)
      .replace('(', '%28')
      .replace(')', '%29')
  const escaped = G.with_st(stu, units => esc(C.units_to_string(units, '_')))
  const st = escaped.source + '//' + escaped.target
  const url = `${ws_url}/png?${st}`
  const md = `![](${url})`
  return (
    <>
      {showhide(
        'compact form',
        <pre className={'pre-box main '} style={{whiteSpace: 'pre-wrap', overflowX: 'hidden'}}>
          {`${C.units_to_string(stu.source)} // ${C.units_to_string(stu.target)}`}
        </pre>
      )}
      {showhide(
        'copy link',
        <pre
          className={'pre-box main ' + L.Unselectable}
          style={{whiteSpace: 'pre-wrap', overflowX: 'hidden'}}
          draggable={true}
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', md)
          }}>
          {md}
        </pre>,
        true
      )}
    </>
  )
}
