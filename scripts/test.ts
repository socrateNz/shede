import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, structures(name), rooms(number), tables(name, floor_name), clients(first_name, last_name, phone), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
    .limit(1);
  console.log("Error:", error);
}
test();
