process.env.NODE_ENV = 'test';

import supertest from 'supertest';
import httpStatus from 'http-status';
import { createHash } from 'crypto';

jest.mock('../src/utils/utils', () => ({
  generateMerchantKey: jest.fn(),
  generateAccountNumber: jest.fn(),
  generateUniqueTransactionReference: jest.fn()
}));

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
const utils = require('../src/utils/utils');

const supabaseFromMock = supabase.from as jest.Mock;
const generateMerchantKeyMock = utils.generateMerchantKey as jest.Mock;
const generateAccountNumberMock = utils.generateAccountNumber as jest.Mock;

const validPayload = {
  first_name: 'Courage',
  middle_name: 'Clyde',
  last_name: 'Bernard',
  email: 'couragebernard7@gmail.com',
  phone_number: '+2348012345678',
  address: '42, My house, Lagos'
};

describe('Merchant Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /create-merchant', () => {
    test('returns 400 when validation fails', async () => {
      const response = await request
        .post('/create-merchant')
        .send({})
        .expect(httpStatus.BAD_REQUEST);

      expect(response.body.error).toBeInstanceOf(Array);
      expect(supabaseFromMock).not.toHaveBeenCalled();
    });

    test('returns 500 when merchant insertion fails', async () => {
      const merchantInsertSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' }
      });
      const merchantInsertSelect = jest.fn().mockReturnValue({
        single: merchantInsertSingle
      });
      const merchantInsert = jest.fn().mockReturnValue({
        select: merchantInsertSelect
      });

      supabaseFromMock.mockImplementation((table: string) => {
        if (table === 'merchants') {
          return { insert: merchantInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      const response = await request
        .post('/create-merchant')
        .send(validPayload)
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body.error).toBe('DB error');
      expect(merchantInsert).toHaveBeenCalledTimes(1);
    });

    test('creates merchant and returns generated keys', async () => {
      const merchantRecord = {
        id: 'merchant_123',
        first_name: 'Ada',
        middle_name: 'M',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        phone_number: '+2348012345678',
        address: '42, Example Street, Lagos',
        preferred_currency: 'NGN'
      };

      const merchantInsertSingle = jest.fn().mockResolvedValue({
        data: merchantRecord,
        error: null
      });
      const merchantInsertSelect = jest.fn().mockReturnValue({
        single: merchantInsertSingle
      });
      const merchantInsert = jest.fn().mockReturnValue({
        select: merchantInsertSelect
      });

      const merchantDeleteEq = jest.fn().mockResolvedValue({ error: null });
      const merchantDelete = jest.fn().mockReturnValue({
        eq: merchantDeleteEq
      });

      const merchantKeysInsert = jest.fn().mockResolvedValue({ error: null });
      const virtualAccountInsert = jest.fn().mockResolvedValue({ error: null });
      const merchantBalanceInsert = jest.fn().mockResolvedValue({ error: null });

      supabaseFromMock.mockImplementation((table: string) => {
        switch (table) {
          case 'merchants':
            return {
              insert: merchantInsert,
              delete: merchantDelete
            };
          case 'merchant_keys':
            return { insert: merchantKeysInsert };
          case 'virtual_accounts':
            return { insert: virtualAccountInsert };
          case 'merchant_balance':
            return { insert: merchantBalanceInsert };
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      });

      generateMerchantKeyMock
        .mockImplementationOnce(() => 'sqpk_test')
        .mockImplementationOnce(() => 'sqsk_test');
      generateAccountNumberMock.mockReturnValue('1234567890');

      const response = await request
        .post('/create-merchant')
        .send(validPayload)
        .expect(httpStatus.CREATED);

      expect(response.body.data.message).toBe('Merchant created successfully!');
      expect(response.body.data.keys).toEqual({
        public_key: 'sqpk_test',
        secret_key: 'sqsk_test'
      });

      expect(merchantInsert).toHaveBeenCalledTimes(1);
      expect(merchantKeysInsert).toHaveBeenCalledTimes(1);
      expect(virtualAccountInsert).toHaveBeenCalledTimes(1);
      expect(merchantBalanceInsert).toHaveBeenCalledTimes(2);

      const hashedSecret =
        merchantKeysInsert.mock.calls[0][0].secret_key;
      const expectedHash = createHash('sha256').update('sqsk_test').digest('hex');

      expect(hashedSecret).toBe(expectedHash);
      expect(hashedSecret).not.toBe('sqsk_test');
    });

    test('rolls back merchant when key creation fails', async () => {
      const merchantRecord = {
        id: 'merchant_rollback',
        first_name: 'Ada',
        middle_name: 'M',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        phone_number: '+2348012345678',
        address: '42, Example Street, Lagos',
        preferred_currency: 'NGN'
      };

      const merchantInsertSingle = jest.fn().mockResolvedValue({
        data: merchantRecord,
        error: null
      });
      const merchantInsertSelect = jest.fn().mockReturnValue({
        single: merchantInsertSingle
      });
      const merchantInsert = jest.fn().mockReturnValue({
        select: merchantInsertSelect
      });

      const merchantDeleteEq = jest.fn().mockResolvedValue({ error: null });
      const merchantDelete = jest.fn().mockReturnValue({
        eq: merchantDeleteEq
      });

      const merchantKeysInsert = jest.fn().mockResolvedValue({
        error: { message: 'Key failure' }
      });

      supabaseFromMock.mockImplementation((table: string) => {
        switch (table) {
          case 'merchants':
            return {
              insert: merchantInsert,
              delete: merchantDelete
            };
          case 'merchant_keys':
            return { insert: merchantKeysInsert };
          default:
            return { insert: jest.fn().mockResolvedValue({ error: null }) };
        }
      });

      generateMerchantKeyMock
        .mockImplementationOnce(() => 'sqpk_test')
        .mockImplementationOnce(() => 'sqsk_test');

      const response = await request
        .post('/create-merchant')
        .send(validPayload)
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body.error).toBe('Key failure');
      expect(merchantDeleteEq).toHaveBeenCalledWith('id', 'merchant_rollback');
    });
  });
});

