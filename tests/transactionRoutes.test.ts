process.env.NODE_ENV = 'test';

import supertest from 'supertest';
import httpStatus from 'http-status';

jest.mock('../src/supabase/supabaseClient', () => {
  const fromMock = jest.fn();
  return {
    supabase: {
      from: fromMock
    }
  };
});

const app = require('../src/app');
const request = supertest(app);
const { supabase } = require('../src/supabase/supabaseClient');

const supabaseFromMock = supabase.from as jest.Mock;

const createQueryBuilder = (result: { data: unknown; error: unknown; count: number | null }) => {
  const builder = {
    range: jest.fn().mockReturnThis(),
    then: (resolve: (value: typeof result) => unknown) => resolve(result)
  };
  return builder;
};

describe('Transaction Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /transactions', () => {
    test('returns 500 when supabase returns an error', async () => {
      const selectMock = jest.fn().mockReturnValue(
        createQueryBuilder({
          data: null,
          error: { message: 'fetch failed' },
          count: null
        })
      );

      supabaseFromMock.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return { select: selectMock };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      const response = await request
        .get('/transactions?pageLimit=10&offset=0')
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body.error).toBe('fetch failed');
      expect(selectMock).toHaveBeenCalledTimes(1);
    });

    test('returns transactions data when query succeeds', async () => {
      const transactions = [
        { id: 'tx_1', amount: 5000, currency: 'NGN' },
        { id: 'tx_2', amount: 10000, currency: 'USD' }
      ];

      const selectMock = jest.fn().mockReturnValue(
        createQueryBuilder({
          data: transactions,
          error: null,
          count: transactions.length
        })
      );

      supabaseFromMock.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return { select: selectMock };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      const response = await request
        .get('/transactions?pageLimit=5&offset=0')
        .expect(httpStatus.OK);

      expect(response.body.data).toEqual(transactions);
      expect(response.body.count).toBe(transactions.length);
      expect(response.body.error).toBeNull();
      expect(selectMock).toHaveBeenCalledTimes(1);
    });
  });
});

