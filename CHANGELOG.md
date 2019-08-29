# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- List of items is now retrieved from `OrderManager`.
- `updateItem` optimistically updates Subtotal and Total values in order form.

### Removed

- `itemList` from the API.

## [0.1.0] - 2019-08-23

### Added

- Initial implementation of `OrderItemsProvider` and `useOrderItems`, which returns `itemsList` and `updateItem`.
