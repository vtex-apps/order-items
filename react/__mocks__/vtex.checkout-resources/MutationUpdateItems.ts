import gql from 'graphql-tag'

export default gql`
  mutation MockMutation($orderItems: [ItemInput]) {
    updateItems(orderItems: $orderItems) {
      items
    }
  }
`
