/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as uuid from 'uuid'
import { Item } from 'vtex.checkout-graphql'

export const AVAILABLE = 'available'

export const mapForItemInput = (
  item: Partial<CatalogItem>
): OrderFormItemInput => {
  return {
    id: +item.id!,
    index: item.index,
    quantity: item.quantity,
    seller: item.seller,
    options: item.options,
  }
}

export const mapItemInputToOrderFormItem = (
  item: Partial<CatalogItem>
): Item => {
  return {
    id: item.id!,
    productId: item.productId!,
    name: item.name!,
    skuName: item.skuName!,
    skuSpecifications: item.skuSpecifications!,
    imageUrls: {
      at1x: item.imageUrl!,
      at2x: item.imageUrl!,
      at3x: item.imageUrl!,
    },
    price: item.price!,
    listPrice: item.listPrice!,
    sellingPrice: item.sellingPrice!,
    measurementUnit: item.measurementUnit!,
    quantity: item.quantity ?? 1,
    uniqueId: item?.uniqueId ?? uuid.v4(),
    detailUrl: item.detailUrl!,
    availability: item.availability ?? AVAILABLE,
    additionalInfo: item.additionalInfo!,
    options: item.options,
  }
}

export const filterUndefined = <T>(value: T | undefined): value is T => {
  return value !== undefined
}
