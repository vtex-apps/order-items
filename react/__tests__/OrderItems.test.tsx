import { adjust } from 'ramda'
import React, { FunctionComponent, useEffect } from 'react'
import { act, render, fireEvent } from '@vtex/test-tools/react'
import { updateItems as UpdateItem } from 'vtex.checkout-resources/Mutations'
import { OrderFormProvider, useOrderForm } from 'vtex.order-manager/OrderForm'
import { OrderQueueProvider } from 'vtex.order-manager/OrderQueue'

import { mockOrderForm } from '../__mocks__/mockOrderForm'
import { OrderItemsProvider, useOrderItems } from '../OrderItems'

describe('OrderItems', () => {
  it('should throw when useOrderItems is called outside a OrderItemsProvider', () => {
    const oldConsoleError = console.error
    console.error = () => {}

    const Component: FunctionComponent = () => {
      useOrderItems()
      return <div>foo</div>
    }

    expect(() => render(<Component />)).toThrow(
      'useOrderItems must be used within a OrderItemsProvider'
    )

    console.error = oldConsoleError
  })

  it('should optimistically update itemList when updateItem is called', async () => {
    const UpdateItemMock = {
      request: {
        query: UpdateItem,
        variables: {
          orderItems: [
            {
              index: 1,
              quantity: 123,
            },
          ],
        },
      },
      result: {
        data: {
          updateItems: {
            ...mockOrderForm,
            items: adjust(
              1,
              item => ({ ...item, quantity: 42 }),
              mockOrderForm.items
            ),
          },
        },
      },
    }

    const InnerComponent: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()
      const { updateItem } = useOrderItems()
      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.name}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button onClick={() => updateItem({ index: 1, quantity: 123 })}>
            mutate
          </button>
        </div>
      )
    }

    const OuterComponent: FunctionComponent = () => (
      <OrderQueueProvider>
        <OrderFormProvider>
          <OrderItemsProvider>
            <InnerComponent />
          </OrderItemsProvider>
        </OrderFormProvider>
      </OrderQueueProvider>
    )

    const { getByText } = render(<OuterComponent />, {
      graphql: { mocks: [UpdateItemMock] },
    })

    const button = getByText('mutate')

    act(() => {
      fireEvent.click(button)
    })
    expect(getByText(`${mockOrderForm.items[1].name}: 123`)).toBeTruthy() // optimistic response

    await act(async () => new Promise(resolve => setTimeout(() => resolve()))) // waits for actual mutation result
    expect(getByText(`${mockOrderForm.items[1].name}: 42`)).toBeTruthy()
  })

  it('should update itemList when updateItem is called with uniqueId', async () => {
    const UpdateItemMock = {
      request: {
        query: UpdateItem,
        variables: {
          orderItems: [
            {
              uniqueId: mockOrderForm.items[0].uniqueId,
              quantity: 7,
            },
          ],
        },
      },
      result: {
        data: {
          updateItems: {
            ...mockOrderForm,
            items: adjust(
              0,
              item => ({ ...item, quantity: 7 }),
              mockOrderForm.items
            ),
          },
        },
      },
    }

    const InnerComponent: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()
      const { updateItem } = useOrderItems()
      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.name}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button
            onClick={() =>
              updateItem({
                uniqueId: mockOrderForm.items[0].uniqueId,
                quantity: 7,
              })
            }
          >
            mutate
          </button>
        </div>
      )
    }

    const OuterComponent: FunctionComponent = () => (
      <OrderQueueProvider>
        <OrderFormProvider>
          <OrderItemsProvider>
            <InnerComponent />
          </OrderItemsProvider>
        </OrderFormProvider>
      </OrderQueueProvider>
    )

    const { getByText } = render(<OuterComponent />, {
      graphql: { mocks: [UpdateItemMock] },
    })

    const button = getByText('mutate')

    await act(async () => {
      fireEvent.click(button)
      await new Promise(resolve => setTimeout(() => resolve())) // waits for mutation result
    })
    expect(getByText(`${mockOrderForm.items[0].name}: 7`)).toBeTruthy()
  })

  it('should update itemList when debouncedUpdateItem is called', async () => {
    const UpdateItemMock = {
      request: {
        query: UpdateItem,
        variables: {
          orderItems: [
            {
              uniqueId: mockOrderForm.items[0].uniqueId,
              quantity: 7,
            },
          ],
        },
      },
      result: {
        data: {
          updateItems: {
            ...mockOrderForm,
            items: adjust(
              0,
              item => ({ ...item, quantity: 7 }),
              mockOrderForm.items
            ),
          },
        },
      },
    }

    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()
      const { debouncedUpdateItem } = useOrderItems()

      useEffect(() => {
        debouncedUpdateItem({
          uniqueId: items[0].uniqueId,
          quantity: 7,
        })
      }, [])

      return <div>{items[0].quantity}</div>
    }

    const { queryByText } = render(
      <OrderQueueProvider>
        <OrderFormProvider>
          <OrderItemsProvider>
            <Component />
          </OrderItemsProvider>
        </OrderFormProvider>
      </OrderQueueProvider>,
      { graphql: { mocks: [UpdateItemMock] } }
    )

    expect(queryByText('7')).toBeTruthy()
  })
})
