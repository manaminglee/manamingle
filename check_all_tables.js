
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
  const tables = ['creators', 'referral_logs', 'withdrawals', 'user_coins', 'creator_logins', 'admin_history'];
  for (const table of tables) {
    console.log(`Checking table: ${table}...`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`- NO TABLE or ERROR: ${error.message}`);
    } else {
      console.log(`- OK (found ${data.length} records). Columns: ${data.length > 0 ? Object.keys(data[0]).join(', ') : 'unknown (empty table)'}`);
    }
  }
}

checkAll();
