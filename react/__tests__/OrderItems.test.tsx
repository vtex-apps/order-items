import { adjust } from 'ramda'
import React, { FunctionComponent } from 'react'
import { MockedProvider, MockedResponse } from '@apollo/react-testing'
import { act, render, fireEvent, waitFor } from '@vtex/test-tools/react'
import { Item, ItemInput } from 'vtex.checkout-graphql'
import UpdateItem from 'vtex.checkout-resources/MutationUpdateItems'
import AddToCart from 'vtex.checkout-resources/MutationAddToCart'
import { OrderForm, OrderQueue } from 'vtex.order-manager'

import {
  mockOrderForm,
  mockCatalogItem,
  mockCatalogItems,
  mockCatalogItems2,
  mockItemSeller1,
  mockItemSeller2,
} from '../__fixtures__/mockOrderForm'
import { OrderItemsProvider, useOrderItems } from '../OrderItems'

const { OrderFormProvider, useOrderForm } = OrderForm
const { OrderQueueProvider } = OrderQueue

const {
  OrderQueue: { runQueueTask, resetQueue, ensureEmptyQueue },
} = jest.requireMock('vtex.order-manager')

const mockAddItemMutation = ({
  args,
  result,
}: {
  args: Array<Partial<ItemInput>>
  result: Array<Partial<Item>>
}) => ({
  request: {
    query: AddToCart,
    variables: {
      items: args,
    },
  },
  result: {
    data: {
      addToCart: {
        ...mockOrderForm,
        items: result,
      },
    },
  },
})

