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
import {
  useOrderItems as useBaseOrderItems,
  createOrderItemsProvider,
} from '@vtex/order-items'

const { useOrderForm } = OrderManager
const { useOrderQueue, useQueueStatus } = OrderQueue

/**
 * `adjustForItemInput` in `@vtex/order-items` whitelists the fields it forwards
 * to the mutation, so `priceToken` (signed price, Pricing Fallback V2) is
 * dropped before it reaches checkout. Until the field ships upstream, the token
 * is stashed when the caller adds the item and re-attached to the mutation
 * variables. Keyed by SKU + seller, which is what identifies an offer.
 */
const priceTokenByOffer = new Map<string, string>()

const offerKey = (id?: string | number | null, seller?: string | null) =>
  `${id ?? ''}::${seller ?? ''}`

type OfferWithPriceToken = {
  id?: string | number | null
  seller?: string | null
  priceToken?: string | null
}

function stashPriceTokens(items: OfferWithPriceToken[]) {
  items.forEach((item) => {
    if (item?.priceToken) {
      priceTokenByOffer.set(offerKey(item.id, item.seller), item.priceToken)
    }
  })
}

function withPriceTokens(variables: AddToCartMutationVariables) {
  if (priceTokenByOffer.size === 0) {
    return variables
  }

  const items = ((variables.items ?? []) as OfferWithPriceToken[]).map(
    (item) => {
      const priceToken = priceTokenByOffer.get(offerKey(item?.id, item?.seller))

      return priceToken ? { ...item, priceToken } : item
    }
  )

  return { ...variables, items } as AddToCartMutationVariables
}

function useOrderItems() {
  const orderItems = useBaseOrderItems()
  const { addItems } = orderItems

  const addItemsWithPriceToken = useCallback<typeof addItems>(
    (items, options) => {
      stashPriceTokens(items as OfferWithPriceToken[])

      return addItems(items, options)
    },
    [addItems]
  )

  return { ...orderItems, addItems: addItemsWithPriceToken }
}

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
      return mutateAddItem({ variables: withPriceTokens(variables) }).then(
        ({ data, errors }) => {
          return { data: data?.addToCart, errors }
        }
      )
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
