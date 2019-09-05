# Order Items

> Centralizes all item related requests to the Checkout API.

Any kind of item manipulation should be made through this component. This ensures that each interaction with the Checkout API happens in succession, avoiding concurrency issues.

## Usage

Use the function `useOrderItems` to get access to the API methods. Your component must be contained in a `OrderItemsProvider`, which in turn must be contained in a `OrderManagerProvider`.

```tsx
import { OrderManagerProvider, useOrderManager } from 'vtex.order-manager/OrderManager'
import { OrderItemsProvider, useOrderItems } from 'vtex.order-items/OrderItems'

const MainComponent: FunctionComponent = () => (
  <OrderManagerProvider>
    <OrderItemsProvider>
      <MyComponent />
    </OrderItemsProvider>
  </OrderManagerProvider>
)

const MyComponent: FunctionComponent = () => {
  const { orderForm: { items } } = useOrderManager()
  const { updateItem } = useOrderItems()
  // ...
}
```

## API

### `updateItem: (props: Partial<Item>) => void`

Updates an item in the order form. Only properties present in `props` will be changed.

The item is identified either by its `index` in the order form array or its `uniqueId`. One of those properties must be present in `props`. If both are present, `index` will be used to identify the object and `uniqueId` is ignored.

#### Examples

- Removing the third item from the cart:
```tsx
updateItem({
  index: 2,
  quantity: 0,
})
```

- Changing an item's price:
```tsx
updateItem({
  uniqueId: 'E1FDB9F661D74543AE3A13D587641E63',
  price: 19000,
})
```
