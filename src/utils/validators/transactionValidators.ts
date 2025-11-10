import { body, query } from 'express-validator';

const allowedCurrencies = ['NGN', 'USD'];
const allowedTransactionTypes = ['card', 'virtual_account'];

const sanitizeCardNumber = (value: string) => value.replace(/\s+/g, '');


export const initializePaymentValidators = [
    query('amount')
        .exists({ checkFalsy: true })
        .withMessage('Amount is required.')
        .bail()
        .isFloat({ gt: 0 })
        .withMessage('Amount must be greater than zero.')
        .bail()
        .toFloat(),
    query('currency')
        .exists({ checkFalsy: true })
        .withMessage('Please select a valid currency.')
        .bail()
        .isIn(allowedCurrencies)
        .withMessage(`Invalid currency selected!`)
        .bail()
        .customSanitizer((value: string) => value.toUpperCase()),
]


export const createTransactionValidators = [
    body('amount')
        .exists({ checkFalsy: true })
        .withMessage('Amount is required.')
        .bail()
        .isFloat({ gt: 0 })
        .withMessage('Amount must be a positive number.')
        .bail()
        .toFloat(),

    body('currency')
        .exists({ checkFalsy: true })
        .withMessage('Currency is required.')
        .bail()
        .isIn(allowedCurrencies)
        .withMessage(`Currency must be one of: ${allowedCurrencies.join(', ')}.`)
        .bail()
        .customSanitizer(value => value.toUpperCase()),

    body('tx_type')
        .exists({ checkFalsy: true })
        .withMessage('Transaction type is required.')
        .bail()
        .isIn(allowedTransactionTypes)
        .withMessage('Transaction type must be either card or virtual_account.'),

    body('tx_desc')
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage('Transaction description must be a string.')
        .bail()
        .trim(),

    body('customer_name')
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage('Customer name must be a string.')
        .bail()
        .trim(),

    body('customer_email')
        .optional({ nullable: true, checkFalsy: true })
        .isEmail()
        .withMessage('Customer email must be a valid email address.')
        .bail()
        .normalizeEmail(),

    body('customer_phone_number')
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage('Customer phone number must be a string.')
        .bail()
        .trim(),

        body('payment_method_id')
        .exists({ checkFalsy: true })
        .withMessage('A payment method is required.')
        .bail(),

    
    body('card_number')
        .if(body('tx_type').equals('card'))
        .exists({ checkFalsy: true })
        .withMessage('Card number is required for card transactions.')
        .bail()
        .isCreditCard()
        .withMessage('Card number must be a valid credit card number.')
        .bail()
        .customSanitizer(sanitizeCardNumber),

    body('card_holder_name')
        .if(body('tx_type').equals('card'))
        .exists({ checkFalsy: true })
        .withMessage('Card holder name is required for card transactions.')
        .bail()
        .isString()
        .withMessage('Card holder name must be a string.')
        .bail()
        .trim(),

    body('card_expiration_date')
        .if(body('tx_type').equals('card'))
        .exists({ checkFalsy: true })
        .withMessage('Card expiration date is required for card transactions.')
        .bail()
        .matches(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/)
        .withMessage('Card expiration date must be in MM/YY format.')
        .bail()
        .customSanitizer(value => value.replace(/\s+/g, '')),

    body('card_verification_code')
        .if(body('tx_type').equals('card'))
        .exists({ checkFalsy: true })
        .withMessage('CVV is required for card transactions.')
        .bail()
        .matches(/^[0-9]{3}$/)
        .withMessage('CVV must be 3 digits.')
        .bail()
        .customSanitizer(value => value.trim()),

    
    body('customer_account_name')
        .if(body('tx_type').equals('virtual_account'))
        .exists({ checkFalsy: true })
        .withMessage('Customer account name is required for virtual account transactions.')
        .bail()
        .isString()
        .withMessage('Customer account name must be a string.')
        .bail()
        .trim(),

    body('customer_account_number')
        .if(body('tx_type').equals('virtual_account'))
        .exists({ checkFalsy: true })
        .withMessage('Customer account number is required for virtual account transactions.')
        .bail()
        .matches(/^[0-9]{6,}$/)
        .withMessage('Customer account number must contain at least 6 digits.')
        .bail()
        .customSanitizer(value => value.trim()),

    body('customer_bank_code')
        .if(body('tx_type').equals('virtual_account'))
        .exists({ checkFalsy: true })
        .withMessage('Customer bank code is required for virtual account transactions.')
        .bail()
        .matches(/^[0-9]{3}$/)
        .withMessage('Customer bank code must be a 3-digit code.')
        .bail()
        .customSanitizer(value => value.trim()),

    body('virtual_account_id')
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage('Virtual account id must be a string.')
        .bail()
        .trim()
];


export const cardSettlementValidators = [
    query('amount')
        .exists({ checkFalsy: true })
        .withMessage('Amount is required.')
        .bail()
        .isFloat({ gt: 0 })
        .withMessage('Amount must be greater than zero.')
        .bail()
        .toFloat(),
    query('currency')
        .exists({ checkFalsy: true })
        .withMessage('Please select a valid currency.')
        .bail()
        .isIn(allowedCurrencies)
        .withMessage(`Invalid currency selected!`)
        .bail()
        .customSanitizer((value: string) => value.toUpperCase()),
    query('id')
        .exists({ checkFalsy: true })
        .withMessage('Transaction ID is required.')
        .bail()
        .isString()
        .withMessage('Transaction ID must be a string.')
        .bail()
        .trim(),
    query('card_number')
        .isCreditCard()
        .withMessage('Card number must be a valid credit card number.')
        .bail()
        .customSanitizer(sanitizeCardNumber),
]