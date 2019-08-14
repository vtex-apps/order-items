import React, { createContext, ReactNode, useContext } from 'react'
import { compose, graphql } from 'react-apollo'
import { useOrderManager } from 'vtex.order-manager/OrderManager'

import * as ItemList from './graphql/itemList.graphql'
import * as UpdateItem from './graphql/updateItem.graphql'

interface Context {
  itemList: Item[]
  updateItem: (index: number, quantity: number) => PromiseLike<void>
}

interface OrderItemsProviderProps {
  children: ReactNode
  ItemListQuery: any
  UpdateItem: any
}

const OrderItemsContext = createContext<Context | undefined>(undefined)

const OrderItemsProvider = compose(
  graphql(ItemList.default, { name: 'ItemListQuery', options: { ssr: false } }),
  graphql(UpdateItem.default, { name: 'UpdateItem' })
)(({ children, ItemListQuery, UpdateItem }: OrderItemsProviderProps) => {
  const { enqueue } = useOrderManager()

  const itemList = ItemListQuery.loading ? [] : ItemListQuery.cart.items

  const updateItem = (index: number, quantity: number) =>
    enqueue(async () => {
      UpdateItem({
        variables: {
          orderItems: [
            {
              index,
              quantity,
            },
          ],
        },
        refetchQueries: [
          {
            query: ItemList.default,
          },
        ],
      })
    })

  return (
    <OrderItemsContext.Provider value={{ itemList, updateItem: updateItem }}>
      {children}
    </OrderItemsContext.Provider>
  )
})

const useOrderItems = () => {
  const context = useContext(OrderItemsContext)
  if (context === undefined) {
    throw new Error('useOrderItems must be used within a OrderItemsProvider')
  }

  return context
}

export default { OrderItemsProvider, useOrderItems }
