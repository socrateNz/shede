import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
}

async function run() {
  const selectQuery = '*, structures(name), rooms(number), tables(name, floor_name), clients(first_name, last_name, phone), order_items(*, products(name)), order_accompaniments(*, accompaniments(name))';
  const url = `${supabaseUrl}/rest/v1/orders?select=${encodeURIComponent(selectQuery)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
run();
