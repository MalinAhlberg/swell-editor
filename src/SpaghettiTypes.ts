import * as C from './Compact'
import * as G from './Graph'

export interface Data {
  /** The graph: this is the only /real/ data, the other is meta-data */
  graph: G.Graph

  source_string: string
  target_string: string
  source: C.Unit[]
  target: C.Unit[]
}

// stored in png tEXt
export const key: string = 'swell0'
