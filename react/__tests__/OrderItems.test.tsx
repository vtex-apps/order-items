import { adjust } from 'ramda'
import React, { FunctionComponent } from 'react'
import { MockedProvider, MockedResponse } from '@apollo/react-testing'
import { act, render, fireEvent, wait } from '@vtex/test-tools/react'
import { Item } from 'vtex.checkout-graphql'
import UpdateItem from 'vtex.checkout-resources/MutationUpdateItems'
import AddToCart from 'vtex.checkout-resources/MutationAddToCart'
import { OrderForm, OrderQueue } from 'vtex.order-manager'

import { mockOrderForm, mockCatalogItem } from '../__fixtures__/mockOrderForm'
import { OrderItemsProvider, useOrderItems } from '../OrderItems'

const { OrderFormProvider, useOrderForm } = OrderForm
const { OrderQueueProvider } = OrderQueue

const mockUpdateItemMutation = (
  args: Array<Partial<Item>>,
  result: Array<Partial<Item>>
) => ({
  request: {
    query: UpdateItem,
    variables: {
      orderItems: args,
    },
  },
  result: {
    data: {
      updateItems: {
        ...mockOrderForm,
        items: result,
      },
    },
  },
})

describe('OrderItems', () => {
  it('should optimistically update itemList when updateQuantity is called', async () => {
    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()
      const { updateQuantity } = useOrderItems()
      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.id}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button onClick={() => updateQuantity({ index: 1, quantity: 123 })}>
            mutate
          </button>
        </div>
      )
    }

    const mockUpdateItem = mockUpdateItemMutation(
      [{ uniqueId: mockOrderForm.items[1].uniqueId, quantity: 123 }],
      adjust(
        1,
        (item: Item) => ({ ...item, quantity: 42 }),
        mockOrderForm.items
      )
    )

    const { getByText } = render(
      <MockedProvider mocks={[mockUpdateItem]} addTypename={false}>
        <OrderQueueProvider>
          <OrderFormProvider>
            <OrderItemsProvider>
              <Component />
            </OrderItemsProvider>
          </OrderFormProvider>
        </OrderQueueProvider>
      </MockedProvider>
    )

    const button = getByText('mutate')

    act(() => {
      fireEvent.click(button)
    })
    expect(getByText(`${mockOrderForm.items[1].name}: 123`)).toBeTruthy() // optimistic response

    await act(
      () =>
        new Promise<void>(resolve => {
          setTimeout(() => resolve())
        })
    ) // waits for actual mutation result
    expect(getByText(`${mockOrderForm.items[1].name}: 42`)).toBeTruthy()
  })

  it('should optimistically update itemList when removeItem is called', async () => {
    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()
      const { removeItem } = useOrderItems()
      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.id}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button
            onClick={() =>
              removeItem({ uniqueId: mockOrderForm.items[0].uniqueId })
            }
          >
            mutate
          </button>
        </div>
      )
    }

    const mockUpdateItem = mockUpdateItemMutation(
      [{ uniqueId: mockOrderForm.items[0].uniqueId, quantity: 0 }],
      adjust(0, (item: Item) => ({ ...item, quantity: 7 }), mockOrderForm.items)
    )

    const { getByText, queryByText } = render(
      <MockedProvider mocks={[mockUpdateItem]} addTypename={false}>
        <OrderQueueProvider>
          <OrderFormProvider>
            <OrderItemsProvider>
              <Component />
            </OrderItemsProvider>
          </OrderFormProvider>
        </OrderQueueProvider>
      </MockedProvider>
    )

    const button = getByText('mutate')

    act(() => {
      fireEvent.click(button)
    })
    expect(
      queryByText(
        (_: unknown, element: any) =>
          !!element.textContent &&
          element.textContent.includes(mockOrderForm.items[0].name)
      )
    ).toBeFalsy() // optimistic response

    await act(
      () => new Promise<void>(resolve => setTimeout(() => resolve()))
    ) // waits for actual mutation result
    expect(getByText(`${mockOrderForm.items[0].name}: 7`)).toBeTruthy()
  })

  it("should remove the items that weren't successfully added", async () => {
    jest.useFakeTimers()

    const mockUnavailableItem: MockedResponse = {
      request: {
        query: AddToCart,
        variables: {
          items: [
            {
              id: +mockCatalogItem.id,
              quantity: 1,
              seller: mockCatalogItem.seller,
            },
          ],
        },
      },
      result: {
        data: {
          addToCart: {
            items: [],
            messages: {
              generalMessages: [
                {
                  code: 'withoutStock',
                  text:
                    'O item Macacao Pantalona Xo Uruca Preto - PP não tem estoque',
                  status: 'error',
                },
              ],
            },
          },
        },
      },
    }

    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()
      const { addItem } = useOrderItems()
      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.id}>{item.name}</div>
          ))}
          <button onClick={() => addItem([mockCatalogItem])}>
            add to cart
          </button>
        </div>
      )
    }

    const { getByText, queryByText } = render(
      <MockedProvider mocks={[mockUnavailableItem]} addTypename={false}>
        <OrderQueueProvider>
          <OrderFormProvider>
            <OrderItemsProvider>
              <Component />
            </OrderItemsProvider>
          </OrderFormProvider>
        </OrderQueueProvider>
      </MockedProvider>
    )

    const addToCartButton = getByText(/add to cart/i)

    fireEvent.click(addToCartButton)

    // the item is added for a brief moment
    await wait(() =>
      expect(queryByText('Macacao Pantalona Xo Uruca')).toBeInTheDocument()
    )

    act(() => {
      jest.runAllTimers()
    })

    // then it is removed
    await wait(() =>
      expect(queryByText('Macacao Pantalona Xo Uruca')).not.toBeInTheDocument()
    )
  })
})
