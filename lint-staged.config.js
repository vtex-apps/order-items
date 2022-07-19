module.exports = {
  '*.{ts,js,tsx,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,graphql,gql}': ['prettier --write'],
  '*.json': ['prettier --write'],
}
