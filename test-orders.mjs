import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// simple dotenv parser for testing
const envFile = fs.readFileSync('.env', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, structures(name), rooms(number), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))')
    .limit(1);

  console.log("Error:", JSON.stringify(error, null, 2));
  console.log("Orders:", JSON.stringify(orders, null, 2));
}

run();
