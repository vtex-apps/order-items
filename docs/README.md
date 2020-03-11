# Order Items
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

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

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!