import type { Item } from 'vtex.checkout-graphql'
import { useSplunk } from 'vtex.checkout-splunk'

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
  allowedOutdatedData?: string[]
}

interface AddItemMutationVariables {
  items: OrderFormItemInput[]
  marketingData?: Partial<MarketingData>
  salesChannel?: string
  allowedOutdatedData?: string[]
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

type LogFn = ReturnType<typeof useSplunk>['logSplunk']

interface OrderQueueOptions {
  log?: LogFn
}

type GetLocalOrderQueue = (options?: OrderQueueOptions) => LocalOrderQueue
type PushLocalOrderQueueFn = (
  task: LocalOrderTask,
  options?: OrderQueueOptions
) => number
type PopLocalOrderQueueFn = (
  index?: number,
  options?: OrderQueueOptions
) => LocalOrderTask | undefined
type UpdateLocalQueueItemIdsFn = (
  args: {
    fakeUniqueId: string
    uniqueId: string
  },
  options?: OrderQueueOptions
) => void

export const getLocalOrderQueue: GetLocalOrderQueue = (options) => {
  let queue = null

  try {
    queue = JSON.parse(localStorage.getItem('orderQueue') ?? 'null')
  } catch {
    // ignore
  }

  if (!queue) {
    try {
      localStorage.setItem(
        'orderQueue',
        JSON.stringify(DEFAULT_LOCAL_ORDER_QUEUE)
      )
    } catch (error) {
      options?.log?.({
        type: 'Error',
        level: 'Critical',
        event: error,
        workflowType: 'OrderItems',
        workflowInstance: 'get-local-order-queue',
      })
    }
  }

  return queue ?? DEFAULT_LOCAL_ORDER_QUEUE
}

const saveLocalOrderQueue = (
  orderQueue: LocalOrderQueue,
  options?: OrderQueueOptions
) => {
  try {
    localStorage.setItem('orderQueue', JSON.stringify(orderQueue))
  } catch (error) {
    options?.log?.({
      type: 'Error',
      level: 'Critical',
      event: error,
      workflowType: 'OrderItems',
      workflowInstance: 'save-local-order-queue',
    })
  }
}

export const pushLocalOrderQueue: PushLocalOrderQueueFn = (task, options) => {
  const orderQueue = getLocalOrderQueue(options)

  const index = orderQueue.queue.push(task)

  saveLocalOrderQueue(orderQueue, options)

  return index
}

export const popLocalOrderQueue: PopLocalOrderQueueFn = (
  index = 0,
  options = {}
) => {
  const orderQueue = getLocalOrderQueue(options)

  const task = orderQueue.queue[index]

  if (!task) {
    return undefined
  }

  orderQueue.queue.splice(index, 1)

  saveLocalOrderQueue(orderQueue, options)

  return task
}

export const updateLocalQueueItemIds: UpdateLocalQueueItemIdsFn = (
  { fakeUniqueId, uniqueId },
  options
) => {
  const orderQueue = getLocalOrderQueue(options)

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

  saveLocalOrderQueue(orderQueue, options)
}
