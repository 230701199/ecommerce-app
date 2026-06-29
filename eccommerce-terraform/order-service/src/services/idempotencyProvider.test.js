jest.mock('aws-sdk');

const AWS = require('aws-sdk');

const mockPut = jest.fn();
const mockGet = jest.fn();

AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
  put: mockPut,
  get: mockGet
}));

const { checkAndSet, getExistingOrder } = require('./idempotencyProvider');

describe('IdempotencyProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndSet', () => {
    test('should return exists: false when key is new', async () => {
      mockPut.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      const result = await checkAndSet('key-123', 'user-1');

      expect(result).toEqual({ exists: false, existingData: null });
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'asif-order',
          Item: expect.objectContaining({
            orderId: 'IDEMPOTENCY#key-123',
            userId: 'user-1',
            linkedOrderId: null
          }),
          ConditionExpression: 'attribute_not_exists(orderId)'
        })
      );
    });

    test('should include a TTL of 30 seconds from now', async () => {
      mockPut.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      const before = Math.floor(Date.now() / 1000) + 30;
      await checkAndSet('key-456', 'user-2');
      const after = Math.floor(Date.now() / 1000) + 30;

      const putCall = mockPut.mock.calls[0][0];
      expect(putCall.Item.ttl).toBeGreaterThanOrEqual(before);
      expect(putCall.Item.ttl).toBeLessThanOrEqual(after);
    });

    test('should include createdAt as ISO 8601 string', async () => {
      mockPut.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      await checkAndSet('key-789', 'user-3');

      const putCall = mockPut.mock.calls[0][0];
      const createdAt = putCall.Item.createdAt;
      expect(new Date(createdAt).toISOString()).toBe(createdAt);
    });

    test('should return exists: true with existing data when key already exists', async () => {
      const existingRecord = {
        orderId: 'IDEMPOTENCY#key-dup',
        userId: 'user-1',
        linkedOrderId: 'order-abc-123',
        createdAt: '2024-01-15T10:00:00.000Z',
        ttl: 1705312830
      };

      const conditionalError = new Error('ConditionalCheckFailedException');
      conditionalError.code = 'ConditionalCheckFailedException';

      mockPut.mockReturnValue({
        promise: jest.fn().mockRejectedValue(conditionalError)
      });

      mockGet.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Item: existingRecord })
      });

      const result = await checkAndSet('key-dup', 'user-1');

      expect(result.exists).toBe(true);
      expect(result.existingData).toEqual(existingRecord);
    });

    test('should propagate unexpected errors', async () => {
      const unexpectedError = new Error('Service unavailable');
      unexpectedError.code = 'ServiceUnavailableException';

      mockPut.mockReturnValue({
        promise: jest.fn().mockRejectedValue(unexpectedError)
      });

      await expect(checkAndSet('key-err', 'user-1'))
        .rejects.toThrow('Service unavailable');
    });
  });

  describe('getExistingOrder', () => {
    test('should return the item when it exists', async () => {
      const record = {
        orderId: 'IDEMPOTENCY#key-abc',
        userId: 'user-1',
        linkedOrderId: 'order-xyz',
        createdAt: '2024-01-15T10:00:00.000Z',
        ttl: 1705312830
      };

      mockGet.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Item: record })
      });

      const result = await getExistingOrder('key-abc');

      expect(result).toEqual(record);
      expect(mockGet).toHaveBeenCalledWith({
        TableName: 'asif-order',
        Key: { orderId: 'IDEMPOTENCY#key-abc' }
      });
    });

    test('should return null when item does not exist', async () => {
      mockGet.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      const result = await getExistingOrder('key-nonexist');

      expect(result).toBeNull();
    });
  });
});
