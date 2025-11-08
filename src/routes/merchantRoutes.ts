import express, { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { matchedData, validationResult } from 'express-validator';
import { supabase } from '../supabase/supabaseClient';
import { createMerchantValidators } from '../utils/validators/merchantValidators';
import { CreateMerchantType } from '../types/gen';
const router = express.Router();

const generateMerchantKey = (prefix: string) => `${prefix}_${randomBytes(24).toString('hex')}`;

router.post('/create-merchant', createMerchantValidators, async (req: Request, res: Response) => {
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
        available_balance: 0,
        pending_settlement_balance: 0,
        preferred_currency: 'NGN'
    };


    const { data, error } = await supabase.from('merchants').insert(merchantRecord).select().single();
    if (error) {
        return res.status(500).json({
            data: null,
            error: error.message || 'Merchant registration failed. Kindly try again.'
        });
    }

    const public_key = generateMerchantKey('sqpk');
    const secret_key = generateMerchantKey('sqsk');

    const { error: keysError } = await supabase.from('merchant_keys').insert({ merchant_id: data.id, public_key, secret_key });
    if (keysError) {
        const { error: deleteError } = await supabase.from('merchants').delete().eq('id', data.id);
        if (deleteError) {
            return res.status(500).json({
                data: null,
                error: deleteError.message || 'Merchant deletion failed. Kindly contact support.'
            });
        }

        return res.status(500).json({
            data: null,
            error: keysError.message || 'Merchant keys registration failed. Kindly try again.'
        });
    }

    return res.status(201).json({
        data: 'Merchant created successfully!',
        error: null
    });
});

router.get('/merchants', async (_req: Request, res: Response) => {
    const { pageLimit, offset, search } = _req.query;

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
            error: error.message,
            count: null
        });
    }
    return res.status(200).json({
        data,
        error: null,
        count
    });
});

module.exports = router;
