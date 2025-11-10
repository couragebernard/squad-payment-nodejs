export type CreateMerchantType = {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    email: string;
    phone_number: string;
    address?: string | null;
}

export type CreateTransactionType = {
    amount: number;
    currency: 'NGN' | 'USD';
    tx_desc?: string | null;
    tx_type: 'card' | 'virtual_account';
    payment_method_id:string;
    card_number?: string;
    card_holder_name?: string;
    card_expiration_date?: string;
    card_verification_code?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone_number?: string;
    customer_account_name?: string;
    customer_account_number?: string;
    customer_bank_code?: string;
    virtual_account_id?: string | null;
}


export type merchantKeyType = {
 
      active: boolean
      created_at: string
      id: string
      merchant_id: string
      public_key: string
      secret_key: string
  
  }



  export type merchantType = {
    address: string
    available_balance: number
    created_at: string
    email: string
    first_name: string
    id: string
    last_name: string
    middle_name: string
    pending_settlement_balance: number
    phone_number: string
    preferred_currency: "NGN" | "USD"
    status: "active" | "inactive" | "suspended"
  }



  export type paymentMethodType = {
    created_at: string
    fee_rate: number
    fee_type: string
    available:boolean
    allowed_currencies: string[]
    id: string
    name: string
  }


  export type transactionType = {
    amount: number
    card_expiration_date: string | null
      card_holder_name: string | null
      card_last_four_digits: string | null
      card_verification_code: string | null
      created_at: string
      currency: "NGN" | "USD"
      customer_email: string | null
      customer_name: string | null
      customer_phone_number: string | null
      fee_amount: number | null
      fee_rate: number | null
      fee_type: "percentage" | "flat" | null
      id: string
      merchant_id: string
      total_amount: number
      tx_desc: string | null
      tx_ref: string | null
      tx_type: "card" | "virtual_account"
      virtual_account_id: string | null
    }
    

  export type virtualAccountType = {
    account_name: string
    account_number: string
    bank_code: string
    bank_name: string
      created_at?: string
    id: string
    merchant_id: string
  }
   