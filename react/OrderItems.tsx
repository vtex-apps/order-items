import type { FC } from 'react'
import React from 'react'
import { useMutation } from 'react-apollo'
import UpdateItems from 'vtex.checkout-resources/MutationUpdateItems'
import AddToCart from 'vtex.checkout-resources/MutationAddToCart'
import SetManualPrice from 'vtex.checkout-resources/MutationSetManualPrice'

import { useOrderItems } from './lib/order-items/src/modules/OrderItemsContext'
import { OrderItemsProvider as AgnosticOrderItemsProvider } from './lib/order-items/src/OrderItems'

import { OrderForm, OrderFormItemInput } from './lib/order-items/types'

interface SetManualPrice {
  setManualPrice: OrderForm
}

interface UpdateItemsMutation {
  updateItems: OrderForm
}

export const OrderItemsProviderWithReactApollo: FC = ({ children }) => {
  const [mutateUpdateQuantity] = useMutation<UpdateItemsMutation>(UpdateItems)
  const [mutateSetManualPrice] = useMutation<SetManualPrice>(SetManualPrice)
  const [mutateAddItem] = useMutation<
    { addToCart: OrderForm },
    {
      items: OrderFormItemInput[]
      marketingData?: Partial<MarketingData>
      salesChannel?: string
    }
  >(AddToCart)

  return (
    <AgnosticOrderItemsProvider
      handleUpdateQuantity={mutateUpdateQuantity}
      handleAddItem={mutateAddItem}
      handleUpdateManualPrice={mutateSetManualPrice}
    >
      {children}
    </AgnosticOrderItemsProvider>
  )
}

const OrderItemsProvider = OrderItemsProviderWithReactApollo

export { OrderItemsProvider, useOrderItems }
export default { OrderItemsProvider, useOrderItems }
