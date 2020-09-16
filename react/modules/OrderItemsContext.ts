import { useContext, createContext } from 'react'

interface Context {
  addItem: (
    items: Array<Partial<CatalogItem>>,
    marketingData?: Partial<MarketingData>
  ) => void
  updateQuantity: (props: Partial<CatalogItem>) => void
  removeItem: (props: Partial<CatalogItem>) => void
}

const noop = async () => {}

export const OrderItemsContext = createContext<Context>({
  addItem: noop,
  updateQuantity: noop,
  removeItem: noop,
})

export const useOrderItems = () => {
  return useContext(OrderItemsContext)
}
