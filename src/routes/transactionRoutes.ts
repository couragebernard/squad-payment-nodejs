import express, { Request, Response } from 'express';
import { supabase } from '../supabase/supabaseClient';
const router = express.Router();

router.get('/transactions', async (_req: Request, res: Response) => {
    const { data, error } = await supabase.from('transactions').select('*');
    if (error) {
        return res.status(500).send({
            data:null,
            error: error.message || 'Failed to fetch transactions'
        });
    }
    return res.status(200).send({
        data,
        error: null
    });
});

module.exports = router;
