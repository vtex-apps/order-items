import {
  OrderForm as GraphqlOrderForm,
  AssemblyOptionInput,
} from 'vtex.checkout-graphql'

declare global {
  type OrderForm = GraphqlOrderForm

  type Maybe<T> = T | undefined | null

  interface OrderFormItemInput {
    id?: number
    index?: number
    quantity?: number
    seller?: string
    uniqueId?: string
    options?: AssemblyOptionInput[]
  }

  interface CatalogItem {
    additionalInfo: ItemAdditionalInfo
    availability: string
    detailUrl: string
    id: string
    imageUrl: string
    index?: number
    listPrice: number
    measurementUnit: string
    name: string
    price: number
    productId: string
    quantity: number
    sellingPrice: number
    seller: string
    skuName: string
    skuSpecifications: SKUSpecification[]
    options?: AssemblyOptionInput[]
    uniqueId?: string
  }

  interface ItemAdditionalInfo {
    brandName: string
  }

  interface MarketingData {
    coupon: Maybe<string>
  }

  interface SKUSpecification {
    fieldName: string
    fieldValues: string[]
  }

  interface Totalizer {
    id: string
    name: string
    value: number
  }

  interface UpdateItemsMutation {
    updateItems: OrderForm
  }

  interface FakeUniqueIdMap {
    [fakeUniqueId: string]: string
  }
}
