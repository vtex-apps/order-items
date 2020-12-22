import type { Item } from 'vtex.checkout-graphql'

// eslint-disable-next-line no-shadow
export const enum LocalOrderTaskType {
  ADD_MUTATION = 'add_mutation',
  UPDATE_MUTATION = 'update_mutation',
}

export type UpdateQuantityInput =
  | { index: number; quantity: number }
  | { uniqueId: string; quantity: number }

interface UpdateQuantityMutationVariables {
  orderItems: UpdateQuantityInput[]
}

interface AddItemMutationVariables {
  items: OrderFormItemInput[]
  marketingData?: Partial<MarketingData>
  salesChannel?: string
}

type LocalOrderTask =
  | {
      id?: string
      variables: AddItemMutationVariables
      orderFormItems: Item[]
      type: LocalOrderTaskType.ADD_MUTATION
    }
  | {
      id?: string
      variables: UpdateQuantityMutationVariables
      orderFormItems: Item[]
      type: LocalOrderTaskType.UPDATE_MUTATION
    }

interface LocalOrderQueue {
  queue: LocalOrderTask[]
}

const DEFAULT_LOCAL_ORDER_QUEUE: LocalOrderQueue = {
  queue: [],
}

type GetLocalOrderQueue = () => LocalOrderQueue
type PushLocalOrderQueueFn = (task: LocalOrderTask) => number
type PopLocalOrderQueueFn = (index?: number) => LocalOrderTask | undefined
type UpdateLocalQueueItemIdsFn = (args: {
  fakeUniqueId: string
  uniqueId: string
}) => void

export const getLocalOrderQueue: GetLocalOrderQueue = () => {
  let queue = null

  try {
    queue = JSON.parse(localStorage.getItem('orderQueue') ?? 'null')
  } catch {
    // ignore
  }

  if (!queue) {
    localStorage.setItem(
      'orderQueue',
      JSON.stringify(DEFAULT_LOCAL_ORDER_QUEUE)
    )
  }

  return queue ?? DEFAULT_LOCAL_ORDER_QUEUE
}

const saveLocalOrderQueue = (orderQueue: LocalOrderQueue) => {
  localStorage.setItem('orderQueue', JSON.stringify(orderQueue))
}

export const pushLocalOrderQueue: PushLocalOrderQueueFn = (task) => {
  const orderQueue = getLocalOrderQueue()

  const index = orderQueue.queue.push(task)

  saveLocalOrderQueue(orderQueue)

  return index
}

export const popLocalOrderQueue: PopLocalOrderQueueFn = (index = 0) => {
  const orderQueue = getLocalOrderQueue()

  const task = orderQueue.queue[index]

  if (!task) {
    return undefined
  }

  orderQueue.queue.splice(index, 1)

  saveLocalOrderQueue(orderQueue)

  return task
}

export const updateLocalQueueItemIds: UpdateLocalQueueItemIdsFn = ({
  fakeUniqueId,
  uniqueId,
}) => {
  const orderQueue = getLocalOrderQueue()

  orderQueue.queue = orderQueue.queue.map((task) => {
    if (task.type !== LocalOrderTaskType.UPDATE_MUTATION) {
      return task
    }

    const itemIndex = task.variables.orderItems.findIndex(
      (input) => 'uniqueId' in input && input.uniqueId === fakeUniqueId
    )

    if (itemIndex > -1) {
      task.variables.orderItems[itemIndex] = {
        ...task.variables.orderItems[itemIndex],
        uniqueId,
      }
    }

    return task
  })

  saveLocalOrderQueue(orderQueue)
}
