import { useContext, createContext } from 'react'

export interface AddItemsOptions {
  allowedOutdatedData?: string[]
  marketingData?: Partial<MarketingData>
  salesChannel?: string
}

export interface UpdateItemOptions {
  allowedOutdatedData?: string[]
}

export interface Context {
  /**
   * @deprecated Use `addItems` instead
   */
  addItem: (
    items: Array<Partial<CatalogItem>>,
    marketingData?: Partial<MarketingData>,
    salesChannel?: string
  ) => void
  updateQuantity: (
    props: Partial<CatalogItem>,
    options?: UpdateItemOptions
  ) => void
  removeItem: (props: Partial<CatalogItem>, options?: UpdateItemOptions) => void
  setManualPrice: (price: number, itemIndex: number) => void
  addItems: (
    items: Array<Partial<CatalogItem>>,
    options?: AddItemsOptions
  ) => void
}

const noop = async () => {}

export const OrderItemsContext = createContext<Context>({
  addItem: noop,
  addItems: noop,
  updateQuantity: noop,
  removeItem: noop,
  setManualPrice: noop,
})

export const useOrderItems = () => {
  return useContext(OrderItemsContext)
}
