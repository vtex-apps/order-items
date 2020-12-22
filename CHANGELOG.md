# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Support for `salesChannel` in `addItems` function.

## [0.9.3] - 2020-12-22
### Fixed
- Make it possible to add more of the same item with assembly options.

## [0.9.2] - 2020-11-24
### Fixed
- Aggregate order form messages on every order form operation.

## [0.9.1] - 2020-10-05
### Changed
- Add log if any error occurs in the add/update items mutations.

## [0.9.0] - 2020-09-25
### Added
- `setManualPrice` function which uses and exposes `SetManualPrice` mutation.

## [0.8.2] - 2020-09-17
### Fixed
- Item comparison check when adding/updating an item.

## [0.8.1] - 2020-09-16
### Changed
- Lint project files.

## [0.8.0] - 2020-09-16
### Fixed
- Consecutive `addItem` calls incrementing repeated items.

## [0.7.7] - 2020-08-07
### Fixed
- Error adding multiple items to cart when any of the items are already in the cart.

## [0.7.6] - 2020-06-26
### Fixed
- Error on the add to cart function if one of the items wasn't successfully added to the cart.

## [0.7.5] - 2020-05-08
### Fixed
- Optimistic calculation of totalizers not taking into account an item's `unitMultiplier`.

## [0.7.4] - 2020-05-06
### Changed
- Undo rollback of tasks.

## [0.7.3] - 2020-05-05
### Fixed
- Lint issues.

## [0.7.2] - 2020-05-05
### Fixed
- Items not updated to previous state when either add or update mutations returned an error.

## [0.7.1] - 2020-04-27
### Fixed
- Marketing data being `undefined` when `addItem` was called without the second argument.

## [0.7.0] - 2020-03-06
### Added
- Support for `marketingData` argument to be received by `addToCart`.

## [0.6.0] - 2020-02-20
### Added
- `addItem` function to `OrderItemsContext`.

### Changed
- All pending operations are now cached in `localStorage` in order to enable offline-interactions.
- Order form is now cached in `localStorage`.

## [0.5.2] - 2020-02-19
### Changed
- Use the separate `default export`s from `vtex.checkout-resources`.

## [0.5.1] - 2019-11-25
### Changed
- Treats case when OrderManager fails to fetch order form and provides a better error message when that happens.

## [0.5.0] - 2019-11-06
### Changed
- Enqueued `updateItem` mutations are now merged together to prevent the task queue from growing too much.

## [0.4.4] - 2019-10-10
### Changed
- API methods are not debounced anymore.

## [0.4.3] - 2019-10-10
### Fixed
 Optimistic calculation of totalizers when some kinds of discounts are applied.

## [0.4.2] - 2019-10-04
### Changed
- Small code refactor.

## [0.4.1] - 2019-09-16
### Fixed
- Optimistic calculation of the totalizers doesn't consider unavailable items anymore.

## [0.4.0] - 2019-09-13
### Changed
- `updateItem` function has been split into `updateQuantity` and `removeItem`, and both functions are debounced.

## [0.3.1] - 2019-09-10
### Changed
- Moved `README.md` to `/docs` folder to comply with VTEX IO docs format.

## [0.3.0] - 2019-09-05
### Changed
- `updateItem` now receives an `Partial<Item>` object as argument.

## [0.2.1] - 2019-09-05
### Changed
- GraphQL mutation is now imported from `checkout-resources`.

## [0.2.0] - 2019-08-29
### Changed
- List of items is now retrieved from `OrderManager`.
- `updateItem` optimistically updates Subtotal and Total values in order form.

### Removed
- `itemList` from the API.

## [0.1.0] - 2019-08-23
### Added
- Initial implementation of `OrderItemsProvider` and `useOrderItems`, which returns `itemsList` and `updateItem`.
