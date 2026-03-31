
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
  console.log('Inspecting creators table...');
  const { data, error } = await supabase.from('creators').select('*').limit(1);
  if (error) {
    console.error('Error selecting from creators:', error.message);
  } else {
    console.log('Columns found:', Object.keys(data[0] || {}));
  }
}

inspectTable();
