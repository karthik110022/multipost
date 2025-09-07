const cron = require('node-cron');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  });
}

// Schedule task to run every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    console.log('Running scheduled post check...');
    console.log('Using CRON_SECRET:', process.env.CRON_SECRET ? 'Present' : 'Missing');
    const response = await fetch(
      `http://localhost:3000/api/cron/publish-scheduled?secret=${encodeURIComponent(process.env.CRON_SECRET)}`,
      {
        method: 'GET',
      }
    );

    const data = await response.json();
    console.log('Scheduler response:', data);
  } catch (error) {
    console.error('Error running scheduler:', error);
  }
});

console.log('Development scheduler started. Running every 2 minutes...'); 