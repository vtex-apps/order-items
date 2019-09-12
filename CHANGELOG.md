# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
