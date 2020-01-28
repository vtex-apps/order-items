export enum LocalOrderTaskType {
  ADD_MUTATION = 'add_mutation',
  UPDATE_MUTATION = 'update_mutation',
}

type UpdateQuantityInput =
  | { index: number; quantity: number }
  | { uniqueId: string; quantity: number }

type UpdateQuantityMutationVariables = {
  orderItems: UpdateQuantityInput[]
}

type AddItemMutationVariables = {
  items: OrderFormItemInput[]
}

type LocalOrderTask =
  | {
      variables: AddItemMutationVariables
      type: LocalOrderTaskType.ADD_MUTATION
    }
  | {
      variables: UpdateQuantityMutationVariables
      type: LocalOrderTaskType.UPDATE_MUTATION
    }

interface LocalOrderQueue {
  queue: LocalOrderTask[]
}

const DEFAULT_LOCAL_ORDER_QUEUE: LocalOrderQueue = {
  queue: [],
}

type GetLocalOrderQueue = () => LocalOrderQueue
type PushLocalOrderQueueFn = (task: LocalOrderTask) => LocalOrderQueue
type PopLocalOrderQueueFn = () => LocalOrderTask | undefined
type UpdateLocalQueueItemIdsFn = (args: { fakeUniqueId: string, uniqueId: string }) => void

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

export const pushLocalOrderQueue: PushLocalOrderQueueFn = task => {
  const orderQueue = getLocalOrderQueue()

  orderQueue!.queue.push(task)
  saveLocalOrderQueue(orderQueue)

  return orderQueue
}

export const popLocalOrderQueue: PopLocalOrderQueueFn = () => {
  const orderQueue = getLocalOrderQueue()
  const task = orderQueue!.queue!.shift()

  saveLocalOrderQueue(orderQueue)

  return task
}

export const updateLocalQueueItemIds: UpdateLocalQueueItemIdsFn = ({ fakeUniqueId, uniqueId }) => {
  const orderQueue = getLocalOrderQueue()

  orderQueue.queue = orderQueue.queue.map(task => {
    if (task.type === LocalOrderTaskType.ADD_MUTATION) {
      return task
    }

    const itemIndex = task.variables.orderItems.findIndex(input => 'uniqueId' in input && input.uniqueId === fakeUniqueId)

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
