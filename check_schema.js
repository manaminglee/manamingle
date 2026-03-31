
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking creators table schema...');
  
  // Try to select the authorized_ips column
  const { data, error } = await supabase
    .from('creators')
    .select('authorized_ips')
    .limit(1);

  if (error) {
    console.error('Error selecting authorized_ips:', error.message);
    if (error.message.includes('column') || error.message.includes('schema cache')) {
      console.log('Column "authorized_ips" might be missing or schema cache is stale.');
      
      // Attempt to add the column if it's missing (this requires higher permissions, 
      // but sometimes service_role can do it if it's a superuser, or we use an RPC if available)
      // Actually, Supabase service_role cannot run DDL directly via .from(). 
      // We need to use .rpc() if a DDL function exists, or just tell the user.

      console.log('Attempting to check if column exists via information_schema...');
      const { data: info, error: infoError } = await supabase
        .rpc('get_column_info', { table_name: 'creators', column_name: 'authorized_ips' });
      
      if (infoError) {
          console.log('RPC "get_column_info" not found. Cannot check via RPC.');
      } else {
          console.log('Column info:', info);
      }
    }
  } else {
    console.log('Column "authorized_ips" found! Data:', data);
    console.log('If you still see the error, try restarting your server or refreshing the Supabase dashboard.');
  }
}

checkSchema();
