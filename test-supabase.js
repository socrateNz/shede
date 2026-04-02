import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('structures')
    .select('id, name, licenses!inner(is_active, expires_at)')
    .eq('licenses.is_active', true)
    
  console.log("Without OR:");
  console.log(data);
  console.log(error);

  const { data: data2, error: error2 } = await supabase
    .from('structures')
    .select('id, name, licenses!inner(is_active, expires_at)')
    .eq('licenses.is_active', true)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`, { referencedTable: 'licenses' })

  console.log("\\nWith OR:");
  console.log(JSON.stringify(data2, null, 2));
  console.log(error2);
}

run();
