import * as uuid from 'uuid'

export const AVAILABLE = 'available'

export const adjustForItemInput = (item: Partial<Item>): OrderFormItemInput => {
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
  cartItem: Partial<Item>
): Item => {
  return {
    id: cartItem.id!,
    productId: cartItem.productId!,
    name: cartItem.name!,
    skuName: cartItem.skuName!,
    skuSpecifications: cartItem.skuSpecifications!,
    imageUrl: cartItem.imageUrl!,
    price: cartItem.price!,
    listPrice: cartItem.listPrice!,
    sellingPrice: cartItem.sellingPrice!,
    measurementUnit: cartItem.measurementUnit!,
    quantity: itemInput.quantity || 1,
    index: cartItem.index,
    seller: itemInput.seller!,
    uniqueId: ('uniqueId' in itemInput && itemInput.uniqueId) || uuid.v4(),
    detailUrl: cartItem.detailUrl!,
    availability: cartItem.availability || AVAILABLE,
    additionalInfo: cartItem.additionalInfo!,
    options: cartItem.options,
  }
}
