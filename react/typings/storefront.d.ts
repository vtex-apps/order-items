import { FunctionComponent } from 'react'

declare global {
  interface StorefrontFunctionComponent<P = Record>
    extends FunctionComponent<P> {
    getSchema?(props: P): Record
    schema?: Record
  }

  interface StorefrontComponent<P = Record, S = Record>
    extends Component<P, S> {
    getSchema?(props: P): Record
    schema: Record
  }
}
