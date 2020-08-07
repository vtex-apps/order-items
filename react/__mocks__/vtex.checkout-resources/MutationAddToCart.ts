import gql from 'graphql-tag'

export default gql`
  mutation MockAddToCart($items: [ItemInput], $marketingData: MarketingData) {
    addToCart(items: $items, marketingData: $marketingData) {
      items
    }
  }
`
