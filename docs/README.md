# Order Items
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

> Centralizes all item related requests to the Checkout API.

## Warning 🚨

This repository contains **experimental** code for VTEX Checkout and should **not** be used in production.

This code is "experimental" for various reasons:
- Some are not tested as rigorously as the main code.
- Some are tested but not maintained.
- It can suffer from significant changes (breaking changes) without further notice.

**Use it at your own risk!** ☠️


## About

Any kind of item manipulation should be made through this component. This ensures that each interaction with the Checkout API happens in succession, avoiding concurrency issues.

This repository is an adapter of [`@vtex/order-items`](https://github.com/vtex/order-items) to be used inside VTEX IO apps. For documentation on the API, please refer to the provided package docs.

## Usage

Use the function `useOrderItems` to get access to the API methods. Your component must be contained in a `OrderItemsProvider`, which in turn must be contained in a `OrderFormProvider`.

```tsx
import { OrderFormProvider, useOrderForm } from 'vtex.order-manager/OrderForm'
import { OrderItemsProvider, useOrderItems } from 'vtex.order-items/OrderItems'

const MainComponent: FunctionComponent = () => (
  <OrderFormProvider>
    <OrderItemsProvider>
      <MyComponent />
    </OrderItemsProvider>
  </OrderFormProvider>
)

const MyComponent: FunctionComponent = () => {
  const { orderForm: { items } } = useOrderForm()
  const { updateQuantity, removeItem } = useOrderItems()
  // ...
}
```

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome!
