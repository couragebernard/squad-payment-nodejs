import express, { Request, Response } from 'express';
import { supabase } from '../supabase/supabaseClient';
const router = express.Router();


router.post('/create-merchant', async (req: Request, res: Response) => {
    const { first_name, middle_name, last_name , email, phone, address } = req.body;
    const { data, error } = await supabase.from('merchants').insert({ first_name, middle_name, last_name, email, phone, address }).select().single();
    if (error) {
        return res.status(500).send({
            data:null,
            error: error.message || 'Merchant registration failed. Kindly try again.'
        });
    }
    return res.status(200).send({
        data,
        error: null
    });
});

router.get('/merchants', async (_req: Request, res: Response) => {
    const { data, error } = await supabase.from('merchants').select('*');
    if (error) {
        return res.status(500).send({
            data:null,
            error: error.message
        });
    }
    return res.status(200).send({
        data,
        error: null
    });
});

module.exports = router;
