import React, { FC, useCallback, useMemo, useRef, useEffect } from 'react'
import { OrderForm } from 'vtex.order-manager'
import { Item } from 'vtex.checkout-graphql'

import {
  LocalOrderTaskType,
  getLocalOrderQueue,
  pushLocalOrderQueue,
} from './modules/localOrderQueue'
import {
  mapForItemInput,
  mapItemInputToOrderFormItem,
  AVAILABLE,
} from './utils'
import { OrderItemsContext, useOrderItems } from './modules/OrderItemsContext'
import { useEnqueueTask } from './modules/useEnqueueTask'
import { useAddItemsTask } from './modules/useAddItemsTask'
import { useUpdateItemsTask } from './modules/useUpdateItemsTask'
import { useFakeUniqueIdMap } from './modules/useFakeUniqueIdMap'

const { useOrderForm } = OrderForm

const enum Totalizers {
  SUBTOTAL = 'Items',
  DISCOUNT = 'Discounts',
}

const updateTotalizersAndValue = ({
  totalizers,
  currentValue = 0,
  newItem,
  oldItem,
}: {
  totalizers: Totalizer[]
  currentValue?: number
  newItem: Item
  oldItem?: Item
}) => {
  if (oldItem?.availability !== AVAILABLE) {
    return { totalizers, value: currentValue }
  }

  const oldItemPrice = (oldItem.price ?? 0) * (oldItem.unitMultiplier ?? 1)
  const oldItemQuantity = oldItem.quantity ?? 0
  const oldItemSellingPrice = oldItem.sellingPrice ?? 0

  const oldPrice = oldItemPrice * oldItemQuantity
  const newItemPrice = newItem.price! * (newItem.unitMultiplier ?? 1)
  const newPrice = newItemPrice * newItem.quantity
  const subtotalDifference = newPrice - oldPrice

  const oldDiscount = (oldItemSellingPrice - oldItemPrice) * oldItemQuantity
  const newDiscount = (newItem.sellingPrice! - newItemPrice) * newItem.quantity
  const discountDifference = newDiscount - oldDiscount

  const updatedValue = currentValue + subtotalDifference + discountDifference

  if (!totalizers.length) {
    return {
      totalizers: [
        {
          id: Totalizers.SUBTOTAL,
          name: 'Items Total',
          value: subtotalDifference,
        },
        {
          id: Totalizers.DISCOUNT,
          name: 'Discounts Total',
          value: discountDifference,
        },
      ],
      value: updatedValue,
    }
  }

  const newTotalizers = totalizers.map((totalizer) => {
    switch (totalizer.id) {
      case Totalizers.SUBTOTAL:
        return {
          ...totalizer,
          value: totalizer.value + subtotalDifference,
        }

      case Totalizers.DISCOUNT:
        return {
          ...totalizer,
          value: totalizer.value + discountDifference,
        }

      default:
        return totalizer
    }
  })

  return {
    totalizers: newTotalizers,
    value: updatedValue,
  }
}

const findExistingItem = (input: Partial<CatalogItem>, items: Item[]) => {
  // console.log({ input, items })
  const idSet = new Set(items.map((i) => i.id))

  return items.find((item: Item) => {
    // console.log({ item })
    const isSameId = input.id?.toString() === item.id
    // todo: const isSameSeller = input.seller === item

    if (input.options == null) {
      if (input.options !== item.options) {
        return false
      }

      return isSameId
    }

    const optionsExistInCart = input.options.every((opItem) =>
      idSet.has(opItem.id)
    )

    return isSameId && optionsExistInCart
  })
}

