const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|BREVO_API_KEY|BREVO_SENDER_EMAIL|BREVO_SENDER_NAME)\s*=\s*(.*)$/);
  if (match) {
    let val = match[2].trim();
    val = val.replace(/^["']|["']$/g, ''); // strip quotes
    envVars[match[1]] = val;
  }
});

// Set process.env
process.env.BREVO_API_KEY = envVars.BREVO_API_KEY;
process.env.BREVO_SENDER_EMAIL = envVars.BREVO_SENDER_EMAIL;
process.env.BREVO_SENDER_NAME = envVars.BREVO_SENDER_NAME;
process.env.NEXT_PUBLIC_SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

// Import sendEmail dynamically (CommonJS/TS compile-time fallback)
const { sendEmail } = require('./lib/email-service');

async function test() {
  console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ? 'FOUND' : 'MISSING');
  console.log('BREVO_SENDER_EMAIL:', process.env.BREVO_SENDER_EMAIL);
  console.log('Sending test email to ARHMSdatalimited@gmail.com...');
  const res = await sendEmail({
    to: 'ARHMSdatalimited@gmail.com',
    toName: 'ARHMS Admin',
    subject: 'Test Email from Local Environment',
    htmlContent: '<h1>It works!</h1><p>Test email content.</p>'
  });
  console.log('Result:', res);
}
test();
