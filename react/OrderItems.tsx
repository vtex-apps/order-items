import type { ReactNode } from 'react'
import React, { createContext, useCallback, useContext, useRef } from 'react'
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
  isSameItem,
} from '@vtex/order-items'

const { useOrderForm } = OrderManager
const { useOrderQueue, useQueueStatus } = OrderQueue

/**
 * `adjustForItemInput` in `@vtex/order-items` whitelists the fields it forwards
 * to the mutation, so `priceToken` (signed price, Pricing Fallback V2) is
 * dropped before it reaches checkout. Until the field ships upstream, the token
 * is stashed when the caller adds the item and re-attached to the mutation
 * variables. Keyed by SKU + seller, which is what identifies an offer.
 *
 * Tokens are queued per key (FIFO) rather than held one at a time, so two
 * adds for the same offer — racing, or batched together with different
 * tokens — each get the token they were stashed with instead of one
 * overwriting or resurrecting the other. The queue itself lives in a context
 * scoped to one `OrderItemsProvider` instance, not a module-level singleton,
 * so unrelated mounts (e.g. minicart + checkout) never share offers.
 *
 * Two things the queue alone doesn't cover:
 *
 * - Only items that resolve to a brand-new cart line reach `withPriceTokens`
 *   — an item matching one already in the cart is routed by the base library
 *   to `updateQuantity` instead, which never sees this cache. A token stashed
 *   for that item would sit unconsumed and leak onto a later, unrelated add
 *   for the same key. `stashPriceTokens` mirrors the library's own new-vs-
 *   existing check (`isSameItem`) so those tokens are never queued at all.
 * - `@vtex/order-manager`'s `TaskQueue` replays a task's mutation call as-is
 *   if it fails while offline, so the same `variables.items` can reach
 *   `withPriceTokens` more than once for one logical add. Reading is
 *   therefore non-destructive (peek by position, not `shift`); the matching
 *   entries are only removed once the mutation actually resolves, via
 *   `onSuccess`, so a retry still finds its token. A permanently failed
 *   (non-offline) send is the one case that still orphans its entry — same
 *   residual accepted for the module-global version of this cache.
 */
type PriceTokenCache = Map<string, string[]>

const PriceTokenCacheContext = createContext<PriceTokenCache | null>(null)

function usePriceTokenCache() {
  const cache = useContext(PriceTokenCacheContext)

  if (!cache) {
    throw new Error('usePriceTokenCache must be used within OrderItemsProvider')
  }

  return cache
}

function PriceTokenCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<PriceTokenCache | null>(null)

  if (!cacheRef.current) {
    cacheRef.current = new Map()
  }

  return (
    <PriceTokenCacheContext.Provider value={cacheRef.current}>
      {children}
    </PriceTokenCacheContext.Provider>
  )
}

const offerKey = (id?: string | number | null, seller?: string | null) =>
  `${id ?? ''}::${seller ?? ''}`

type OfferWithPriceToken = {
  id?: string | number | null
  seller?: string | null
  options?: unknown[] | null
  priceToken?: string | null
}

function stashPriceTokens(
  cache: PriceTokenCache,
  items: OfferWithPriceToken[],
  existingOrderFormItems: Array<{ id: string; seller: string }>
) {
  items.forEach((item) => {
    if (!item?.priceToken) {
      return
    }

    const isAssemblyItem = (item.options?.length ?? 0) > 0
    const matchesExistingItem =
      !isAssemblyItem &&
      existingOrderFormItems.some((orderFormItem) =>
        isSameItem(item as any, orderFormItem as any, items as any)
      )

    // An item matching one already in the cart is routed to `updateQuantity`
    // by the base library, not `addToCart` — it will never reach
    // `withPriceTokens`, so stashing its token here would only leak it onto
    // a later, unrelated add for this key.
    if (matchesExistingItem) {
      return
    }

    const key = offerKey(item.id, item.seller)
    const queue = cache.get(key)

    if (queue) {
      queue.push(item.priceToken)
    } else {
      cache.set(key, [item.priceToken])
    }
  })
}

function withPriceTokens(
  cache: PriceTokenCache,
  variables: AddToCartMutationVariables
) {
  if (cache.size === 0) {
    return { variables, onSuccess: () => {} }
  }

  const occurrences = new Map<string, number>()

  const items = ((variables.items ?? []) as OfferWithPriceToken[]).map(
    (item) => {
      const key = offerKey(item?.id, item?.seller)
      const occurrence = occurrences.get(key) ?? 0

      occurrences.set(key, occurrence + 1)

      const priceToken = cache.get(key)?.[occurrence]

      return priceToken ? { ...item, priceToken } : item
    }
  )

  // Consuming entries is deferred until the mutation actually resolves —
  // `TaskQueue` retries a failed-while-offline task by calling this again
  // with the same `variables`, so peeking above must stay non-destructive,
  // or a retry would find its own token already gone.
  const onSuccess = () => {
    occurrences.forEach((count, key) => {
      const queue = cache.get(key)

      if (!queue) {
        return
      }

      queue.splice(0, count)

      if (queue.length === 0) {
        cache.delete(key)
      }
    })
  }

  return {
    variables: { ...variables, items } as AddToCartMutationVariables,
    onSuccess,
  }
}

function useOrderItems() {
  const cache = usePriceTokenCache()
  const { orderForm } = useOrderForm()
  const orderItems = useBaseOrderItems()
  const { addItems } = orderItems

  const addItemsWithPriceToken = useCallback<typeof addItems>(
    (items, options) => {
      stashPriceTokens(
        cache,
        items as OfferWithPriceToken[],
        orderForm.items as Array<{ id: string; seller: string }>
      )

      return addItems(items, options)
    },
    [addItems, cache, orderForm.items]
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
  const cache = usePriceTokenCache()
  const [mutateAddItem] = useMutation<
    { addToCart: OrderForm },
    AddToCartMutationVariables
  >(AddToCart)

  return useCallback(
    (variables: AddToCartMutationVariables) => {
      const { variables: variablesWithTokens, onSuccess } = withPriceTokens(
        cache,
        variables
      )

      return mutateAddItem({ variables: variablesWithTokens }).then(
        ({ data, errors }) => {
          if (data?.addToCart && !(errors?.length ?? 0)) {
            onSuccess()
          }

          return { data: data?.addToCart, errors }
        }
      )
    },
    [cache, mutateAddItem]
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

const {
  OrderItemsProvider: BaseOrderItemsProvider,
} = createOrderItemsProvider<OrderForm>({
  useOrderForm,
  useOrderQueue,
  useQueueStatus,
  useLogger,
  useMutateAddItems,
  useMutateSetManualPrice,
  useMutateUpdateQuantity,
})

function OrderItemsProvider({ children }: { children: ReactNode }) {
  return (
    <PriceTokenCacheProvider>
      <BaseOrderItemsProvider>{children}</BaseOrderItemsProvider>
    </PriceTokenCacheProvider>
  )
}

export { useOrderItems, OrderItemsProvider }
export default { useOrderItems, OrderItemsProvider }