export const OrderItemsProvider: FC = ({ children }) => {
  const { orderForm, setOrderForm } = useOrderForm()

  const fakeUniqueIdMapRef = useFakeUniqueIdMap()

  const enqueueTask = useEnqueueTask()
  const addItemsTask = useAddItemsTask(fakeUniqueIdMapRef)
  const updateItemsTask = useUpdateItemsTask(fakeUniqueIdMapRef)

  const orderFormItemsRef = useRef(orderForm.items)

  useEffect(() => {
    orderFormItemsRef.current = orderForm.items
  }, [orderForm.items])

  /**
   * Add the items to the order form.
   *
   * Returns if the items were added or not.
   */
  const addItem = useCallback(
    (
      items: Array<Partial<CatalogItem>>,
      marketingData?: Partial<MarketingData>
    ) => {
      // console.log({ items })
      const updatedItems = items.map((item) => {
        const existingItem = findExistingItem(item, orderFormItemsRef.current)

        // console.log({ item, existingItem })

        if (existingItem == null) return item

        return {
          ...item,
          id: item.id ?? '0',
          quantity: (item.quantity ?? 1) + existingItem.quantity,
        }
      })

      const mutationInputItems = updatedItems.map(mapForItemInput)
      const orderFormItems = updatedItems.map(mapItemInputToOrderFormItem)

      // console.log({ orderFormItems, mutationInputItems })

      if (orderFormItems.length === 0) {
        return false
      }

      setOrderForm((prevOrderForm) => ({
        ...prevOrderForm,
        items: [...orderFormItemsRef.current, ...orderFormItems],
        totalizers: orderFormItems.reduce(
          (totalizers: Totalizer[], item: Item): Totalizer[] => {
            return updateTotalizersAndValue({ totalizers, newItem: item })
              .totalizers
          },
          (prevOrderForm.totalizers as Totalizer[]) ?? []
        ),
        marketingData: marketingData ?? prevOrderForm.marketingData,
        value:
          prevOrderForm.value +
          orderFormItems.reduce(
            (total, item) => total + item.sellingPrice! * item.quantity,
            0
          ),
      }))

      pushLocalOrderQueue({
        type: LocalOrderTaskType.ADD_MUTATION,
        variables: {
          items: mutationInputItems,
          marketingData,
        },
        orderFormItems,
      })

      enqueueTask(
        addItemsTask({
          mutationInputItems,
          mutationInputMarketingData: marketingData,
          orderFormItems,
        })
      )

      return true
    },
    [addItemsTask, enqueueTask, setOrderForm]
  )

  const updateQuantity = useCallback(
    (input) => {
      let index: number
      let uniqueId = ''

      const currentOrderFormItems = orderFormItemsRef.current

      if (input.id) {
        index = currentOrderFormItems.findIndex(
          (orderItem: any) => orderItem.id === input.id
        )
      } else if ('uniqueId' in input) {
        uniqueId = input.uniqueId
        index = currentOrderFormItems.findIndex(
          (orderItem: any) => orderItem.uniqueId === input.uniqueId
        )
      } else {
        index = input.index ?? -1
      }

      if (index < 0 || index >= currentOrderFormItems.length) {
        throw new Error(`Item ${input.id || input.uniqueId} not found`)
      }

      if (!uniqueId) {
        uniqueId = currentOrderFormItems[index].uniqueId
      }

      const quantity = input.quantity ?? 1

      setOrderForm((prevOrderForm) => {
        const updatedItems = prevOrderForm.items.slice()

        const oldItem = updatedItems[index]
        const newItem = {
          ...oldItem,
          quantity,
        }

        if (quantity > 0) {
          updatedItems[index] = newItem
        } else {
          updatedItems.splice(index, 1)
        }

        return {
          ...prevOrderForm,
          ...updateTotalizersAndValue({
            totalizers: prevOrderForm.totalizers as Totalizer[],
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
        orderFormItems: currentOrderFormItems,
      })

      enqueueTask(
        updateItemsTask({
          items: mutationVariables.orderItems,
          orderFormItems: currentOrderFormItems,
        })
      )
    },
    [enqueueTask, setOrderForm, updateItemsTask]
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

    localOrderQueue.queue.forEach((task) => {
      if (task.type === LocalOrderTaskType.ADD_MUTATION) {
        enqueueTask(
          addItemsTask({
            mutationInputItems: task.variables.items,
            mutationInputMarketingData: task.variables.marketingData,
            orderFormItems: task.orderFormItems,
          })
        )
      } else if (task.type === LocalOrderTaskType.UPDATE_MUTATION) {
        enqueueTask(
          updateItemsTask({
            items: task.variables.orderItems,
            orderFormItems: task.orderFormItems,
          })
        )
      }
    })
  }, [addItemsTask, enqueueTask, updateItemsTask])

  return (
    <OrderItemsContext.Provider value={value}>
      {children}
    </OrderItemsContext.Provider>
  )
}

export default { OrderItemsProvider, useOrderItems }