const mockUpdateItemMutation = ({
  args,
  result,
}: {
  args: Array<Partial<Item>>
  result: Array<Partial<Item>>
}) => ({
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
  beforeEach(() => {
    resetQueue()
  })

  afterEach(() => {
    ensureEmptyQueue()
  })

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

    const mockUpdateItem = mockUpdateItemMutation({
      args: [{ uniqueId: mockOrderForm.items[1].uniqueId, quantity: 123 }],
      result: adjust(
        1,
        (item: Item) => ({ ...item, quantity: 42 }),
        mockOrderForm.items
      ),
    })

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
      runQueueTask()
    })

    expect(getByText(`${mockOrderForm.items[1].name}: 123`)).toBeTruthy() // optimistic response

    await act(
      () =>
        new Promise<void>((resolve) => {
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

    const mockUpdateItem = mockUpdateItemMutation({
      args: [{ uniqueId: mockOrderForm.items[0].uniqueId, quantity: 0 }],
      result: adjust(
        0,
        (item: Item) => ({ ...item, quantity: 7 }),
        mockOrderForm.items
      ),
    })

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
      runQueueTask()
    })

    expect(
      queryByText(
        (_: unknown, element: any) =>
          !!element.textContent &&
          element.textContent.includes(mockOrderForm.items[0].name)
      )
    ).toBeFalsy() // optimistic response

    await act(
      () => new Promise<void>((resolve) => setTimeout(() => resolve()))
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

    act(() => {
      runQueueTask()
    })

    // the item is added for a brief moment
    await waitFor(() =>
      expect(queryByText('Macacao Pantalona Xo Uruca')).toBeInTheDocument()
    )

    act(() => {
      jest.runAllTimers()
    })

    // then it is removed
    await waitFor(() =>
      expect(queryByText('Macacao Pantalona Xo Uruca')).not.toBeInTheDocument()
    )
  })

  it('should add items to cart when any of the items in the input array are already in the cart', async () => {
    jest.useFakeTimers()

    const mockAddItems = mockAddItemMutation({
      args: [
        {
          id: +mockCatalogItems[0].id,
          quantity: 1,
          seller: mockCatalogItems[0].seller,
          options: [],
        },
        {
          id: +mockCatalogItems[1].id,
          quantity: 1,
          seller: mockCatalogItems[1].seller,
          options: [],
        },
      ],
      result: [
        { ...mockCatalogItems[0], quantity: 1 },
        { ...mockCatalogItems[1], quantity: 1 },
      ],
    })

    const mockAddItems2 = mockAddItemMutation({
      args: [
        {
          id: +mockCatalogItems2[0].id,
          quantity: 1,
          seller: mockCatalogItems2[0].seller,
          options: [],
        },
        {
          id: +mockCatalogItems2[1].id,
          quantity: 1,
          seller: mockCatalogItems2[1].seller,
          options: [],
        },
      ],
      result: [
        { ...mockCatalogItems[0], quantity: 1 },
        { ...mockCatalogItems[1], quantity: 1 },
        { ...mockCatalogItems2[0], quantity: 1 },
      ],
    })

    let itemsToAdd = mockCatalogItems

    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()

      const { addItem } = useOrderItems()

      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.id}>
              {item.name}: {item.skuName}
            </div>
          ))}
          <button onClick={() => addItem(itemsToAdd)}>add to cart</button>
        </div>
      )
    }

    const { getByText, queryByText } = render(
      <MockedProvider mocks={[mockAddItems, mockAddItems2]} addTypename={false}>
        <OrderQueueProvider>
          <OrderFormProvider>
            <OrderItemsProvider>
              <Component />
            </OrderItemsProvider>
          </OrderFormProvider>
        </OrderQueueProvider>
      </MockedProvider>
    )

    // add first list of elements
    const addToCartButton = getByText(/add to cart/i)

    fireEvent.click(addToCartButton)

    act(() => {
      runQueueTask()
      jest.runAllTimers()
    })

    // should add the two items
    await waitFor(() =>
      expect(queryByText('St Tropez Top Shorts: Navy Blue')).toBeInTheDocument()
    )

    await waitFor(() =>
      expect(queryByText('Blouse with Knot: Grey')).toBeInTheDocument()
    )

    // add second list containing an element that is already in the cart
    itemsToAdd = mockCatalogItems2
    fireEvent.click(addToCartButton)

    act(() => {
      runQueueTask()
      jest.runAllTimers()
    })

    // should add the element that was not yet in the cart
    await waitFor(() =>
      expect(queryByText('St Tropez Top Shorts: Green')).toBeInTheDocument()
    )
  })

  it('should increment the quantity of an item already in the cart', async () => {
    jest.useFakeTimers()
    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()

      const { addItem } = useOrderItems()

      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.id}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button onClick={() => addItem([mockCatalogItems[0]])}>
            add to cart
          </button>
        </div>
      )
    }

    const mockAddItems = mockAddItemMutation({
      args: [
        {
          id: +mockCatalogItems[0].id,
          quantity: 1,
          seller: mockCatalogItems[0].seller,
          options: [],
        },
      ],
      result: [{ ...mockCatalogItems[0], quantity: 1 }],
    })

    const mockUpdateItem = mockUpdateItemMutation({
      args: [{ uniqueId: mockCatalogItems[0].uniqueId, quantity: 2 }],
      result: [{ ...mockCatalogItems[0], quantity: 2 }],
    })

    const { getByText, queryByText } = render(
      <MockedProvider
        mocks={[mockAddItems, mockUpdateItem]}
        addTypename={false}
      >
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

    act(() => {
      fireEvent.click(addToCartButton)
      runQueueTask()
    })

    // the item is added for a brief moment
    await waitFor(() =>
      expect(queryByText('St Tropez Top Shorts: 1')).toBeInTheDocument()
    )

    act(() => {
      fireEvent.click(addToCartButton)
      runQueueTask()
      jest.runAllTimers()
    })

    // the item is added for a brief moment
    await waitFor(() =>
      expect(queryByText('St Tropez Top Shorts: 2')).toBeInTheDocument()
    )
  })

  it('should increment the quantity of an item already in the cart with different seller', async () => {
    jest.useFakeTimers()

    let itemsToAdd: CatalogItem[] = []

    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()

      const { addItem } = useOrderItems()

      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.id}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button onClick={() => addItem(itemsToAdd)}>add to cart</button>
        </div>
      )
    }

    const mockAddItems = mockAddItemMutation({
      args: [
        {
          id: +mockItemSeller1.id,
          quantity: 1,
          seller: '1',
          options: [],
        },
      ],
      result: [{ ...mockItemSeller1, quantity: 1 }],
    })

    const mockAddItems2 = mockAddItemMutation({
      args: [
        {
          id: +mockItemSeller2.id,
          quantity: 1,
          seller: '2',
          options: [],
        },
      ],
      result: [{ ...mockItemSeller2, quantity: 1 }],
    })

    const mockUpdateItem = mockUpdateItemMutation({
      args: [{ uniqueId: mockCatalogItems[0].uniqueId, quantity: 2 }],
      result: [{ ...mockCatalogItems[0], quantity: 2 }],
    })

    const { getByText, queryAllByText, queryByText, debug } = render(
      <MockedProvider
        mocks={[mockAddItems, mockAddItems2, mockUpdateItem]}
        addTypename={false}
      >
        <OrderQueueProvider>
          <OrderFormProvider>
            <OrderItemsProvider>
              <Component />
            </OrderItemsProvider>
          </OrderFormProvider>
        </OrderQueueProvider>
      </MockedProvider>
    )

    itemsToAdd = [mockItemSeller1]

    const addToCartButton = getByText(/add to cart/i)

    fireEvent.click(addToCartButton)

    act(() => {
      runQueueTask()
    })

    // the item is added for a brief moment
    await waitFor(() => {
      expect(queryAllByText(/Tropez/)).toHaveLength(1)
    })

    itemsToAdd = [mockItemSeller2]

    fireEvent.click(addToCartButton)

    act(() => {
      runQueueTask()
    })

    await waitFor(() => {
      expect(queryAllByText(/Tropez/)).toHaveLength(2)
    })

    fireEvent.click(addToCartButton)

    act(() => {
      runQueueTask()
      jest.runAllTimers()
    })

    // the item is added for a brief moment
    await waitFor(() => {
      expect(queryByText('St Tropez Top Shorts: 1')).toBeInTheDocument()
      expect(queryByText('St Tropez Top Shorts: 2')).toBeInTheDocument()
    })
  })
})
