import React, { createContext, FC, useContext, useMemo, useRef } from 'react'

interface Context {
  enqueue: (_: any) => Promise<any>
  listen: () => () => void
}

const OrderQueueContext = createContext<Context | undefined>(undefined)

let queue: any[] = []

export const resetQueue = () => {
  queue = []
}

const enqueue = jest.fn((f) => {
  return new Promise<any>((resolve) => {
    queue.push([f, resolve])
  })
})

export const ensureEmptyQueue = () => {
  if (queue.length === 0) {
    return
  }

  console.error(
    "Tests ended but the task queue is not empty. Did you forget to call 'runQueueTask'?"
  )
}

export const runQueueTask = (): Promise<void> => {
  const [f, resolve] = queue.shift()

  return Promise.resolve(f()).then(resolve)
}

export const OrderQueueProvider: FC = ({ children }: any) => {
  const value = useMemo(
    () => ({
      enqueue,
      listen: () => () => {},
    }),
    []
  )

  return (
    <OrderQueueContext.Provider value={value}>
      {children}
    </OrderQueueContext.Provider>
  )
}

export const useOrderQueue = () => {
  return useContext(OrderQueueContext)
}

export const useQueueStatus = (_: any) => {
  return useRef('Fulfilled')
}

// eslint-disable-next-line no-shadow
export const enum QueueStatus {
  PENDING = 'Pending',
  FULFILLED = 'Fulfilled',
}
