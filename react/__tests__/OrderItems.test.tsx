import { adjust } from 'ramda'
import React, { FunctionComponent } from 'react'
import { render, fireEvent, flushPromises } from '@vtex/test-tools/react'

import { mockItems } from '../__mocks__/mockItemList'
import ItemList from '../graphql/itemList.graphql'
import UpdateItem from '../graphql/updateItem.graphql'
import { OrderItemsProvider, useOrderItems } from '../OrderItems'

const ItemListMock = {
  request: {
    query: ItemList,
  },
  result: {
    data: {
      cart: {
        items: mockItems,
      },
    },
  },
}

describe('OrderItems', () => {
  it('should throw when useOrderItems is called outside a OrderItemsProvider', () => {
    const oldConsoleError = console.error
    console.error = () => {}

    const Component: FunctionComponent = () => {
      useOrderItems()
      return <div>foo</div>
    }

    expect(() =>
      render(<Component />, {
        graphql: { mocks: [ItemListMock] },
      })
    ).toThrow('useOrderItems must be used within a OrderItemsProvider')

    console.error = oldConsoleError
  })

  it('should return a list of items when useOrderItems is called within a OrderItemsProvider', async () => {
    const InnerComponent: FunctionComponent = () => {
      const { itemList } = useOrderItems()
      return (
        <div>
          {itemList.map((item: Item) => (
            <div key={item.name}>{item.name}</div>
          ))}
        </div>
      )
    }

    const OuterComponent: FunctionComponent = () => (
      <OrderItemsProvider>
        <InnerComponent />
      </OrderItemsProvider>
    )

    const { getByText } = render(<OuterComponent />, {
      graphql: { mocks: [ItemListMock] },
    })
    await flushPromises() // waits for graphql query

    expect(getByText(mockItems[0].name)).toBeTruthy()
    expect(getByText(mockItems[1].name)).toBeTruthy()
    expect(getByText(mockItems[2].name)).toBeTruthy()
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
            items: adjust(1, item => ({ ...item, quantity: 42 }), mockItems),
          },
        },
      },
    }

    const InnerComponent: FunctionComponent = () => {
      const { itemList, updateItem } = useOrderItems()
      return (
        <div>
          {itemList.map((item: Item) => (
            <div key={item.name}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button onClick={() => updateItem(1, 123)}>mutate</button>
        </div>
      )
    }

    const OuterComponent: FunctionComponent = () => (
      <OrderItemsProvider>
        <InnerComponent />
      </OrderItemsProvider>
    )

    const { getByText } = render(<OuterComponent />, {
      graphql: { mocks: [ItemListMock, UpdateItemMock] },
    })
    await flushPromises() // waits for initial item query

    const button = getByText('mutate')
    fireEvent.click(button)
    expect(getByText(`${mockItems[1].name}: 123`)).toBeTruthy() // optimistic response

    await flushPromises() // waits for actual mutation result
    expect(getByText(`${mockItems[1].name}: 42`)).toBeTruthy()

    console.error = oldConsoleError
  })
})
