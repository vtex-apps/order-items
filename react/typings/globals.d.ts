interface OrderForm {
  items: Item[]
  marketingData: MarketingData | undefined
  totalizers: Totalizer[]
  value: number
}

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
  uniqueId: string
}

interface ItemAdditionalInfo {
  brandName: string
}

interface MarketingData {
  coupon: string
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
