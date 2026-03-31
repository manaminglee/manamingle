
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCreatorTableType() {
  console.log('Checking creators table id type...');
  // We can't easily get the type via the client, but we can try to insert a TEXT and see if it fails with UUID error
  const testId = 'test_text_id';
  const { error } = await supabase.from('creators').insert({ id: testId, handle_name: 'test_handle' });
  if (error) {
    console.error('Insert error:', error.message);
  } else {
    console.log('Successfully inserted TEXT id. Column allows TEXT.');
    // Clean up
    await supabase.from('creators').delete().eq('id', testId);
  }
}

checkCreatorTableType();
