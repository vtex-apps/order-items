import { adjust } from 'ramda'
import React, {
  createContext,
  FunctionComponent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { graphql } from 'react-apollo'
import { useOrderManager } from 'vtex.order-manager/OrderManager'

import UpdateItem from './graphql/updateItem.graphql'

const SUBTOTAL_TOTALIZER_ID = 'Items'

interface Context {
  updateItem: (index: number, quantity: number) => void
}

const OrderItemsContext = createContext<Context | undefined>(undefined)

const LoadingState: FunctionComponent = ({ children }: any) => {
  const updateItem = async (_: number, __: number) => {}
  const value = useMemo(() => ({ itemList: [], updateItem, loading: true }), [])
  return (
    <OrderItemsContext.Provider value={value}>
      {children}
    </OrderItemsContext.Provider>
  )
}

const updateTotalizers = (totalizers: any, difference: number) => {
  return totalizers.map((totalizer: any) => {
    if (totalizer.id !== SUBTOTAL_TOTALIZER_ID) {
      return totalizer
    }
    return { ...totalizer, value: totalizer.value + difference }
  })
}

export const OrderItemsProvider = graphql(UpdateItem, {
  name: 'UpdateItem',
})(({ children, UpdateItem }: any) => {
  const {
    enqueue,
    listen,
    loading,
    orderForm,
    setOrderForm,
  } = useOrderManager()

  if (loading) {
    return <LoadingState>{children}</LoadingState>
  }

  const isQueueBusy = useRef(false)
  useEffect(() => {
    const unlisten = listen('Pending', () => (isQueueBusy.current = true))
    return unlisten
  })
  useEffect(() => {
    const unlisten = listen('Fulfilled', () => (isQueueBusy.current = false))
    return unlisten
  })

  const updateItem = useCallback(
    (index: number, quantity: number) => {
      const updatedList =
        quantity === 0
          ? [
              ...orderForm.items.slice(0, index),
              ...orderForm.items.slice(index + 1),
            ]
          : adjust(index, item => ({ ...item, quantity }), orderForm.items)

      const subtotalDifference =
        orderForm.items[index].price *
        (quantity - orderForm.items[index].quantity)

      setOrderForm({
        ...orderForm,
        totalizers: updateTotalizers(orderForm.totalizers, subtotalDifference),
        value: orderForm.value + subtotalDifference,
        items: updatedList,
      })

      const task = async () => {
        const {
          data: { updateItems: newOrderForm },
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

        return newOrderForm
      }

      enqueue(task)
        .then((newOrderForm: any) => {
          if (!isQueueBusy.current) {
            setOrderForm(newOrderForm)
          }
        })
        .catch((error: any) => {
          if (!error || error.code !== 'TASK_CANCELLED') {
            throw error
          }
        })
    },
    [enqueue, orderForm, setOrderForm, UpdateItem]
  )

  const value = useMemo(() => ({ updateItem }), [updateItem])

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
