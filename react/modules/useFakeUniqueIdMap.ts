import { useRef, useEffect } from 'react'
import { OrderQueue } from 'vtex.order-manager'

const { useOrderQueue, QueueStatus } = OrderQueue

export const useFakeUniqueIdMap = () => {
  const fakeUniqueIdMapRef = useRef<FakeUniqueIdMap>({})
  const { listen } = useOrderQueue()

  useEffect(
    () =>
      listen(QueueStatus.FULFILLED, () => {
        // avoid leaking "fake" `uniqueId`.
        // this works because everytime we fulfill the queue, we know
        // for sure that we won't have any locally generated uniqueId's
        // left to map to a real uniqueId.
        fakeUniqueIdMapRef.current = {}
      }),
    [listen]
  )

  return fakeUniqueIdMapRef
}
