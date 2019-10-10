import React, {
  createContext,
  FunctionComponent,
  useCallback,
  useContext,
  useMemo,
} from 'react'
import { graphql } from 'react-apollo'
import debounce from 'debounce'
import { memoizeWith } from 'ramda'
import { updateItems as UpdateItem } from 'vtex.checkout-resources/Mutations'
import {
  QueueStatus,
  useOrderQueue,
  useQueueStatus,
} from 'vtex.order-manager/OrderQueue'
import { useOrderForm } from 'vtex.order-manager/OrderForm'

const DEBOUNCE_TIME_MS = 300

const AVAILABLE = 'available'
const TASK_CANCELLED = 'TASK_CANCELLED'

enum Totalizers {
  SUBTOTAL = 'Items',
  DISCOUNT = 'Discounts',
}

interface Context {
  updateQuantity: (props: Partial<Item>) => void
  removeItem: (props: Partial<Item>) => void
}

const OrderItemsContext = createContext<Context | undefined>(undefined)

const noop = async (_: Partial<Item>) => {}

const LoadingState: FunctionComponent = ({ children }: any) => {
  const value = useMemo(
    () => ({
      itemList: [],
      updateQuantity: noop,
      removeItem: noop,
      loading: true,
    }),
    []
  )
  return (
    <OrderItemsContext.Provider value={value}>
      {children}
    </OrderItemsContext.Provider>
  )
}

const maybeUpdateTotalizers = (
  totalizers: Totalizer[],
  value: number,
  oldItem: Item,
  newItem: Item
) => {
  if (oldItem.availability !== AVAILABLE) {
    return {}
  }

  const oldPrice = oldItem.price * oldItem.quantity
  const newPrice = newItem.price * newItem.quantity
  const subtotalDifference = newPrice - oldPrice

  const oldDiscount = (oldItem.sellingPrice - oldItem.price) * oldItem.quantity
  const newDiscount = (newItem.sellingPrice - newItem.price) * newItem.quantity
  const discountDifference = newDiscount - oldDiscount

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
  const newValue = value + subtotalDifference + discountDifference

  return { totalizers: newTotalizers, value: newValue }
}

const enqueueTask = ({
  task,
  enqueue,
  queueStatusRef,
  setOrderForm,
  taskId,
}: {
  task: () => Promise<any>
  enqueue: (task: any, id?: string) => Promise<any>
  queueStatusRef: React.MutableRefObject<QueueStatus>
  setOrderForm: (orderForm: Partial<OrderForm>) => void
  taskId?: string
}) => {
  enqueue(task, taskId)
    .then((newOrderForm: OrderForm) => {
      if (queueStatusRef.current === QueueStatus.FULFILLED) {
        setOrderForm(newOrderForm)
      }
    })
    .catch((error: any) => {
      if (!error || error.code !== TASK_CANCELLED) {
        throw error
      }
    })
}

const debouncedEnqueueTask = memoizeWith(
  (taskId: string) => taskId,
  (_: string) => debounce(enqueueTask, DEBOUNCE_TIME_MS)
)

export const OrderItemsProvider = graphql(UpdateItem, {
  name: 'UpdateItem',
})(({ children, UpdateItem }: any) => {
  const { enqueue, listen } = useOrderQueue()
  const {
    loading,
    orderForm: { items, totalizers, value: orderFormValue },
    setOrderForm,
  } = useOrderForm()

  if (loading) {
    return <LoadingState>{children}</LoadingState>
  }

  const queueStatusRef = useQueueStatus(listen)

  const itemIds = useCallback(
    (props: Partial<Item>) => {
      let index = props.index
      let uniqueId = props.uniqueId

      if (index) {
        uniqueId = items[index].uniqueId as string
      } else if (uniqueId) {
        index = items.findIndex(
          (item: Item) => item.uniqueId === props.uniqueId
        ) as number
      } else {
        throw new Error(
          'Either index or uniqueId must be provided when updating an item'
        )
      }

      return { index, uniqueId }
    },
    [items]
  )

  const updateOrderForm = useCallback(
    (index: number, props: Partial<Item>) => {
      const newItem = { ...items[index], ...props }

      const updatedList = [
        ...items.slice(0, index),
        ...(props.quantity === 0 ? [] : [newItem]),
        ...items.slice(index + 1),
      ]

      setOrderForm({
        ...maybeUpdateTotalizers(
          totalizers,
          orderFormValue,
          items[index],
          newItem
        ),
        items: updatedList,
      })
    },
    [items, totalizers, orderFormValue, setOrderForm]
  )

  const mutationTask = useCallback(
    (props: Partial<Item>) => async () => {
      const {
        data: { updateItems: newOrderForm },
      } = await UpdateItem({
        variables: {
          orderItems: [props],
        },
      })

      return newOrderForm
    },
    [UpdateItem]
  )

  const updateQuantity = useCallback(
    (props: Partial<Item>) => {
      const { index, uniqueId } = itemIds(props)
      updateOrderForm(index, { quantity: props.quantity })
      const taskId = `updateQuantity-${uniqueId}`
      debouncedEnqueueTask(taskId)({
        task: mutationTask({ uniqueId, quantity: props.quantity }),
        enqueue,
        queueStatusRef,
        setOrderForm,
        taskId,
      })
    },
    [
      enqueue,
      itemIds,
      mutationTask,
      queueStatusRef,
      setOrderForm,
      updateOrderForm,
    ]
  )

  const removeItem = useCallback(
    (props: Partial<Item>) => updateQuantity({ ...props, quantity: 0 }),
    [updateQuantity]
  )

  const value = useMemo(() => ({ updateQuantity, removeItem }), [
    updateQuantity,
    removeItem,
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
