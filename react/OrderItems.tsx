import { useCallback } from 'react'
import { useMutation } from 'react-apollo'
import UpdateItems from 'vtex.checkout-resources/MutationUpdateItems'
import AddToCart from 'vtex.checkout-resources/MutationAddToCart'
import SetManualPrice from 'vtex.checkout-resources/MutationSetManualPrice'
import { OrderForm, OrderQueue } from 'vtex.order-manager'
import { createOrderItemsProvider } from '@vtex/order-items'

const { useOrderForm } = OrderForm
const { useOrderQueue, useQueueStatus } = OrderQueue

function useMutateAddItems() {
  const [mutate] = useMutation(AddToCart)

  return useCallback(
    async (input) => {
      const { data } = await mutate({ variables: input })

      return { data: data.addToCart }
    },
    [mutate]
  )
}

function useLogger() {
  const log = useCallback(() => {}, [])

  return { log }
}

function useMutateSetManualPrice() {
  const [mutate] = useMutation(SetManualPrice)

  return useCallback(
    async (input) => {
      const { data } = await mutate({ variables: input })

      return { data: data.setManualPrice }
    },
    [mutate]
  )
}

function useMutateUpdateQuantity() {
  const [mutate] = useMutation(UpdateItems)

  return useCallback(
    async (input) => {
      const { data } = await mutate({ variables: input })

      return { data: data.updateItems }
    },
    [mutate]
  )
}

const { OrderItemsProvider, useOrderItems } = createOrderItemsProvider({
  useMutateUpdateQuantity,
  useMutateSetManualPrice,
  useMutateAddItems,
  useOrderForm,
  useLogger,
  useOrderQueue,
  useQueueStatus,
})

export { OrderItemsProvider, useOrderItems }
export default { OrderItemsProvider, useOrderItems }
