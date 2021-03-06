import { VNode, tag, s, tags } from "snabbis"
const {div} = tags
import { Hooks } from 'snabbdom/hooks';
import { C, c } from "./Classes"
import { Store } from "reactive-lens"
import * as typestyle from "typestyle"
import * as Utils from "./Utils"

export type Active = string[]

export interface State {
  input: string,
  cursor: number | undefined,
  active: Store<Active> | undefined
}

export const init: State = {
  input: '',
  cursor: undefined,
  active: undefined
}

export interface Group {
  label: string,
  choices: Alt[],
  unavailable?: boolean
}

export interface Alt {
  value: string,
  label: string
  unavailable?: boolean,
  index?: number
}

// Sets the unavailable flag accoring to the filter, and also sets indexes on all alts
export function Filter(input: string, active: Active, groups: Group[]): Group[] {
  let ix = 0
  return groups.map(g => {
    const choices = g.choices.map(alt => {
      const index = ix++
      return {
        ...alt,
        unavailable:
          active.some(x => x == alt.value) ||
          (    -1 == alt.value.replace('-','').toLowerCase().indexOf(input.replace('-','').toLocaleLowerCase())
          ),
  //          && -1 == alt.label.replace('-','').toLowerCase().indexOf(input.replace('-','').toLocaleLowerCase())),
        index
      }
    })
    return {...g, choices, unavailable: choices.every(ch => ch.unavailable == true)}
  })
}

export function Index(cursor: number, groups: Group[]): Alt | undefined {
  let ix = 0
  let out = undefined as Alt | undefined
  groups.forEach(g =>
    g.choices.forEach(alt => {
      if (cursor == ix++ && alt.unavailable == false) {
        out = alt
      }
    }))
  return out
}

export function Next(cursor: number, groups: Group[]): number | undefined {
  let ix = 0
  let out = undefined as number | undefined
  groups.forEach(g =>
    g.choices.forEach(alt => {
      const i = ix++
      if (i > cursor && alt.unavailable == false && out === undefined) {
        out = i
      }
    }))
  return out
}

export function Prev(cursor: number, groups: Group[]): number | undefined {
  let ix = 0
  let out = undefined as number | undefined
  groups.forEach(g =>
    g.choices.forEach(alt => {
      const i = ix++
      if (i < cursor && alt.unavailable == false) {
        out = i
      }
    }))
  return out
}

const cl  = {
  containerOuter: s.classed('choices'),
  containerInner: s.classed('choices__inner'),
  input: s.classed('choices__input'),
  inputCloned: s.classed('choices__input--cloned'),
  list: s.classed('choices__list'),
  listItems: s.classed('choices__list--multiple'),
  listSingle: s.classed('choices__list--single'),
  listDropdown: s.classed('choices__list--dropdown'),
  item: s.classed('choices__item'),
  itemSelectable: s.classed('choices__item--selectable'),
  itemDisabled: s.classed('choices__item--disabled'),
  itemChoice: s.classed('choices__item--choice'),
  placeholder: s.classed('choices__placeholder'),
  group: s.classed('choices__group'),
  groupHeading: s.classed('choices__heading'),
  button: s.classed('choices__button'),
  activeState: s.classed('is-active'),
  focusState: s.classed('is-focused'),
  openState: s.classed('is-open'),
  disabledState: s.classed('is-disabled'),
  highlightedState: s.classed('is-highlighted'),
  hiddenState: s.classed('is-hidden'),
  flippedState: s.classed('is-flipped'),
  loadingState: s.classed('is-loading'),
}

export function Handler(store: Store<State>): () => void {
  return () => { return }
  const input = store.at('input')
  return input.ondiff(s => {
    if (s.endsWith(',') || s.endsWith(' ')) {
      input.transaction(() => {
        const active = store.get().active
        if (active !== undefined) {
          Utils.array_store_key(active, s.slice(0, s.length - 1)).set(true)
        }
        input.set('')
      })
    }
  })
}

// this should be thunked on the store
export function Dropdown(store: Store<State>, groups: Group[], obtain: (inp: HTMLInputElement | undefined) => void): VNode {
  const active = store.at('active').get()
  if (!active) {
    return div()
  } else {
    const at_key = (k: string) => Utils.array_store_key(active, k)
    const cursor = store.at('cursor')
    const input = store.at('input')
    const active_groups = () => {
      const j = Filter(input.get(), active.get(), groups)
      return j
    }
    let inp = undefined as undefined | HTMLInputElement
    return div(
      C.DropdownZIndexFix,
      cl.containerOuter,
      div(cl.containerInner,
        div(cl.list, cl.listItems,
          active.get().map((t: string) =>
            div(cl.item, t,
              C.Pointer,
              C.Unselectable,
              s.on('click')(() => at_key(t).set(false))
            )
          ),
          s.input(input,
            undefined,
            cl.input,
            s.attrs({autofocus: true}),
            s.hook('postpatch')((_, vn: VNode) => {
              inp = vn.elm as any
              obtain(inp)
            }),
            s.on('keydown')((e: KeyboardEvent) => {
              let x = cursor.get()
              // console.log('keydown', {x}, e.code, e.keyCode, e.charCode)
              if (x === undefined) {
                x = Next(-1, active_groups())
              }
              // console.log({x}, active_groups())
              if (x !== undefined && e.code == 'ArrowDown') {
                cursor.set(Next(x, active_groups()))
              }
              if (x !== undefined && e.code == 'ArrowUp') {
                cursor.set(Prev(x, active_groups()))
              }
              if (e.code == 'Enter') {
                store.transaction(() => {
                  input.set('')
                  cursor.set(undefined)
                  // console.log('enter', x)
                  if (x !== undefined) {
                    const alt = Index(x, active_groups())
                    // console.log('alt', alt, active_groups())
                    alt && at_key(alt.value).set(true)
                  }
                })
              }
              if (e.code == 'Backspace') {
                if (input.get() == '') {
                  Store.arr(active, 'pop')()
                }
              }
            }),
          ),
        ),
        div(cl.list, cl.listDropdown, cl.activeState,
          Utils.flatMap(Filter(input.get(), active.get(), groups), group =>
            group.unavailable ? [] : [
              div(cl.group, div(cl.groupHeading, group.label),
              ...group.choices.map(alt =>
                  alt.unavailable ||
                  div(cl.item, cl.itemSelectable,
                    s.style({padding: '6px'}),
                    alt.index == cursor.get() && cl.highlightedState,
                    div(C.TaxonomyCodeInDropdown, alt.value),
                    div(C.InlineBlock, alt.label),
                    s.on('click')((e: MouseEvent) => {
                      at_key(alt.value).set(true)
                      e.preventDefault()
                      inp && inp.focus()
                    }),
                    s.on('mouseover')(() => {
                      if (alt.index !== undefined && cursor.get() != alt.index) {
                        cursor.set(alt.index)
                      }
                    })
                  )
                )
              )
            ]
          )
        )
      )
    )
  }
}

