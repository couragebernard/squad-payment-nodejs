import express, { Request, Response } from 'express';
import { matchedData, validationResult } from 'express-validator';
import { authenticateMerchant, MerchantAuthRequest } from '../middleware/authenticateMerchant';
import { supabase } from '../supabase/supabaseClient';
import { CreateTransactionType, MerchantBalanceType, TransactionType } from '../types/gen';
import { logAuditEvent } from '../utils/auditLogger';
import {  generateUniqueTransactionReference } from '../utils/utils';
import { cardSettlementValidators, createTransactionValidators } from '../utils/validators/transactionValidators';
import { PostgrestError } from '@supabase/supabase-js';
const router = express.Router();

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

router.get('/transactions', async (req: Request, res: Response) => {
    const {pageLimit, offset} = req.query;

     //check if page limit and offset are positive nubers
     if (Number(pageLimit) <= 0 || Number(offset) < 0) {
        return res.status(400).json({
            data: null,
            error: 'Page limit and offset must be positive numbers.'
        });
    }

    let supabaseQuery = supabase.from('transactions').select('*', { count: 'exact' });

  

    //check if page limit and offset are provided and if they are numbers so they are added to the payload
    if (!isNaN(Number(pageLimit))) {
        const start = Number(offset) ?? 0;
        const end = start + Number(pageLimit) - 1;
        supabaseQuery = supabaseQuery.range(start, end);
    }

    //fetch the data from the db and also count
    const { data, error, count } = await supabaseQuery
    if (error) {
        return res.status(500).json({
            data:null,
            error: error.message || 'Failed to fetch transactions',
            count: null
        });
    }

    return res.status(200).json({
        data,
        error: null,
        count: count || 0
    });
});


//endpoint to get a single transaction by their id.
router.get('/transactions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single();
    if (error) {
        //throw an error if the transaction is not found
        if (error.code === '22P02') {
            return res.status(404).json({
                data: null,
                error: 'Transaction not found. Kindly check the id and try again.'
            });
        }
        return res.status(500).json({
            data: null,
            error: error.message || 'Failed to fetch transaction'
        });
    }
    return res.status(200).json({
        data,
        error: null
    });
});


//endpoint for the customer/user to initialize a payment url
router.get("/initialize-payment-url", authenticateMerchant, async (req: MerchantAuthRequest, res: Response) => {
    const { amount, currency } = req.query;

    if (Number(amount) <= 0) {
        return res.status(400).json({
            data: null,
            error: `Amount must be more than ${currency}${amount}.00`
        }); 
    }

   
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        return res.status(400).json({
            data: null,
            error: validationErrors.array({ onlyFirstError: true }).map(err => err.msg)
        });
    }
    const merchantId = req.merchantKeyRecord?.merchant_id;
    const { data:virtualAccData, error:virtualAccError } = await supabase.from('virtual_accounts').select('*').eq('merchant_id', merchantId).single();
    if (virtualAccError) {
      
        return res.status(500).json({
            data: null,
            error: virtualAccError.message || 'Failed to fetch virtual account'
        });
    }
    const transactionReference = generateUniqueTransactionReference(); 
    
    //fetch the payment methods for the currency and if it is available currently
        const { data: paymentMethods, error: paymentMethodsError } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('available', true)
            .contains('allowed_currencies', [currency]);
    if (paymentMethodsError) {
       
        return res.status(500).json({
            data: null,
            error: paymentMethodsError.message || 'Failed to fetch payment methods'
        });
    }
    if (paymentMethods.length === 0) {
        return res.status(400).json({
            data: null,
            error: 'No payment methods available for this currency. Kindly try again later.'
        });
    }

    //create the transaction 
    const { data:transactionData, error:transactionError } = await supabase.from('transactions').insert({
        merchant_id: merchantId,
        amount: amount,
        currency: currency,
        tx_ref: transactionReference,
    }).select().single();
    if (transactionError) {
        
        return res.status(500).json({
            data: null,
            error: transactionError.message || 'Failed to create transaction'
        });
    }
    return res.status(200).json({
        data: {
            payment_url: `${process.env.PAYMENT_DOMAIN}/pay?amount=${amount}&currency=${currency}&id=${transactionData.id}`,
            virtual_account:{
                id: virtualAccData.id,
                account_number: virtualAccData.account_number,
                account_name: virtualAccData.account_name,
                bank_code: virtualAccData.bank_code,
                bank_name: virtualAccData.bank_name
            },
            payment_methods: paymentMethods
        },
        error: null
    });
});


