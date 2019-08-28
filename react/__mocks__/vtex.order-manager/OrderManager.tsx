import React, { createContext, FC, useContext, useMemo, useState } from 'react'

import { mockOrderForm } from '../mockOrderForm'

interface Context {
  enqueue: (_: any) => Promise<any>
  listen: () => () => void
  loading: boolean
  orderForm: any
  setOrderForm: (_: any) => void
}

const OrderManagerContext = createContext<Context | undefined>(undefined)

export const OrderManagerProvider: FC = ({ children }: any) => {
  const [orderForm, setOrderForm] = useState(mockOrderForm)

  const value = useMemo(
    () => ({
      enqueue: async (f: any) => f(),
      listen: () => () => {},
      loading: false,
      orderForm,
      setOrderForm,
    }),
    [orderForm]
  )

  return (
    <OrderManagerContext.Provider value={value}>
      {children}
    </OrderManagerContext.Provider>
  )
}

export const useOrderManager = () => {
  return useContext(OrderManagerContext)
}
