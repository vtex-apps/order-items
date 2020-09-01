import React, { useCallback } from 'react'
import { useMutation } from 'react-apollo'
import AddToCart from 'vtex.checkout-resources/MutationAddToCart'
import { OrderForm } from 'vtex.order-manager'
import { Item } from 'vtex.checkout-graphql'

import { updateLocalQueueItemIds } from './localOrderQueue'

const { useOrderForm } = OrderForm

export const useAddItemsTask = (
  fakeUniqueIdMapRef: React.MutableRefObject<FakeUniqueIdMap>
) => {
  const [mutateAddItem] = useMutation<
    { addToCart: OrderForm },
    { items: OrderFormItemInput[]; marketingData?: Partial<MarketingData> }
  >(AddToCart)

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
        const { data } = await mutateAddItem({
          variables: {
            items: mutationInputItems,
            marketingData: mutationInputMarketingData,
          },
        })

        const updatedOrderForm = data!.addToCart

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
                const inputIndex = mutationInputItems.findIndex(
                  (inputItem) => inputItem.id === +item.id
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
    [fakeUniqueIdMapRef, mutateAddItem, setOrderForm]
  )

  return addItemTask
}
