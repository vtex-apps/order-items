declare module 'vtex.order-manager/OrderForm' {
  import { OrderForm } from 'vtex.order-manager'

  export const useOrderForm = OrderForm.useOrderForm

  export const OrderFormProvider = OrderForm.OrderFormProvider
}

declare module 'vtex.order-manager/OrderQueue' {
  import { OrderQueue } from 'vtex.order-manager'

  export const OrderQueueProvider = OrderQueue.OrderQueueProvider

  export const useOrderQueue = OrderQueue.useOrderQueue

  // the typings generated from `vtex setup` don't work
  // well with enums, so we need to redefine it
  export enum QueueStatus {
    PENDING = 'Pending',
    FULFILLED = 'Fulfilled',
  }

  export const useQueueStatus = OrderQueue.useQueueStatus
}
