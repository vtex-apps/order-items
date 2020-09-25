import gql from 'graphql-tag'

export default gql`
  mutation MockSetManualPrice($manualPriceInput: ManualPriceInput!) {
    setManualPrice(input: $manualPriceInput) {
      items
    }
  }
`
