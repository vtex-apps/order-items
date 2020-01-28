import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useEffect,
} from 'react'
import { useMutation } from 'react-apollo'
import UpdateItems from 'vtex.checkout-resources/MutationUpdateItems'
import AddToCart from 'vtex.checkout-resources/MutationAddToCard'
import { useOrderForm } from 'vtex.order-manager/OrderForm'
import {
  useOrderQueue,
  useQueueStatus,
  QueueStatus,
} from 'vtex.order-manager/OrderQueue'

import {
  LocalOrderTaskType,
  getLocalOrderQueue,
  popLocalOrderQueue,
  pushLocalOrderQueue,
} from './modules/localOrderQueue'
import {
  adjustForItemInput,
  mapItemInputToOrderFormItem,
  AVAILABLE,
} from './utils'

interface Context {
  addItem: (props: Partial<Item>[]) => void
  updateQuantity: (props: Partial<Item>) => void
  removeItem: (props: Partial<Item>) => void
}

enum Totalizers {
  SUBTOTAL = 'Items',
  DISCOUNT = 'Discounts',
}

const updateTotalizersAndValue = ({
  totalizers,
  currentValue,
  newItem,
  oldItem,
}: {
  totalizers: Totalizer[]
  currentValue: number
  newItem: Item
  oldItem: Item
}) => {
  if (oldItem.availability !== AVAILABLE) {
    return { totalizers, value: currentValue }
  }

  const oldPrice = oldItem.price * oldItem.quantity
  const newPrice = newItem.price * newItem.quantity
  const subtotalDifference = newPrice - oldPrice

  const oldDiscount = (oldItem.price - oldItem.sellingPrice) * oldItem.quantity
  const newDiscount = (newItem.price - newItem.sellingPrice) * newItem.quantity
  const discountDifference = oldDiscount - newDiscount

  const newTotalizers = totalizers.map((totalizer: Totalizer) => {
    switch (totalizer.id) {
      case Totalizers.SUBTOTAL:
        return { ...totalizer, value: totalizer.value + subtotalDifference }
      case Totalizers.DISCOUNT:
        return { ...totalizer, value: totalizer.value + discountDifference }
      default:
        return totalizer
    }
  })

  return {
    totalizers: newTotalizers,
    value: currentValue + subtotalDifference + discountDifference,
  }
}

const addToTotalizers = (totalizers: Totalizer[], item: Item): Totalizer[] => {
  const itemPrice = item.price * item.quantity
  const itemDiscount = (item.price - item.sellingPrice) * item.quantity

  if (!totalizers.length) {
    return [
      {
        id: Totalizers.SUBTOTAL,
        name: 'Items Total',
        value: itemPrice,
      },
      {
        id: Totalizers.DISCOUNT,
        name: 'Discounts Total',
        value: -itemDiscount,
      },
    ]
  }

  return totalizers.map(totalizer => {
    switch (totalizer.id) {
      case Totalizers.SUBTOTAL:
        return {
          ...totalizer,
          value: totalizer.value + itemPrice,
        }
      case Totalizers.DISCOUNT:
        return {
          ...totalizer,
          value: totalizer.value - itemDiscount,
        }
      default:
        return totalizer
    }
  })
}

const noop = async () => {}

const OrderItemsContext = createContext<Context>({
  addItem: noop,
  updateQuantity: noop,
  removeItem: noop,
})

const useEnqueueTask = () => {
  const { enqueue, listen } = useOrderQueue()
  const queueStatusRef = useQueueStatus(listen)
  const { setOrderForm } = useOrderForm()

  const enqueueTask = useCallback<(task: () => Promise<OrderForm>) => void>(
    task => {
      enqueue(task).then(
        orderForm => {
          popLocalOrderQueue()
          if (queueStatusRef.current === QueueStatus.FULFILLED) {
            setOrderForm(orderForm)
          }
        },
        error => {
          if (!error || error.code !== 'TASK_CANCELLED') {
            throw error
          }
        }
      )
    },
    [enqueue, queueStatusRef, setOrderForm]
  )

  return enqueueTask
}

interface UpdateItemsMutation {
  updateItems: OrderForm
}

