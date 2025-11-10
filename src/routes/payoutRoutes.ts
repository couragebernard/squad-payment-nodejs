import express, { Request, Response } from 'express';
import { supabase } from '../supabase/supabaseClient';
import { authenticateMerchant, MerchantAuthRequest } from '../middleware/authenticateMerchant';
import { PayoutType } from '../types/gen';
import { PostgrestError } from '@supabase/supabase-js';
import { requestPayoutValidators } from '../utils/validators/payoutValidator';
import { matchedData, validationResult } from 'express-validator';
const router = express.Router();

const minimumPayoutAmount = 1000;
const maximumPayoutAmount = 1000000;


//end point to get all payouts (habari staff) and also filter by merchant
router.get('/payouts', async (req: Request, res: Response): Promise<Response<{ data: PayoutType[] | null, error: string | null, count: number | null }>> => {
    const {pageLimit, offset, merchant} = req.query;

     //check if page limit and offset are positive nubers
     if (Number(pageLimit) <= 0 || Number(offset) < 0) {
        return res.status(400).json({
            data: null,
            error: 'Page limit and offset must be positive numbers.'
        });
    }
    
    let supabaseQuery = supabase.from('payouts').select('*', { count: 'exact' });

    if (merchant) {
        supabaseQuery = supabaseQuery.eq('merchant_id', merchant);
    }

    //check if page limit and offset are provided and if they are numbers so they are added to the payload
    if (!isNaN(Number(pageLimit))) {
        const start = Number(offset) ?? 0;
        const end = start + Number(pageLimit) - 1;
        supabaseQuery = supabaseQuery.range(start, end);
    }

    //fetch the data from the db and also count
    const { data, error, count }: { data: PayoutType[] | null, error: PostgrestError | null, count: number | null } = await supabaseQuery
    if (error) {
        return res.status(500).json({
            data:null,
            error: 'Failed to retrieve payouts',
            count: null
        });
    }

    return res.status(200).json({
        data,
        error: null,
        count: count || 0
    });
});


//end point for a merchant to get their payouts
router.get('/my-payouts', authenticateMerchant, async (req: MerchantAuthRequest, res: Response): Promise<Response<{ data: PayoutType[] | null, error: string | null, count: number | null }>> => {
    const {pageLimit, offset} = req.query;

     //check if page limit and offset are positive nubers
     if (Number(pageLimit) <= 0 || Number(offset) < 0) {
        return res.status(400).json({
            data: null,
            error: 'Page limit and offset must be positive numbers.'
        });
    }

    let supabaseQuery = supabase.from('payouts').select('*', { count: 'exact' }).eq('merchant_id', req.merchantKeyRecord?.merchant_id);

  

    //check if page limit and offset are provided and if they are numbers so they are added to the payload
    if (!isNaN(Number(pageLimit))) {
        const start = Number(offset) ?? 0;
        const end = start + Number(pageLimit) - 1;
        supabaseQuery = supabaseQuery.range(start, end);
    }

    //fetch the data from the db and also count
    const { data, error, count }: { data: PayoutType[] | null, error: PostgrestError | null, count: number | null } = await supabaseQuery
    if (error) {
        return res.status(500).json({
            data:null,
            error: 'Failed to retrieve payouts',
            count: null
        });
    }

    return res.status(200).json({
        data,
        error: null,
        count: count || 0
    });
});


//end point to get a single payout by id
router.get('/payouts/:id', async (req: Request, res: Response): Promise<Response<{ data: PayoutType | null, error: string | null }>> => {
    const { id } = req.params;
    const { data, error }: { data: PayoutType | null, error: PostgrestError | null } = await supabase.from('payouts').select('*').eq('id', id).single();
    if (error) {
        return res.status(500).json({ data: null, error: 'Failed to retrieve payout' });
    }
    return res.status(200).json({ data: data as PayoutType, error: null });
});


//endpoint to request payout
router.post('/request-payout', authenticateMerchant, requestPayoutValidators, async (req: MerchantAuthRequest, res: Response): Promise<Response<{ data: PayoutType | null, error: string | null }>> => {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        return res.status(400).json({
            data: null,
            error: validationErrors.array({ onlyFirstError: true }).map(err => err.msg)
        });
    }

    const payload = matchedData(req, {
        locations: ['body'],
        includeOptionals: true
    }) as { amount: number, currency: string, account_name: string, account_number: string, bank_code: string, bank_name: string };

    if (Number(payload.amount) <= 0) {
        return res.status(400).json({
            data: null,
            error: `Amount must be more than ${payload.currency}${payload.amount}.00`
        });
    }


   const { data, error }: { data: PayoutType | null, error: PostgrestError | null } = await supabase.from('payouts').insert({
    amount: payload.amount,
    currency: payload.currency,
    account_name: payload.account_name,
    account_number: payload.account_number,
    bank_code: payload.bank_code,
    bank_name: payload.bank_name,
    merchant_id: req.merchantKeyRecord?.merchant_id
   }).select().single();
   if (error) {
    return res.status(500).json({ data: null, error: 'Failed to request payout' });
   }
   return res.status(200).json({ data: data as PayoutType, error: null });
});


module.exports = router;    