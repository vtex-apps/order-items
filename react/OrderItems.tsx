import type { FC } from 'react'
import React, { useCallback, useMemo, useRef, useEffect } from 'react'
import { useMutation } from 'react-apollo'
import UpdateItems from 'vtex.checkout-resources/MutationUpdateItems'
import AddToCart from 'vtex.checkout-resources/MutationAddToCart'
import SetManualPrice from 'vtex.checkout-resources/MutationSetManualPrice'
import { OrderForm, OrderQueue, constants } from 'vtex.order-manager'
import type { Item, AssemblyOptionInput } from 'vtex.checkout-graphql'
import { useSplunk } from 'vtex.checkout-splunk'
import * as uuid from 'uuid'

import { OrderItemsContext, useOrderItems } from './modules/OrderItemsContext'
import type { UpdateQuantityInput } from './modules/localOrderQueue'
import {
  LocalOrderTaskType,
  getLocalOrderQueue,
  popLocalOrderQueue,
  pushLocalOrderQueue,
  updateLocalQueueItemIds,
} from './modules/localOrderQueue'
import {
  adjustForItemInput,
  mapToOrderFormItem,
  AVAILABLE,
  filterUndefined,
} from './utils'

const { useOrderForm } = OrderForm
const { useOrderQueue, useQueueStatus, QueueStatus } = OrderQueue

// eslint-disable-next-line no-shadow
const enum Totalizers {
  SUBTOTAL = 'Items',
  DISCOUNT = 'Discounts',
}

