import { equals } from 'ramda'
import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react'
import { useMutation } from 'react-apollo'
import UpdateItems from 'vtex.checkout-resources/MutationUpdateItems'
import AddToCart from 'vtex.checkout-resources/MutationAddToCard'
import {
  QueueStatus,
  useOrderQueue,
  useQueueStatus,
} from 'vtex.order-manager/OrderQueue'
import { useOrderForm } from 'vtex.order-manager/OrderForm'

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

interface CancellablePromiseLike<T> extends PromiseLike<T> {
  cancel: () => void
}

interface EnqueuedTask {
  promise?: CancellablePromiseLike<any>
  variables?: any
}

const OrderItemsContext = createContext<Context | undefined>(undefined)

const noop = async (_: Partial<Item>) => {}

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
  enqueue: (
    task: () => Promise<any>,
    id?: string
  ) => CancellablePromiseLike<any>
  queueStatusRef: React.MutableRefObject<QueueStatus>
  setOrderForm: (orderForm: Partial<OrderForm>) => void
  taskId?: string
}) => {
  const promise = enqueue(task, taskId)

  const cancelPromise = promise.cancel

  const newPromise = promise.then(
    (newOrderForm: OrderForm) => {
      if (queueStatusRef.current === QueueStatus.FULFILLED) {
        setOrderForm(newOrderForm)
      }
    },
    error => {
      if (!error || error.code !== TASK_CANCELLED) {
        throw error
      }
    }
  ) as CancellablePromiseLike<void>

  newPromise.cancel = cancelPromise
  return newPromise
}

interface UpdateItemsMutation {
  updateItems: OrderForm
}

export const OrderItemsProvider: FC = ({ children }) => {
  const { enqueue, listen, isWaiting } = useOrderQueue()
  const { loading, orderForm, setOrderForm } = useOrderForm()

  const [updateItems] = useMutation<UpdateItemsMutation>(UpdateItems)

  const queueStatusRef = useQueueStatus(listen)
  const lastUpdateTaskRef = useRef<EnqueuedTask>({
    promise: undefined,
    variables: undefined,
  })

  if (!orderForm) {
    throw new Error('Unable to fetch order form.')
  }

  const { items, totalizers, value: orderFormValue } = orderForm

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
    (items: Partial<Item>[]) => async () => {
      const { data } = await updateItems({
        variables: {
          orderItems: items,
        },
      })

      const newOrderForm = (data && data.updateItems) || {}

      return newOrderForm
    },
    [updateItems]
  )

  const [addToCart] = useMutation<
    { addToCart: OrderForm },
    { items: OrderFormItemInput[] }
  >(AddToCart)

  const addItem = useCallback(
    async (skuItems: OrderFormItemInput[]) => {
      const mutationResult = await addToCart({
        variables: { items: skuItems },
      })

      if (mutationResult.errors) {
        console.error(mutationResult.errors)
        // toastMessage({ success: false, isNewItem: false })
        return
      }

      if (
        mutationResult.data &&
        equals(mutationResult.data.addToCart, orderForm)
      ) {
        // toastMessage({ success: true, isNewItem: false })
        return
      }

      // Update OrderForm from the context
      mutationResult.data && setOrderForm(mutationResult.data.addToCart)
    },
    [addToCart, orderForm, setOrderForm]
  )

  const updateQuantity = useCallback(
    async (props: Partial<Item>) => {
      const { index, uniqueId } = itemIds(props)
      updateOrderForm(index, { quantity: props.quantity })
      const taskId = 'OrderItems-updateQuantity'
      let items = [{ uniqueId, quantity: props.quantity }]

      if (lastUpdateTaskRef.current.promise && isWaiting(taskId)) {
        lastUpdateTaskRef.current.promise.cancel()
        items = [
          ...lastUpdateTaskRef.current.variables.filter(
            (item: Pick<Item, 'uniqueId'>) => item.uniqueId !== uniqueId
          ),
          ...items,
        ]
      }

      lastUpdateTaskRef.current.promise = enqueueTask({
        task: mutationTask(items),
        enqueue,
        queueStatusRef,
        setOrderForm,
        taskId,
      })
      lastUpdateTaskRef.current.variables = items
    },
    [
      enqueue,
      isWaiting,
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

  const value = useMemo(
    () =>
      loading
        ? {
            updateQuantity: noop,
            removeItem: noop,
            addItem: noop,
          }
        : { addItem, updateQuantity, removeItem },
    [loading, addItem, updateQuantity, removeItem]
  )

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
