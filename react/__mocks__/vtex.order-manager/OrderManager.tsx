export const useOrderManager = () => ({
  enqueue: (f: (CancellationToken: any) => any) => f({ cancelled: false }),
  listen: jest.fn(),
})
