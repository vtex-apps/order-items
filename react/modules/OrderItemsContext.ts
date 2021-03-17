import { useContext, createContext } from 'react'

export interface Context {
  addItem: (
    items: Array<Partial<CatalogItem>>,
    marketingData?: Partial<MarketingData>,
    salesChannel?: string
  ) => void
  updateQuantity: (props: Partial<CatalogItem>) => void
  removeItem: (props: Partial<CatalogItem>) => void
  updateItems: (items: Array<Partial<CatalogItem>>) => void
  setManualPrice: (price: number, itemIndex: number) => void
}

const noop = async () => {}

export const OrderItemsContext = createContext<Context>({
  addItem: noop,
  updateQuantity: noop,
  removeItem: noop,
  setManualPrice: noop,
  updateItems: noop,
})

export const useOrderItems = () => {
  return useContext(OrderItemsContext)
}
