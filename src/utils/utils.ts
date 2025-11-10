import { randomBytes } from "crypto";

export const generateMerchantKey = (prefix: string) => `${prefix}_${randomBytes(24).toString('hex')}`;
export const generateUniqueTransactionReference = () => `tx_${randomBytes(24).toString('hex')}`;
export const generateUniquePayoutReference = () => `px_${randomBytes(24).toString('hex')}`;

export const generateAccountNumber = () => {
    let result = "";
    for (var i = 10; i > 0; --i)
      result += '0123456789'[Math.floor(Math.random() * 10)];
    return result;
  };