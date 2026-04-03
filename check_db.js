
const { createClient } = require('@supabase/supabase-base');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function check() {
  const { data: stocks, error: stocksError } = await supabase.from('stocks').select('id').limit(1);
  console.log('Stocks table:', stocksError ? 'Error: ' + stocksError.message : 'OK');

  const { data: movements, error: movementsError } = await supabase.from('stock_movements').select('id').limit(1);
  console.log('Movements table:', movementsError ? 'Error: ' + movementsError.message : 'OK');
}

check();
