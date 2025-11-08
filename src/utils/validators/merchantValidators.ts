import { body } from 'express-validator';


export const createMerchantValidators = [
    body('first_name')
        .exists({ checkFalsy: true })
        .withMessage('First name is required.')
        .bail()
        .isString()
        .withMessage('First name must be a text.')
        .bail()
        .trim(),
    body('middle_name')
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage('Middle name must be a text.')
        .bail()
        .trim(),
    body('last_name')
        .exists({ checkFalsy: true })
        .withMessage('Last name is required.')
        .bail()
        .isString()
        .withMessage('Last name must be a text.')
        .bail()
        .trim(),
    body('email')
        .exists({ checkFalsy: true })
        .withMessage('Email is required.')
        .bail()
        .isEmail()
        .withMessage('Email must be a valid email address.')
        .bail()
        .normalizeEmail(),
    body('phone_number')
        .exists({ checkFalsy: true })
        .withMessage('Phone number is required.')
        .bail()
        .isString()
        .withMessage('Phone number must be a text.')
        .bail()
        .isMobilePhone('en-NG')
        .withMessage('Phone number must be a valid Nigerian phone number.')
        .trim(),
    body('address')
        .optional({ nullable: true, checkFalsy: true })
        .isString()
        .withMessage('Address must be a text.')
        .bail()
        .trim()
];