import { adjust } from 'ramda'
import React, { FunctionComponent } from 'react'
import { render, fireEvent } from '@vtex/test-tools/react'
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
    const oldConsoleError = console.error
    console.error = () => {}

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
          <button onClick={() => updateItem(1, 123)}>mutate</button>
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
    fireEvent.click(button)
    expect(getByText(`${mockOrderForm.items[1].name}: 123`)).toBeTruthy() // optimistic response

    await new Promise(resolve => setTimeout(() => resolve())) // waits for actual mutation result
    expect(getByText(`${mockOrderForm.items[1].name}: 42`)).toBeTruthy()

    console.error = oldConsoleError
  })
})