//endpoint for a user to  pay
router.post(
    '/pay',
    authenticateMerchant,
    createTransactionValidators,
    async (req: MerchantAuthRequest, res: Response) => {
        const {id} = req.query;
        if (!id) {
            return res.status(400).json({
                data: null,
                error: 'Transaction ID is required.'
            });
        }


        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty()) {
            return res.status(400).json({
                data: null,
                error: validationErrors.array({ onlyFirstError: true }).map(err => err.msg)
            });
        }

        if (!req.merchantKeyRecord?.merchant_id) {
            return res.status(401).json({
                data: null,
                error: 'Unable to resolve merchant credentials.'
            });
        }

        const payload = matchedData(req, {
            locations: ['body'],
            includeOptionals: true
        }) as CreateTransactionType;


        const { data: transactionData, error: transactionDataError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .single();
        if (transactionDataError || !transactionData) {
            return res.status(500).json({
                data: null,
                error: 'This payment reference does not exist. Please start again.'
            });
        }

        //check if the transaction is already settled
        if (transactionData.status === 'success') {
            return res.status(400).json({
                data: null,
                error: 'Transaction already settled.'
            });
        }


        //check if the transaction amount is the same as the payload amount
        if (transactionData.amount !== Number(payload.amount)) {
            return res.status(400).json({
                data: null,
                error: 'Transaction amount does not match.'
            });
        }

        //check if the transaction currency is the same as the payload currency
        if (transactionData.currency !== payload.currency) {
            return res.status(400).json({
                data: null,
                error: 'Transaction currency does not match.'
            });
        }


        const {data:paymentMethodData, error:paymentMethodDataErr} = await supabase.from("payment_methods").select("*").eq("id",payload.payment_method_id).eq("name",payload.tx_type).single()

        if (paymentMethodDataErr || !paymentMethodData) {
            return res.status(400).json({
                data: null,
                error: 'Payment Method not found'
            });
        }

        if (!paymentMethodData.allowed_currencies.includes(payload.currency)) {
            return res.status(400).json({
                data: null,
                error: 'You can not use this payment method for this currency!'
            });
        }
        
            if (!paymentMethodData.available) {
                return res.status(400).json({
                    data: null,
                    error: 'Payment Method is not available currently. Kindly try again later.'
                });
            }

            if (paymentMethodData.minimum_amount > Number(payload.amount)) {
                return res.status(400).json({
                    data: null,
                    error: 'Amount is less than the minimum amount for this payment method.'
                });
            }

            if (paymentMethodData.maximum_amount < Number(payload.amount)) {
                return res.status(400).json({
                    data: null,
                    error: 'Amount is greater than the maximum amount for this payment method.'
                });
            }


        const amount = Number(payload.amount);
        const txType = payload.tx_type;
        const currency = payload.currency;
        const feeRate = paymentMethodData.fee_type === 'percentage' ? paymentMethodData.fee_rate : paymentMethodData.fee_type === 'flat' ? paymentMethodData.fee_rate : 0;
        const status = txType === 'card' ? 'pending' : txType === 'virtual_account' ? 'success' : 'pending';
        const feeAmount = roundToTwo(paymentMethodData.fee_type === 'percentage' ? (paymentMethodData.fee_rate * amount) / 100 : paymentMethodData.fee_type === 'flat' ? paymentMethodData.fee_amount : 0);
        const netAmount = roundToTwo(amount - feeAmount);
        const merchantId = req.merchantKeyRecord.merchant_id;

        const baseTransactionRecord: Record<string, unknown> = {
            merchant_id: merchantId,
            amount,
            currency,
            tx_desc: payload.tx_desc ?? null,
            tx_type: txType,
            status,
            fee_rate: feeRate,
            fee_amount: feeAmount,
            fee_type: paymentMethodData.fee_type,
            total_amount: netAmount,
            customer_name: payload.customer_name ?? null,
            customer_email: payload.customer_email ?? null,
            customer_phone_number: payload.customer_phone_number ?? null,
            settled_at: txType === 'card' ? null : txType === 'virtual_account' ? new Date() : null
        };

        if (txType === 'card') {
            const sanitizedCardNumber = (payload.card_number ?? '').replace(/\s+/g, '');
            Object.assign(baseTransactionRecord, {
                card_last_four_digits: sanitizedCardNumber.slice(-4),
                card_holder_name: payload.card_holder_name ?? null,
                card_expiration_date: payload.card_expiration_date ?? null,
                card_verification_code: null
            });
        } else {
            Object.assign(baseTransactionRecord, {
                card_last_four_digits: null,
                card_holder_name: null,
                card_expiration_date: null,
                card_verification_code: null,
                customer_name: payload.customer_name ?? payload.customer_account_name ?? null,
                customer_phone_number: payload.customer_phone_number ?? null,
                virtual_account_id: payload.virtual_account_id ?? null
            });
        }

        const { data:transaction,error: transactionError } = await supabase
            .from('transactions')
            .update(baseTransactionRecord)
            .eq('id', id)
            .select()
            .single();

        if (transactionError) {
            await logAuditEvent({
                event_type: 'TRANSACTION_UPDATE_FAILED',
                db_table: 'transactions',
                table_id: id as string,
                status: 'failure',
                attempted_changes: baseTransactionRecord,
                error_message: transactionError.message,
                context: {
                    route: 'POST /pay'
                },
                user_type: 'merchant',
                user_id: merchantId
            });
            return res.status(500).json({
                data: null,
                error: transactionError?.message || 'Failed to update transaction.'
            });
        }

        const { data: merchantBalances, error: merchantBalanceError } = await supabase
            .from('merchants')
            .select('available_balance, pending_settlement_balance')
            .eq('id', merchantId)
            .single();

        if (merchantBalanceError || !merchantBalances) {
            await supabase.from('transactions').delete().eq('id', transaction.id);
            await logAuditEvent({
                event_type: 'MERCHANT_BALANCE_FETCH_FAILED',
                db_table: 'merchants',
                table_id: merchantId,
                status: 'failure',
                attempted_changes: {
                    available_balance_delta: txType === 'virtual_account' ? netAmount : 0,
                    pending_settlement_delta: txType === 'card' ? netAmount : 0
                },
                error_message: merchantBalanceError?.message ?? 'Merchant balances not found.',
                context: {
                    route: 'POST /pay',
                    transaction_id: transaction.id
                },
                user_type: 'merchant',
                user_id: merchantId
            });
            return res.status(500).json({
                data: null,
                error: merchantBalanceError?.message || 'Failed to fetch merchant balances.'
            });
        }

        const updatedBalances = {
            available_balance: txType === 'virtual_account'
                ? roundToTwo((merchantBalances.available_balance ?? 0) + netAmount)
                : merchantBalances.available_balance,
            pending_settlement_balance: txType === 'card'
                ? roundToTwo((merchantBalances.pending_settlement_balance ?? 0) + netAmount)
                : merchantBalances.pending_settlement_balance
        };

        const { error: balanceUpdateError } = await supabase
            .from('merchants')
            .update(updatedBalances)
            .eq('id', merchantId);

        if (balanceUpdateError) {
            await supabase.from('transactions').delete().eq('id', id);
            await logAuditEvent({
                event_type: 'MERCHANT_BALANCE_UPDATE_FAILED',
                db_table: 'merchants',
                table_id: merchantId,
                status: 'failure',
                attempted_changes: updatedBalances,
                error_message: balanceUpdateError.message,
                context: {
                    route: 'POST /pay',
                    transaction_id: transaction.id
                },
                user_type: 'merchant',
                user_id: merchantId
            });
            return res.status(500).json({
                data: null,
                error: balanceUpdateError.message || 'Failed to update merchant balances.'
            });
        }

        const responsePayload = {
            id: transaction.id,
            tx_ref: transaction.tx_ref,
            tx_type: transaction.tx_type,
            status,
            amount: transaction.amount,
            currency: transaction.currency,
            fee_rate: transaction.fee_rate,
            fee_amount: transaction.fee_amount,
            total_amount: transaction.total_amount,
            tx_desc: transaction.tx_desc,
            card_last_four_digits: transaction.card_last_four_digits,
            card_holder_name: transaction.card_holder_name,
            card_expiration_date: transaction.card_expiration_date,
            customer_name: transaction.customer_name,
            customer_email: transaction.customer_email,
            customer_phone_number: transaction.customer_phone_number
        };

        return res.status(201).json({
            data: {
                message: 'Payment was successful!',
                transaction: responsePayload
            },
            error: null
        });
    }
);



