import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { supabase } from '../supabase/supabaseClient';

export interface MerchantAuthRequest extends Request {
    merchantKeyRecord?: {
        merchant_id: string;
        public_key: string;
        secret_key: string;
    };
}

const extractSecretKey = (req: Request): string | null => {
    const authHeader = req.header('authorization');
    if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (token.length) {
            return token;
        }
    }

    // const headerSecret = req.header('x-squad-secret-key');
    // if (headerSecret && headerSecret.trim().length) {
    //     return headerSecret.trim();
    // }

    return null;
};

export const authenticateMerchant = async (req: MerchantAuthRequest, res: Response, next: NextFunction) => {
    const publicKey = req.header('x-squad-public-key');
    const secretKey = extractSecretKey(req);

    if (!publicKey || !secretKey) {
        return res.status(401).json({
            data: null,
            error: 'Missing merchant credentials.'
        });
    }

    const { data: keyRecord, error: keyError } = await supabase
        .from('merchant_keys')
        .select('merchant_id, public_key, secret_key, active')
        .eq('public_key', publicKey)
        .single();

    if (keyError || !keyRecord) {
        return res.status(401).json({
            data: null,
            error: 'Invalid merchant credentials.'
        });
    }

    const hashedIncomingSecret = createHash('sha256').update(secretKey).digest('hex');
    if (hashedIncomingSecret !== keyRecord.secret_key) {
        return res.status(401).json({
            data: null,
            error: 'Invalid merchant credentials.'
        });
    }

    if (!keyRecord.active) {
        return res.status(401).json({
            data: null,
            error: 'Merchant is not active.'
        });
    }

    const { data: merchantData, error: merchantDataError } = await supabase
        .from('merchants')
        .select('status')
        .eq('id', keyRecord.merchant_id)
        .single();
    if (merchantDataError || !merchantData) {
        return res.status(500).json({
            data: null,
            error: merchantDataError?.message || 'Failed to fetch merchant.'
        });
    }

    if (merchantData.status !== 'active') {
        return res.status(401).json({
            data: null,
            error: merchantData.status === 'inactive' ? 'Merchant is not active to collect payments. Kindly contact support.' : merchantData.status === 'suspended' ? 'Merchant is suspended. Kindly contact support.' : 'This merchant is not allowed to collect payments. Kindly contact support.'
        });
    }


    req.merchantKeyRecord = keyRecord;

    return next();
};

