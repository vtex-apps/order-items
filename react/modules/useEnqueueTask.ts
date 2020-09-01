import { useCallback } from 'react'
import { OrderForm, OrderQueue } from 'vtex.order-manager'

import { popLocalOrderQueue } from './localOrderQueue'

const { useOrderForm } = OrderForm
const { useOrderQueue, useQueueStatus, QueueStatus } = OrderQueue

interface Task {
  execute: () => Promise<OrderForm>
  rollback?: () => void
}

export const useEnqueueTask = () => {
  const { enqueue, listen } = useOrderQueue()
  const queueStatusRef = useQueueStatus(listen)
  const { setOrderForm } = useOrderForm()

  const enqueueTask = useCallback<(task: Task) => PromiseLike<void>>(
    (task) =>
      enqueue(task.execute).then(
        (orderForm: OrderForm) => {
          popLocalOrderQueue()
          if (queueStatusRef.current === QueueStatus.FULFILLED) {
            setOrderForm(orderForm)
          }
        },
        (error: any) => {
          popLocalOrderQueue()

          if (error && error.code === 'TASK_CANCELLED') {
            return
          }

          throw error
        }
      ),
    [enqueue, queueStatusRef, setOrderForm]
  )

  return enqueueTask
}
