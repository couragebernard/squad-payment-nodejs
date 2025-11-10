import { body, query } from 'express-validator';

const allowedCurrencies = ['NGN', 'USD'];



export const requestPayoutValidators = [
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
    body('account_name')
        .exists({ checkFalsy: true })
        .withMessage('Account name is required.')
        .bail()
        .isString()
        .withMessage('Account name must be a string.')
        .bail()
        .trim(),
    body('account_number')
        .exists({ checkFalsy: true })
        .withMessage('Account number is required.')
        .bail()
        .isString()
        .withMessage('Account number must be a string.')
        .bail()
        .trim(),
    body('bank_code')
        .exists({ checkFalsy: true })
        .withMessage('Bank code is required.')
        .bail()
        .isString()
        .withMessage('Bank code must be a string.')
        .bail()
        .trim(),
    body('bank_name')
        .exists({ checkFalsy: true })
        .withMessage('Bank name is required.')
        .bail()
        .isString()
        .withMessage('Bank name must be a string.')
        .bail()
        .trim()

]