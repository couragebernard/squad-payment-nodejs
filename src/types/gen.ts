export type CreateMerchantType = {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    email: string;
    phone_number: string;
    address?: string | null;
}