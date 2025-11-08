import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_DB_URL as string;
const SUPABASE_ANON_KEY = process.env.SUPABASE_DB_ANON_KEY as string;


export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
