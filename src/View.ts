import * as typestyle from "typestyle"
import { ViewDiff } from "./ViewDiff"
import { C, c } from './Classes'
import { VNode } from "snabbdom/vnode"
import { AppState, Diffs } from './Model'
import * as M from './Model'
import * as Utils from './Utils'
import { tag, Content as S } from "snabbis"
import { CatchSubmit, InputField, button, div, span, table, tbody, tr, td, select } from "./Snabbdom"

import { Store, Lens } from "reactive-lens"

export interface CodeMirrors {
  vn_orig: VNode,
  vn_main: VNode,
  // vn_diff: VNode,
  // vn_xml:  VNode,
}

export const View = (store: Store<AppState>, diffs: Diffs, cms: CodeMirrors): VNode => {
  const login = store.at('login')
  const login_state = store.at('login_state')
  const header = tag('h3',
    'Normaliseringseditorsprototyp',
    S.on('click')(_ => store.set(M.init())),
    C.Pointer
  )
  if (login_state.get() == 'out') {
    return div(
      C.MainStyle,
      S.classed(typestyle.style({padding: '10px'})),
      header,
      'you need to login',
      CatchSubmit(
        () => login_state.set('in'),
        InputField(login.at('user')),
        InputField(login.at('password'), S.attrs({'type': 'password'})),
        button('login', () => login_state.set('in'))
      ),
      tag('hr'),
      button('try an example anyway', () => {
        login_state.set('anonymous')
      })
    )
  } else {
    return div(
      C.MainStyle,
      S.classed(typestyle.style({padding: '10px'})),
      header,
      tag('div', cms.vn_orig, C.TextEditor, C.Editor),
      ViewDiff(
        M.current(store).pick('graph', 'selected_index').merge(store.pick('positions', 'navigation')),
        diffs.rich_diff,
        store.get().taxonomy
      ),
      tag('div', cms.vn_main, C.TextEditor, C.Editor),
      tag('hr'),
      login_state.get() == 'anonymous'
      ?
      [
        button('back to login menu', () => login_state.set('out')),
      ]
      :
      [
        button('logout', () => login_state.set('out')),
        button('sync', () => store.at('sync_request').set(true)),
        select(
          store.at('current'),
          store.at('graphs').via(Lens.lens(o => Object.keys(o).sort(), (s, t) => Utils.raise('getter'))),
          (k: string) => tag('option', k))
      ]
    )
  }
}
