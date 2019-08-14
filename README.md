# Order Items

> Centralizes all item related requests to the Checkout API.

Any kind of item query or manipulation should be made through this component. This ensures that each interaction with the Checkout API happens in succession, avoiding concurrency issues.

## Usage

Use the function `useOrderItems` to get access to the API methods. Your component must be contained in a `OrderItemsProvider`, which in turn must be contained in a `OrderManagerProvider`.

```tsx
const Component: FunctionComponent = () => (
  <OrderManagerProvider>
    <OrderItemsProvider>
      <MyComponent />
    </OrderItemsProvider>
  </OrderManagerProvider>
)

const MyComponent: FunctionComponent = () => {
  const { itemList, updateItem } = useOrderItems()
  // ...
}
```

## API

### `itemList: Item[]`

An array containing the items in the cart.

### `updateItem: (index: number, quantity: number) => Promise<void>`

Changes the quantity of the item at position `index` in the `itemList` array to `quantity`. If `quantity` is `0`, the item is removed from the cart.
