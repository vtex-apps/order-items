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
import { updateItems as UpdateItem } from 'vtex.checkout-resources/Mutations'
import { useOrderQueue } from 'vtex.order-manager/OrderQueue'
import { useOrderForm } from 'vtex.order-manager/OrderForm'

const SUBTOTAL_TOTALIZER_ID = 'Items'

interface Context {
  updateItem: (props: Partial<Item>) => void
}

const OrderItemsContext = createContext<Context | undefined>(undefined)

const LoadingState: FunctionComponent = ({ children }: any) => {
  const updateItem = async (_: Partial<Item>) => {}
  const value = useMemo(() => ({ itemList: [], updateItem, loading: true }), [])
  return (
    <OrderItemsContext.Provider value={value}>
      {children}
    </OrderItemsContext.Provider>
  )
}

const updateTotalizers = (totalizers: Totalizer[], difference: number) => {
  return totalizers.map((totalizer: Totalizer) => {
    if (totalizer.id !== SUBTOTAL_TOTALIZER_ID) {
      return totalizer
    }
    return { ...totalizer, value: totalizer.value + difference }
  })
}

export const OrderItemsProvider = graphql(UpdateItem, {
  name: 'UpdateItem',
})(({ children, UpdateItem }: any) => {
  const { enqueue, listen } = useOrderQueue()
  const { loading, orderForm, setOrderForm } = useOrderForm()

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
    (props: Partial<Item>) => {
      let index = props.index

      if (!index) {
        if (!props.uniqueId) {
          throw new Error(
            'Either index or uniqueId must be provided to updateItem'
          )
        }

        index = orderForm.items.findIndex(
          (item: Item) => item.uniqueId === props.uniqueId
        ) as number
      }

      const newItem = { ...orderForm.items[index], ...props }

      const updatedList = [
        ...orderForm.items.slice(0, index),
        ...(props.quantity === 0 ? [] : [newItem]),
        ...orderForm.items.slice(index + 1),
      ]

      const oldValue =
        orderForm.items[index].price * orderForm.items[index].quantity
      const newValue = newItem.price * newItem.quantity
      const subtotalDifference = newValue - oldValue

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
            orderItems: [props],
          },
        })

        return newOrderForm
      }

      enqueue(task)
        .then((newOrderForm: OrderForm) => {
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