export const OrderItemsProvider: FC = ({ children }) => {
  const { orderForm, setOrderForm } = useOrderForm()

  const enqueueTask = useEnqueueTask()

  const orderFormItemsRef = useRef(orderForm.items)

  useEffect(() => {
    orderFormItemsRef.current = orderForm.items
  }, [orderForm.items])

  const [mutateUpdateQuantity] = useMutation<UpdateItemsMutation>(UpdateItems)
  const [mutateAddItem] = useMutation<
    { addToCart: OrderForm },
    { items: OrderFormItemInput[] }
  >(AddToCart)

  const addItem = useCallback(
    (items: Partial<Item>[]) => {
      const mutationInput = items.map(adjustForItemInput)

      const orderFormItems = mutationInput
        .map((itemInput, index) =>
          mapItemInputToOrderFormItem(itemInput, items[index])
        )
        .filter(
          orderFormItem =>
            orderFormItemsRef.current.findIndex(
              item => item.id === orderFormItem.id
            ) === -1
        )

      if (orderFormItems.length === 0) {
        // all items already exists in the minicart
        return
      }

      setOrderForm(prevOrderForm => ({
        ...prevOrderForm,
        items: [...orderFormItemsRef.current, ...orderFormItems],
        totalizers: orderFormItems.reduce(
          addToTotalizers,
          prevOrderForm.totalizers ?? []
        ),
        value:
          prevOrderForm.value +
          orderFormItems.reduce(
            (total, item) => total + item.sellingPrice * item.quantity,
            0
          ),
      }))

      pushLocalOrderQueue({
        type: LocalOrderTaskType.ADD_MUTATION,
        variables: {
          items: mutationInput,
        },
      })

      enqueueTask(() => {
        return mutateAddItem({ variables: { items: mutationInput } })
          .then(({ data }) => data!.addToCart)
          .then(orderForm => {
            // update the uniqueId of the items that were
            // added locally with the version from the server
            setOrderForm(prevOrderForm => ({
              ...prevOrderForm,
              items: prevOrderForm.items.map(item => {
                const inputIndex = mutationInput.findIndex(
                  inputItem => inputItem.id === +item.id
                )

                if (inputIndex === -1) {
                  return item
                }

                const updatedItem = orderForm.items.find(
                  updatedItem => updatedItem.id === item.id
                )!

                return {
                  ...item,
                  uniqueId: updatedItem.uniqueId,
                }
              }),
            }))

            return orderForm
          })
      })
    },
    [enqueueTask, mutateAddItem, setOrderForm]
  )

  const updateQuantity = useCallback(
    input => {
      let index: number
      let uniqueId = ''

      if (input.id) {
        index = orderFormItemsRef.current.findIndex(
          orderItem => orderItem.id === input.id
        )
      } else if ('uniqueId' in input) {
        uniqueId = input.uniqueId
        index = orderFormItemsRef.current.findIndex(
          orderItem => orderItem.uniqueId === input.uniqueId
        )
      } else {
        index = input.index ?? -1
      }

      if (index < 0 || index >= orderFormItemsRef.current.length) {
        throw new Error('Item not found')
      }

      if (!uniqueId) {
        uniqueId = orderFormItemsRef.current[index].uniqueId
      }

      const quantity = input.quantity ?? 1

      setOrderForm(prevOrderForm => {
        const updatedItems = prevOrderForm.items.slice()

        const oldItem = updatedItems[index]
        const newItem = {
          ...oldItem,
          quantity,
        }

        return {
          ...prevOrderForm,
          ...updateTotalizersAndValue({
            totalizers: prevOrderForm.totalizers,
            currentValue: prevOrderForm.value,
            newItem,
            oldItem,
          }),
          items: updatedItems,
        }
      })

      const mutationVariables = {
        orderItems: [{ uniqueId, quantity }],
      }

      pushLocalOrderQueue({
        type: LocalOrderTaskType.UPDATE_MUTATION,
        variables: mutationVariables,
      })
      enqueueTask(() => {
        return mutateUpdateQuantity({
          variables: mutationVariables,
        }).then(({ data }) => data!.updateItems)
      })
    },
    [enqueueTask, mutateUpdateQuantity, setOrderForm]
  )

  const removeItem = useCallback(
    (props: Partial<Item>) => updateQuantity({ ...props, quantity: 0 }),
    [updateQuantity]
  )

  const value = useMemo(() => ({ addItem, updateQuantity, removeItem }), [
    addItem,
    updateQuantity,
    removeItem,
  ])

  useEffect(() => {
    const localOrderQueue = getLocalOrderQueue()

    localOrderQueue.queue.forEach(task => {
      if (task.type === LocalOrderTaskType.ADD_MUTATION) {
        enqueueTask(() =>
          mutateAddItem({ variables: task?.variables }).then(
            ({ data }) => data!.addToCart
          )
        )
      } else if (task.type === LocalOrderTaskType.UPDATE_MUTATION) {
        enqueueTask(() =>
          mutateUpdateQuantity({
            variables: task?.variables,
          }).then(({ data }) => data!.updateItems)
        )
      }
    })
  }, [enqueueTask, mutateAddItem, mutateUpdateQuantity])

  return (
    <OrderItemsContext.Provider value={value}>
      {children}
    </OrderItemsContext.Provider>
  )
}

export const useOrderItems = () => {
  const context = useContext(OrderItemsContext)
  if (context === undefined) {
    throw new Error('useOrderItems must be used within a OrderItemsProvider')
  }

  return context
}

export default { OrderItemsProvider, useOrderItems }
