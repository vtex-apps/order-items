import React, { createContext, FC, useContext, useMemo, useRef } from 'react'

interface Context {
  enqueue: (_: any) => Promise<any>
  listen: () => () => void
}

const OrderQueueContext = createContext<Context | undefined>(undefined)

let queue: Array<[() => Promise<unknown>, (value: unknown) => void]> = []

export const resetQueue = () => {
  queue = []
}

const enqueue = (f: () => Promise<unknown>) => {
  return new Promise<unknown>((resolve) => {
    queue.push([f, resolve])
  })
}

export const ensureEmptyQueue = () => {
  if (queue.length === 0) {
    return
  }

  throw new Error(
    "Tests ended but the task queue is not empty. Did you forget to call 'runQueueTask'?"
  )
}

export const runQueueTask = (): Promise<void> => {
  if (queue.length === 0) {
    throw new Error('Queue is empty')
  }

  const [f, resolve] = queue.shift()!

  return f().then(resolve)
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
