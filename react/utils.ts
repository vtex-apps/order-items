import * as uuid from 'uuid'
import { Item } from 'vtex.checkout-graphql'

export const AVAILABLE = 'available'

export const adjustForItemInput = (
  item: Partial<CatalogItem>
): OrderFormItemInput => {
  return {
    id: +(item.id ?? 0),
    index: item.index,
    quantity: item.quantity,
    seller: item.seller,
    options: item.options,
  }
}

export const mapItemInputToOrderFormItem = (
  itemInput: OrderFormItemInput,
  cartItem: Partial<CatalogItem>
): Item => {
  return {
    id: cartItem.id!,
    productId: cartItem.productId!,
    name: cartItem.name!,
    skuName: cartItem.skuName!,
    skuSpecifications: cartItem.skuSpecifications!,
    imageUrls: {
      at1x: cartItem.imageUrl!,
      at2x: cartItem.imageUrl!,
      at3x: cartItem.imageUrl!,
    },
    price: cartItem.price!,
    listPrice: cartItem.listPrice!,
    sellingPrice: cartItem.sellingPrice!,
    measurementUnit: cartItem.measurementUnit!,
    quantity: itemInput.quantity ?? 1,
    uniqueId: ('uniqueId' in itemInput && itemInput.uniqueId) || uuid.v4(),
    detailUrl: cartItem.detailUrl!,
    availability: cartItem.availability ?? AVAILABLE,
    additionalInfo: cartItem.additionalInfo!,
    options: cartItem.options,
  }
}
