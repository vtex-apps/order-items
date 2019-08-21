import { adjust } from 'ramda'
import React, {
  createContext,
  FunctionComponent,
  ReactNode,
  useContext,
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
  return (
    <OrderItemsContext.Provider
      value={{ itemList: [], updateItem, loading: true }}
    >
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
  const { enqueue } = useOrderManager()

  const itemList = ItemListQuery.cart.items

  const updateItem = (index: number, quantity: number) => {
    const updatedList =
      quantity === 0
        ? [...itemList.slice(0, index), ...itemList.slice(index + 1)]
        : adjust(index, item => ({ ...item, quantity }), itemList)

    const task = async (cancellationToken: any) => {
      await UpdateItem({
        variables: {
          orderItems: [
            {
              index,
              quantity,
            },
          ],
        },
        optimisticResponse: {
          __typename: 'Mutation',
          updateItems: {
            __typename: 'Cart',
            items: updatedList,
            optimistic: true,
          },
          optimistic: true,
        },
        update: (
          store: any,
          {
            data: {
              updateItems: { items },
              optimistic,
            },
          }: any
        ) => {
          console.log(index, quantity, { optimistic }, { cancelled: cancellationToken.cancelled }, items.map(item => item.quantity)
          if (!cancellationToken.cancelled) {
            const data = store.readQuery({ query: ItemList })
            data.cart.items = items
            store.writeQuery({ query: ItemList, data })
          }
        },
      })
    }

    enqueue(task, 'order-items-updateItem').catch((error: any) => {
      if (!error || error.code !== 'TASK_CANCELLED') {
        throw error
      }
    })
  }

  return (
    <OrderItemsContext.Provider
      value={{ itemList, updateItem: updateItem, loading: false }}
    >
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
