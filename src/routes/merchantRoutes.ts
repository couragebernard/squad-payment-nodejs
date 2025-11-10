import express, { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { matchedData, validationResult } from 'express-validator';
import { supabase } from '../supabase/supabaseClient';
import { createMerchantValidators } from '../utils/validators/merchantValidators';
import { CreateMerchantType, MerchantBalanceType } from '../types/gen';
import { generateAccountNumber, generateMerchantKey } from '../utils/utils';
import { PostgrestError } from '@supabase/supabase-js';
import { authenticateMerchant, MerchantAuthRequest } from '../middleware/authenticateMerchant';
const router = express.Router();


//endpoint to register a new merchant.
router.post('/create-merchant', createMerchantValidators, async (req: Request, res: Response) => {

    //vlidate our request payload
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        return res.status(400).json({
            data: null,
            error: validationErrors.array({ onlyFirstError: true }).map(err => err.msg)
        });
    }

    const merchantPayload = matchedData(req, {
        locations: ['body'],
        includeOptionals: true
    }) as CreateMerchantType;
   

    const merchantRecord = {
        first_name: merchantPayload.first_name,
        middle_name: merchantPayload.middle_name ?? null,
        last_name: merchantPayload.last_name,
        email: merchantPayload.email,
        phone_number: merchantPayload.phone_number,
        address: merchantPayload.address ?? null,
        preferred_currency: 'NGN'
    };


    const { data, error } = await supabase.from('merchants').insert(merchantRecord).select().single();
    if (error) {
        return res.status(500).json({
            data: null,
            error: 'Merchant registration failed. Kindly try again.'
        });
    }

    const public_key = generateMerchantKey('sqpk');
    const secret_key = generateMerchantKey('sqsk');
    const hashedSecretKey = createHash('sha256').update(secret_key).digest('hex');

    const { error: keysError } = await supabase.from('merchant_keys').insert({
        merchant_id: data.id,
        public_key,
        secret_key: hashedSecretKey
    });
    if (keysError) {
        const { error: deleteError } = await supabase.from('merchants').delete().eq('id', data.id);
        if (deleteError) {
            return res.status(500).json({
                data: null,
                error:  'Merchant deletion failed. Kindly contact support.'
            });
        }

        return res.status(500).json({
            data: null,
            error:  'Merchant keys registration failed. Kindly try again.'
        });
    }

    //create a virtual account for the merchant
    const accountNumber = generateAccountNumber();
    const { error: virtualAccountError } = await supabase.from('virtual_accounts').insert({
        merchant_id: data.id,
        account_number: accountNumber,
        account_name: `Habaripay | ${data.first_name} ${data.middle_name ?? ''} ${data.last_name}`,
        bank_code: '058',
        bank_name: 'GTB'
    });
    if (virtualAccountError) {
        const { error: deleteError } = await supabase.from('merchants').delete().eq('id', data.id);
        if (deleteError) {
            return res.status(500).json({
                data: null,
                error:  'Merchant deletion failed. Kindly contact support.'
            });
        }
        return res.status(500).json({
            data: null,
            error: 'Virtual account creation failed. Kindly try again.'
        });
    }


    //create a usd and naira balance for the merchant
    const currencies = ['NGN', 'USD'];
    for (const currency of currencies) {
        const { error: merchantBalanceError } = await supabase.from('merchant_balance').insert({
            merchant_id: data.id,
            currency: currency,
            available_balance: 0,
            pending_settlement_balance: 0
        });
        if (merchantBalanceError) {
            return res.status(500).json({
                data: null,
                error:  'Merchant balance creation failed. Kindly try again.'
            });
        }
    }

    //sending the keys so the merchant can view and use to make requests to the server. The merchant can only view the keys once after creation
    return res.status(201).json({
        data: {
            message: 'Merchant created successfully!',
            merchant: data,
            keys: {
                public_key,
                secret_key
            }
        },
        error: null
    });
});


//endpoint to get all merchants.
router.get('/merchants', async (req: Request, res: Response) => {
    const { pageLimit, offset, search } = req.query;

    //check if page limit and offset are positive nubers
    if (Number(pageLimit) <= 0 || Number(offset) < 0) {
        return res.status(400).json({
            data: null,
            error: 'Page limit and offset must be positive numbers.'
        });
    }

    let supabaseQuery = supabase.from('merchants').select('*', { count: 'exact' });

    if (typeof search === 'string' && search.trim().length > 0) {
        supabaseQuery = supabaseQuery.ilike('first_name', `%${search.trim()}%`);
    }


    //check if page limit and offset are provided and if they are numbers so they are added to the payload
    if (!isNaN(Number(pageLimit))) {
        const start = Number(offset) ?? 0;
        const end = start + Number(pageLimit) - 1;
        supabaseQuery = supabaseQuery.range(start, end);
    }

    //fetch the data from the db and also count
    const { data, error, count } = await supabaseQuery

//throw an error if there is one during fetch
    if (error) {
        return res.status(500).json({
            data:null,
            error:  'Failed to retrieve merchants. Kindly try again.',
            count: null
        });
    }
    return res.status(200).json({
        data,
        error: null,
        count
    });
});


//endpoint to get a single merchant by their id.
router.get('/merchants/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { data, error } = await supabase.from('merchants').select('*').eq('id', id).single();
    if (error) {

        if (error.code === '22P02') {
            return res.status(404).json({
                data: null,
                error: 'Merchant not found. Kindly check the id and try again.'
            });
        }

        return res.status(500).json({
            data: null,
            error:  'Merchant not found'
        });
    }
    return res.status(200).json({
        data,
        error: null
    });
});



//fetch merchant balance
router.get('/merchants/:id/balance', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { data, error }: { data: MerchantBalanceType[] | null, error: PostgrestError | null } = await supabase.from('merchant_balance').select('*').eq('merchant_id', id);
    if (error) {
        return res.status(500).json({
            data: null,
            error: 'Failed to retrieve merchant balances. Kindly try again.'
        });
    }
    return res.status(200).json({
        data,
        error: null
    });
});

//endpoint for a merchant to get their balance
router.get('/balance', authenticateMerchant, async (req: MerchantAuthRequest, res: Response, next: NextFunction) => {
    const merchantId = req.merchantKeyRecord?.merchant_id;
    if (!merchantId) {
        return res.status(401).json({
            data: null,
            error: 'Unauthorized. Kindly login and try again.'
        });
    }
    next();
    const { data, error }: { data: MerchantBalanceType[] | null, error: PostgrestError | null } = await supabase.from('merchant_balance').select('*').eq('merchant_id', merchantId);
    if (error) {
        return res.status(500).json({
            data: null,
            error:  'Failed to retrieve merchant balances. Kindly try again.'
        });
    }
    return res.status(200).json({
        data,
        error: null
    });
});


//endpoint for merchant to get their balance
router.get('/balance', authenticateMerchant, async (req: MerchantAuthRequest, res: Response) => {
    const merchantId = req.merchantKeyRecord?.merchant_id;
    if (!merchantId) {
        return res.status(401).json({
            data: null,
            error: 'Unauthorized. Kindly login and try again.'
        });
    }
    const { data, error }: { data: MerchantBalanceType[] | null, error: PostgrestError | null } = await supabase.from('merchant_balance').select('*').eq('merchant_id', merchantId);
    if (error) {
        return res.status(500).json({
            data: null,
            error: 'Failed to retrieve merchant balances. Kindly try again.'
        });
    }
    return res.status(200).json({
        data,
        error: null
    });
});


module.exports = router;