//webhook to update the merchant and transaction details once a card settlement has occured
router.patch('/card-settlement', authenticateMerchant, cardSettlementValidators, async (req: MerchantAuthRequest, res: Response) => {

    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        return res.status(400).json({
            data: null,
            error: validationErrors.array({ onlyFirstError: true }).map(err => err.msg)
        });
    }

    const payload = matchedData(req, {
        locations: ['query'],
        includeOptionals: true
    }) as { amount: number, id: string, currency: string };

    const { data: transactionData, error: transactionDataError }: { data: TransactionType | null, error: PostgrestError | null } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', payload.id)
        .single();
    if (transactionDataError || !transactionData) {
     
        return res.status(500).json({
            data: null,
            error: 'Transaction not found.'
        });
    }
    if (transactionData.status === 'success') {
        return res.status(400).json({
            data: null,
            error: 'Transaction already settled.'
        });
    }
    if (transactionData.amount !== Number(payload.amount)) {
        return res.status(400).json({
            data: null,
            error: 'Transaction amount does not match.'
        });
    }
    if (transactionData.currency !== payload.currency) {
        return res.status(400).json({
            data: null,
            error: 'Transaction currency does not match.'
        });
    }
    if (transactionData.tx_type !== 'card') {
        return res.status(400).json({
            data: null,
            error: 'Transaction is not a card transaction.'
        });
    }
    const { data: merchantBalances, error: merchantBalanceError }: { data: MerchantBalanceType | null, error: PostgrestError | null } = await supabase
        .from('merchants')
        .select('available_balance, pending_settlement_balance')
        .eq('id', transactionData.merchant_id)
        .single();
    if (merchantBalanceError || !merchantBalances) {
       
        return res.status(500).json({
            data: null,
            error: 'Failed to fetch merchant balances.'
        });
    }

       
        const { error: balanceUpdateError } = await supabase
            .from('merchants')
            .update({
                available_balance: roundToTwo((merchantBalances.available_balance ?? 0) + transactionData.total_amount),
                pending_settlement_balance: roundToTwo((merchantBalances.pending_settlement_balance ?? 0) - transactionData.total_amount)
            
            })
            .eq('id', transactionData.merchant_id);
        if (balanceUpdateError) {
            await logAuditEvent({
                event_type: 'MERCHANT_BALANCE_UPDATE_FAILED',
                db_table: 'merchants',
                table_id: transactionData.merchant_id,
                status: 'failure',
                attempted_changes: {
                    available_balance: roundToTwo((merchantBalances.available_balance ?? 0) + transactionData.total_amount),
                    pending_settlement_balance: roundToTwo((merchantBalances.pending_settlement_balance ?? 0) - transactionData.total_amount)
                },
                error_message: balanceUpdateError.message,
                context: {
                    route: 'PATCH /card-settlement',
                    transaction_id: transactionData.id
                },
                user_type: 'system'
            });
            return res.status(500).json({
                data: null,
                error: 'Failed to update merchant balances.'
            });
        }


        const { error: transactionUpdateError } = await supabase
            .from('transactions')
            .update({
                status: 'success',
                settled_at: new Date()
            })
            .eq('id', transactionData.id);
        if (transactionUpdateError) {
            await logAuditEvent({
                event_type: 'TRANSACTION_STATUS_UPDATE_FAILED',
                db_table: 'transactions',
                table_id: transactionData.id,
                status: 'failure',
                attempted_changes: {
                    status: 'success',
                    settled_at: new Date()
                },
                error_message: transactionUpdateError.message,
                context: {
                    route: 'PATCH /card-settlement'
                },
                user_type: 'system'
            });
            return res.status(500).json({
                data: null,
                error:  'Failed to update transaction status.'
            });
        }

        return res.status(200).json({
            data: {
                message: 'Card settlement was successful!',
                transaction: transactionData
            },
            error: null
        });
    }
);



module.exports = router;
