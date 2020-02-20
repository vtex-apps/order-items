import gql from 'graphql-tag'

export default gql`
  mutation MockAddToCart($items: [ItemInput]) {
    items
  }
`
