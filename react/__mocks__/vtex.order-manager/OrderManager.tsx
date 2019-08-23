export const useOrderManager = () => ({
  enqueue: (f: () => any) => f(),
  listen: jest.fn(),
})
