import { adjust } from 'ramda'
import React, {
  createContext,
  FunctionComponent,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { branch, renderComponent } from 'recompose'
import { compose, graphql } from 'react-apollo'
import { useOrderManager } from 'vtex.order-manager/OrderManager'

import ItemList from './graphql/itemList.graphql'
import UpdateItem from './graphql/updateItem.graphql'

interface Context {
  itemList: Item[]
  updateItem: (index: number, quantity: number) => void
  loading: boolean
}

interface OrderItemsProviderProps {
  children: ReactNode
  ItemListQuery: any
  UpdateItem: any
}

const OrderItemsContext = createContext<Context | undefined>(undefined)

const EmptyState: FunctionComponent = ({ children }: any) => {
  const updateItem = async (_: number, __: number) => {}
  const value = useMemo(() => ({ itemList: [], updateItem, loading: true }), [])
  return (
    <OrderItemsContext.Provider value={value}>
      {children}
    </OrderItemsContext.Provider>
  )
}

export const OrderItemsProvider = compose(
  graphql(ItemList, { name: 'ItemListQuery', options: { ssr: false } }),
  graphql(UpdateItem, { name: 'UpdateItem' }),
  branch(
    ({ ItemListQuery }: any) => !!ItemListQuery.loading,
    renderComponent(EmptyState)
  )
)(({ children, ItemListQuery, UpdateItem }: OrderItemsProviderProps) => {
  const { enqueue, listen } = useOrderManager()

  const [itemList, setItemList] = useState(ItemListQuery.cart.items)

  const isQueueBusy = useRef(false)
  useEffect(() => {
    const unlisten = listen('Pending', () => (isQueueBusy.current = true))
    return unlisten
  })
  useEffect(() => {
    const unlisten = listen('Fulfilled', () => (isQueueBusy.current = false))
    return unlisten
  })

  const updateItem = useMemo(
    () => (index: number, quantity: number) => {
      const updatedList =
        quantity === 0
          ? [...itemList.slice(0, index), ...itemList.slice(index + 1)]
          : adjust(index, item => ({ ...item, quantity }), itemList)

      setItemList(updatedList)

      const task = async () => {
        const {
          data: {
            updateItems: { items },
          },
        } = await UpdateItem({
          variables: {
            orderItems: [
              {
                index,
                quantity,
              },
            ],
          },
        })

        return items
      }

      enqueue(task)
        .then((items: Item[]) => {
          if (!isQueueBusy.current) {
            setItemList(items)
          }
        })
        .catch((error: any) => {
          if (!error || error.code !== 'TASK_CANCELLED') {
            throw error
          }
        })
    },
    [UpdateItem, enqueue, itemList]
  )

  const value = useMemo(() => ({ itemList, updateItem, loading: false }), [
    itemList,
    updateItem,
  ])

  return (
    <OrderItemsContext.Provider value={value}>
      {children}
    </OrderItemsContext.Provider>
  )
})

export const useOrderItems = () => {
  const context = useContext(OrderItemsContext)
  if (context === undefined) {
    throw new Error('useOrderItems must be used within a OrderItemsProvider')
  }

  return context
}

export default { OrderItemsProvider, useOrderItems }
