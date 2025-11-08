/**
 * Database Type Definitions
 * These types correspond to the database schema
 */

export type TransactionType = 'card' | 'virtual_account';
export type TransactionStatus = 'pending' | 'success';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Transaction entity - represents a payment transaction
 */
export interface Transaction {
    id: number;
    reference: string;
    type: TransactionType;
    amount: number;
    currency: string;
    description: string | null;
    status: TransactionStatus;
    fee_rate: number;
    fee_amount: number;
    net_amount: number;
    payout_id: number | null;
    settled_at: Date | null;
    created_at: Date;
    updated_at: Date;
    
    // Card-specific fields (nullable, only for card type)
    card_last_four: string | null;
    cardholder_name: string | null;
    card_expiry: string | null;
    card_cvv: string | null;
    
    // Virtual Account-specific fields (nullable, only for virtual_account type)
    customer_account_name: string | null;
    customer_account_number: string | null;
    customer_bank_code: string | null;
}

/**
 * Payout entity - represents a payout to merchant
 */
export interface Payout {
    id: number;
    amount: number;
    currency: string;
    status: PayoutStatus;
    created_at: Date;
    updated_at: Date;
}

/**
 * Input types for creating transactions
 */
export interface CreateCardTransactionInput {
    amount: string;
    description: string;
    card_number: string;
    cardholder_name: string;
    card_expiry: string;
    cvv: string;
    currency: string;
}

export interface CreateVirtualAccountTransactionInput {
    amount: string;
    description: string;
    customer_account_name: string;
    customer_account_number: string;
    customer_bank_code: string;
    currency: string;
}

/**
 * Input type for settlement requests
 */
export interface SettlementRequestInput {
    transaction_amount: string;
    transaction_reference: string;
    card_number: string;
    currency: string;
}

/**
 * Balance information
 */
export interface MerchantBalance {
    available_balance: number;
    pending_settlement: number;
    currency: string;
}

