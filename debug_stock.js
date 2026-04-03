
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function debug() {
  console.log('--- Testing Tables Existence ---');
  
  const { error: stocksErr } = await supabase.from('stocks').select('count').limit(1);
  console.log('stocks table:', stocksErr ? 'MISSING or ERROR: ' + stocksErr.message : 'EXISTS');

  const { error: movementsErr } = await supabase.from('stock_movements').select('count').limit(1);
  console.log('stock_movements table:', movementsErr ? 'MISSING or ERROR: ' + movementsErr.message : 'EXISTS');

  console.log('\n--- Checking for existing data ---');
  const { data: stocks } = await supabase.from('stocks').select('*');
  console.log('Stocks rows:', stocks?.length || 0);

  const { data: movements } = await supabase.from('stock_movements').select('*');
  console.log('Movements rows:', movements?.length || 0);
}

debug();
