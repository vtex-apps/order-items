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
  const { updateQuantity, removeItem } = useOrderItems()
  // ...
}
```

## API

### `updateQuantity: (props: { uniqueId?: string, index?: number, quantity: number }) => void`

Updates the quantity of an item in the order form. `props` must contain either the `uniqueId` or `index` of the item to be updated as well as the desired `quantity`.

#### Example

```tsx
updateQuantity({
  uniqueId: 'E1FDB9F661D74543AE3A13D587641E63',
  quantity: 3,
})
```

### `removeItem: (props: { uniqueId?: string, index?: number }) => void`

Removes an item from the cart. `props` must contain either the `uniqueId` or `index` of the item to be removed.

#### Example

```tsx
removeItem({ uniqueId: 'E1FDB9F661D74543AE3A13D587641E63' })
```

### `addItemToCart: (props: [Item]) => Promise<{data: OrderForm, error: boolean}>`

Add an item to the cart. `props` must be a list with the `items` to be added to the cart.

#### Example

```tsx
addItemToCart([{
                id: '2000535',
                listPrice: 400000,
                name: 'Vasco Football T-shirt',
                price: 360000,
                productId: '13',
                quantity: 4,
                sellingPrice: 360000,
                skuName: 'Test SKU 2',
                skuSpecifications: [],
                uniqueId: 'SomeUniqueId2',
              }])