const isSameItem = (
  input: Partial<CatalogItem> | Item | OrderFormItemInput,
  item: Item,
  items: Array<Item | Partial<CatalogItem>>
) => {
  const isSameId = input.id?.toString() === item.id
  const isSameSeller = input.seller === item.seller

  // input has no options
  if (input.options == null) {
    // and the comparing item has, not the same item
    if (item.options?.length) {
      return false
    }

    // neither have options, just compare id and seller
    return isSameId && isSameSeller
  }

  // does every option (assuming assembly option) existing in the cart as separate products?
  const optionsExistInCart = (input.options as AssemblyOptionInput[]).every(
    (opItem) => items.find((i) => i.id === opItem.id)
  )

  return isSameId && isSameSeller && optionsExistInCart
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

interface Task {
  execute: () => Promise<OrderForm>
  rollback?: () => void
  id?: string
}

const useEnqueueTask = () => {
  const { logSplunk } = useSplunk()
  const { enqueue, listen } = useOrderQueue()
  const queueStatusRef = useQueueStatus(listen)
  const { setOrderForm } = useOrderForm()

  const enqueueTask = useCallback<(task: Task) => PromiseLike<void>>(
    (task) =>
      enqueue(task.execute, task.id).then(
        (orderForm: OrderForm) => {
          popLocalOrderQueue()
          if (queueStatusRef.current === QueueStatus.FULFILLED) {
            setOrderForm(orderForm)
          } else {
            setOrderForm((prevOrderForm) => ({
              ...prevOrderForm,
              messages: {
                ...orderForm.messages,
              },
            }))
          }
        },
        (error: any) => {
          if (error && error.code === constants.TASK_CANCELLED_CODE) {
            popLocalOrderQueue(error.index)

            return
          }

          popLocalOrderQueue()

          logSplunk({
            type: 'Error',
            level: 'Critical',
            event: error,
            workflowType: 'OrderItems',
            workflowInstance: 'enqueue-task-error',
          })

          throw error
        }
      ),
    [enqueue, queueStatusRef, setOrderForm, logSplunk]
  )

  return enqueueTask
}

const useAddItemsTask = (
  fakeUniqueIdMapRef: React.MutableRefObject<FakeUniqueIdMap>
) => {
  const [mutateAddItem] = useMutation<
    { addToCart: OrderForm },
    { items: OrderFormItemInput[]; marketingData?: Partial<MarketingData> }
  >(AddToCart)

  const { logSplunk } = useSplunk()
  const { setOrderForm } = useOrderForm()

  const addItemTask = useCallback(
    ({
      mutationInputItems,
      mutationInputMarketingData,
      orderFormItems,
    }: {
      mutationInputItems: OrderFormItemInput[]
      mutationInputMarketingData?: Partial<MarketingData>
      orderFormItems: Item[]
    }) => ({
      execute: async () => {
        const { data, errors } = await mutateAddItem({
          variables: {
            items: mutationInputItems,
            marketingData: mutationInputMarketingData,
          },
        })

        if (!data || (errors?.length ?? 0) > 0) {
          logSplunk({
            type: 'Error',
            level: 'Critical',
            workflowType: 'OrderItems',
            workflowInstance: 'add-items-mutation',
            event: (errors?.[0].originalError as any) ?? {},
          })

          throw errors?.[0] as Error
        }

        const updatedOrderForm = data.addToCart

        // update the uniqueId of the items that were
        // added locally with the value from the server
        orderFormItems.forEach((orderFormItem) => {
          const updatedItem = updatedOrderForm.items.find(
            (updatedOrderFormItem) =>
              updatedOrderFormItem.id === orderFormItem.id
          )

          if (!updatedItem) {
            // the item wasn't added to the cart. the reason for this
            // may vary, but could be something like the item doesn't
            // have stock left, etc.
            return
          }

          const fakeUniqueId = orderFormItem.uniqueId

          // update all mutations in the queue that referenced
          // this item with it's fake `uniqueId`
          updateLocalQueueItemIds({
            fakeUniqueId,
            uniqueId: updatedItem.uniqueId,
          })
          fakeUniqueIdMapRef.current[fakeUniqueId] = updatedItem.uniqueId
        })

        // update the `uniqueId` in the remaining items on local orderForm
        setOrderForm((prevOrderForm) => {
          return {
            ...prevOrderForm,
            items: prevOrderForm.items
              .map((item) => {
                const inputIndex = mutationInputItems.findIndex((inputItem) =>
                  isSameItem(inputItem, item, prevOrderForm.items)
                )

                if (inputIndex === -1) {
                  // this item wasn't part of the initial mutation, skip it
                  return item
                }

                const updatedItem = updatedOrderForm.items.find(
                  (updatedOrderFormItem) => updatedOrderFormItem.id === item.id
                )

                if (!updatedItem) {
                  // item was not added to the cart
                  return null
                }

                return {
                  ...item,
                  uniqueId: updatedItem.uniqueId,
                }
              })
              .filter((item): item is Item => item != null),
            marketingData:
              mutationInputMarketingData ?? prevOrderForm.marketingData,
          }
        })

        return updatedOrderForm
      },
      rollback: () => {
        setOrderForm((prevOrderForm) => {
          const itemIds = mutationInputItems.map(({ id }) => id!.toString())

          return {
            ...prevOrderForm,
            items: prevOrderForm.items.filter((orderFormItem) => {
              return !itemIds.includes(orderFormItem.id)
            }),
          }
        })
      },
    }),
    [fakeUniqueIdMapRef, mutateAddItem, setOrderForm, logSplunk]
  )

  return addItemTask
}

const useSetManualPrice = () => {
  const [mutateSetManualPrice] = useMutation<SetManualPrice>(SetManualPrice)

  const setManualPriceTask = useCallback(
    (price: number, itemIndex: number) => {
      return {
        execute: async () => {
          const { data } = await mutateSetManualPrice({
            variables: { manualPriceInput: { itemIndex, price } },
          })

          return data!.setManualPrice
        },
      }
    },
    [mutateSetManualPrice]
  )

  return setManualPriceTask
}

const useUpdateItemsTask = (
  fakeUniqueIdMapRef: React.MutableRefObject<FakeUniqueIdMap>
) => {
  const [mutateUpdateQuantity] = useMutation<UpdateItemsMutation>(UpdateItems)
  const { setOrderForm } = useOrderForm()
  const { logSplunk } = useSplunk()

  const updateItemTask = useCallback(
    ({
      items,
      orderFormItems,
      id,
    }: {
      items: UpdateQuantityInput[]
      orderFormItems: Item[]
      id: string
    }) => {
      return {
        id,
        execute: async () => {
          const mutationVariables = {
            orderItems: items.map((input) => {
              if ('uniqueId' in input) {
                // here we need to update the uniqueId again in the mutation
                // because it may have been a "fake" `uniqueId` that were generated
                // locally so we could manage the items when offline.
                //
                // so, we will read the value using the `fakeUniqueIdMapRef` because
                // it maps a fake `uniqueId` to a real `uniqueId` that was generated by
                // the API. if it doesn't contain the value, we will assume that this uniqueId
                // is a real one.
                const uniqueId =
                  fakeUniqueIdMapRef.current[input.uniqueId] || input.uniqueId

                return { uniqueId, quantity: input.quantity }
              }

              return input
            }),
          }

          const { data, errors } = await mutateUpdateQuantity({
            variables: mutationVariables,
          })

          if (!data || (errors?.length ?? 0) > 0) {
            logSplunk({
              type: 'Error',
              level: 'Critical',
              workflowType: 'OrderItems',
              workflowInstance: 'update-items-mutation',
              event: (errors?.[0].originalError as any) ?? {},
            })

            throw errors?.[0] as Error
          }

          return data.updateItems
        },
        rollback: () => {
          const deletedItemsInput = items.filter(
            ({ quantity }) => quantity === 0
          )

          const updatedItemsInput = items.filter(
            ({ quantity }) => quantity !== 0
          )

          const deletedItems = deletedItemsInput
            .map((input) => {
              return orderFormItems.find((orderFormItem, itemIndex) =>
                'uniqueId' in input
                  ? orderFormItem.uniqueId === input.uniqueId
                  : input.index === itemIndex
              )
            })
            .filter(filterUndefined)

          setOrderForm((prevOrderForm) => {
            return {
              ...prevOrderForm,
              items: prevOrderForm.items
                .map((orderFormItem) => {
                  const updatedIndex = updatedItemsInput.findIndex(
                    (item, itemIndex) =>
                      'uniqueId' in item
                        ? orderFormItem.uniqueId === item.uniqueId
                        : itemIndex === item.index
                  )

                  if (updatedIndex !== -1) {
                    const updatedItemInput = updatedItemsInput[updatedIndex]

                    const previousItem = orderFormItems.find(
                      (prevOrderFormItem, prevOrderFormItemIndex) =>
                        'uniqueId' in updatedItemInput
                          ? prevOrderFormItem.uniqueId ===
                            updatedItemInput.uniqueId
                          : prevOrderFormItemIndex === updatedItemInput.index
                    )

                    return {
                      ...orderFormItem,
                      quantity: previousItem!.quantity,
                    }
                  }

                  return orderFormItem
                })
                .concat(deletedItems),
            }
          })
        },
      }
    },
    [fakeUniqueIdMapRef, mutateUpdateQuantity, setOrderForm, logSplunk]
  )

  return updateItemTask
}

interface FakeUniqueIdMap {
  [fakeUniqueId: string]: string
}

const useFakeUniqueIdMap = () => {
  const fakeUniqueIdMapRef = useRef<FakeUniqueIdMap>({})
  const { listen } = useOrderQueue()

  useEffect(
    () =>
      listen(QueueStatus.FULFILLED, () => {
        // avoid leaking "fake" `uniqueId`.
        // this works because everytime we fulfill the queue, we know
        // for sure that we won't have any locally generated uniqueId's
        // left to map to a real uniqueId.
        fakeUniqueIdMapRef.current = {}
      }),
    [listen]
  )

  return fakeUniqueIdMapRef
}

interface SetManualPrice {
  setManualPrice: OrderForm
}

interface UpdateItemsMutation {
  updateItems: OrderForm
}
const OrderItemsProvider: FC = ({ children }) => {
  const { orderForm, setOrderForm } = useOrderForm()

  const fakeUniqueIdMapRef = useFakeUniqueIdMap()

  const enqueueTask = useEnqueueTask()
  const addItemsTask = useAddItemsTask(fakeUniqueIdMapRef)
  const updateItemsTask = useUpdateItemsTask(fakeUniqueIdMapRef)
  const setManualPriceTask = useSetManualPrice()

  const orderFormItemsRef = useRef(orderForm.items)

  useEffect(() => {
    orderFormItemsRef.current = orderForm.items
  }, [orderForm.items])

  const updateQuantity = useCallback(
    (input) => {
      let index: number
      let uniqueId = ''

      const currentOrderFormItems = orderFormItemsRef.current

      if (input.id) {
        index = currentOrderFormItems.findIndex((orderItem) =>
          isSameItem(input, orderItem, currentOrderFormItems)
        )
      } else if ('uniqueId' in input) {
        uniqueId = input.uniqueId
        index = currentOrderFormItems.findIndex(
          (orderItem) => orderItem.uniqueId === input.uniqueId
        )
      } else {
        index = input?.index ?? -1
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

      let mutationVariables
      let id = uuid.v4()

      if (quantity > 0) {
        const localQueue = getLocalOrderQueue().queue

        let previousTaskIndex = -1
        const originalId = id

        // Skip the first element in the queue (which is currently being executed)
        // because we can't cancel an in-progress task.
        for (let i = 1; i < localQueue.length; i++) {
          const task = localQueue[i]

          if (
            task.type === LocalOrderTaskType.UPDATE_MUTATION &&
            task.variables.orderItems.every(
              (itemInput) => itemInput.quantity > 0
            )
          ) {
            // If we find an update-only mutation (without removed items)
            // we will re-use it's id so we minimize the number of updates
            // to send to the API
            previousTaskIndex = i
            id = task.id!
          } else {
            // If we find any other kind of request we need to reset our
            // `previousTaskIndex` and `id` because we can't rely on the indexes
            // of the operations done before this task. For example, assume the
            // following cart:
            //
            //   [{ id: 1, quantity: 2 }, { id: 2, quantity: 3 }, { id: 3, quantity: 1 }]
            //
            // If we update the second item's quantity to 1, then remove the first
            // item and update the third item quantity to 2, we can't "join" the first
            // and last updates, because the indexes will have been shifted due to
            // the second item being removed (and the API rely on the index of the items,
            // even though we send the unique id). The same could happen if we add one
            // item  and the cart isn't using the default "add_time" sort algorithm.
            previousTaskIndex = -1
            id = originalId
          }
        }

        const previousTask = localQueue[previousTaskIndex]

        const previousTaskItems =
          previousTask?.type === LocalOrderTaskType.UPDATE_MUTATION
            ? previousTask.variables.orderItems
            : []

        const itemIndexInPreviousTask = previousTaskItems.findIndex(
          (prevInput) =>
            'uniqueId' in prevInput
              ? prevInput.uniqueId === uniqueId
              : prevInput.index === index
        )

        mutationVariables = {
          orderItems:
            itemIndexInPreviousTask > -1
              ? previousTaskItems.map((prevInput, prevInputIndex) =>
                  prevInputIndex === itemIndexInPreviousTask
                    ? { uniqueId, quantity }
                    : prevInput
                )
              : previousTaskItems.concat([{ uniqueId, quantity }]),
        }
      } else {
        mutationVariables = { orderItems: [{ uniqueId, quantity }] }
      }

      pushLocalOrderQueue({
        id,
        type: LocalOrderTaskType.UPDATE_MUTATION,
        variables: mutationVariables,
        orderFormItems: currentOrderFormItems,
      })

      enqueueTask(
        updateItemsTask({
          items: mutationVariables.orderItems,
          orderFormItems: currentOrderFormItems,
          id,
        })
      )
    },
    [enqueueTask, setOrderForm, updateItemsTask]
  )

  /**
   * Add the items to the order form.
   * In case of an item already in the cart, it increments its quantity.
   */
  const addItem = useCallback(
    (
      items: Array<Partial<CatalogItem>>,
      marketingData?: Partial<MarketingData>
    ) => {
      const { newItems, updatedItems } = items.reduce<
        Record<string, Array<Partial<CatalogItem>>>
      >(
        (acc, item) => {
          const { newItems: newList, updatedItems: updateList } = acc

          // assembly items are always different
          const isAssemblyItem = item.options && item.options.length > 0

          const existingItem = isAssemblyItem
            ? undefined
            : orderFormItemsRef.current.find((i) => isSameItem(item, i, items))

          if (existingItem == null) {
            newList.push(item)
          } else {
            updateList.push({
              ...item,
              quantity: (item.quantity ?? 1) + existingItem!.quantity,
            })
          }

          return acc
        },
        { newItems: [], updatedItems: [] }
      )

      if (updatedItems.length) {
        updatedItems.forEach((item) => updateQuantity(item))
      }

      if (newItems.length === 0) {
        return
      }

      const mutationInputItems = newItems.map(adjustForItemInput)
      const orderFormItems = newItems.map((cartItem, index) =>
        mapToOrderFormItem(mutationInputItems[index], cartItem)
      )

      setOrderForm((prevOrderForm) => {
        return {
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
        }
      })

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
    },
    [addItemsTask, enqueueTask, setOrderForm, updateQuantity]
  )

  const setManualPrice = useCallback(
    (price: number, itemIndex: number) => {
      enqueueTask(setManualPriceTask(price, itemIndex))
    },
    [enqueueTask, setManualPriceTask]
  )

  const removeItem = useCallback(
    (props: Partial<Item>) => updateQuantity({ ...props, quantity: 0 }),
    [updateQuantity]
  )

  const value = useMemo(
    () => ({ addItem, updateQuantity, removeItem, setManualPrice }),
    [addItem, updateQuantity, removeItem, setManualPrice]
  )

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
            id: task.id!,
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

export { OrderItemsProvider, useOrderItems }
export default { OrderItemsProvider, useOrderItems }
