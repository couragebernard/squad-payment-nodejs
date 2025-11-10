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
    eq: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then: (resolve: (value: typeof result) => unknown) => resolve(result)
  };
  return builder;
};

describe('Payout Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /payouts', () => {
    test('returns 500 when Supabase fails', async () => {
      const selectMock = jest.fn().mockReturnValue(
        createQueryBuilder({
          data: null,
          error: { message: 'payout fetch failed' },
          count: null
        })
      );

      supabaseFromMock.mockImplementation((table: string) => {
        if (table === 'payouts') {
          return { select: selectMock };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      const response = await request
        .get('/payouts?pageLimit=10&offset=0')
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body.error).toBe('Failed to retrieve payouts');
      expect(selectMock).toHaveBeenCalledTimes(1);
    });

    test('returns payouts data when query succeeds', async () => {
      const payouts = [
        { id: 'po_1', amount: 2000, status: 'pending' },
        { id: 'po_2', amount: 5000, status: 'completed' }
      ];

      const selectMock = jest.fn().mockReturnValue(
        createQueryBuilder({
          data: payouts,
          error: null,
          count: payouts.length
        })
      );

      supabaseFromMock.mockImplementation((table: string) => {
        if (table === 'payouts') {
          return { select: selectMock };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      const response = await request
        .get('/payouts?pageLimit=5&offset=0')
        .expect(httpStatus.OK);

      expect(response.body.data).toEqual(payouts);
      expect(response.body.count).toBe(payouts.length);
      expect(response.body.error).toBeNull();
      expect(selectMock).toHaveBeenCalledTimes(1);
    });
  });
});

