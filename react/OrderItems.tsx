import { useCallback } from 'react'
import { useMutation } from 'react-apollo'
import UpdateItems from 'vtex.checkout-resources/MutationUpdateItems'
import AddToCart from 'vtex.checkout-resources/MutationAddToCart'
import SetManualPrice from 'vtex.checkout-resources/MutationSetManualPrice'
import {
  UpdateItemsMutationVariables,
  SetManualPriceMutationVariables,
  AddToCartMutationVariables,
} from 'vtex.checkout-resources'
import type { OrderForm } from 'vtex.checkout-graphql'
import { OrderForm as OrderManager, OrderQueue } from 'vtex.order-manager'
import { useSplunk } from 'vtex.checkout-splunk'
import { useOrderItems, createOrderItemsProvider } from '@vtex/order-items'

const { useOrderForm } = OrderManager
const { useOrderQueue, useQueueStatus } = OrderQueue

function useLogger() {
  const { logSplunk } = useSplunk()

  const log = useCallback(
    ({ type, level, event, workflowType, workflowInstance }) => {
      logSplunk({ type, level, event, workflowType, workflowInstance })
    },
    [logSplunk]
  )

  return { log }
}

interface SetManualPrice {
  setManualPrice: OrderForm
}

interface UpdateItemsMutation {
  updateItems: OrderForm
}

function useMutateAddItems() {
  const [mutateAddItem] = useMutation<
    { addToCart: OrderForm },
    AddToCartMutationVariables
  >(AddToCart)

  return useCallback(
    (variables: AddToCartMutationVariables) => {
      return mutateAddItem({ variables }).then(({ data, errors }) => {
        return { data: data?.addToCart, errors }
      })
    },
    [mutateAddItem]
  )
}

function useMutateUpdateQuantity() {
  const [mutateUpdateQuantity] = useMutation<
    UpdateItemsMutation,
    UpdateItemsMutationVariables
  >(UpdateItems)

  return useCallback(
    (variables: UpdateItemsMutationVariables) => {
      return mutateUpdateQuantity({ variables }).then(({ data, errors }) => {
        return { data: data?.updateItems, errors }
      })
    },
    [mutateUpdateQuantity]
  )
}

function useMutateSetManualPrice() {
  const [mutateSetManualPrice] = useMutation<
    SetManualPrice,
    SetManualPriceMutationVariables
  >(SetManualPrice)

  return useCallback(
    ({ itemIndex, price }: { itemIndex: number; price: number }) => {
      return mutateSetManualPrice({
        variables: { manualPriceInput: { price, itemIndex } },
      }).then(({ data, errors }) => {
        return { data: data?.setManualPrice, errors }
      })
    },
    [mutateSetManualPrice]
  )
}

const { OrderItemsProvider } = createOrderItemsProvider<OrderForm>({
  useOrderForm,
  useOrderQueue,
  useQueueStatus,
  useLogger,
  useMutateAddItems,
  useMutateSetManualPrice,
  useMutateUpdateQuantity,
})

export { useOrderItems, OrderItemsProvider }
export default { useOrderItems, OrderItemsProvider }
