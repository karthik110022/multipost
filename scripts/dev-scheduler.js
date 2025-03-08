const cron = require('node-cron');
const fetch = require('node-fetch');

// Schedule task to run every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    console.log('Running scheduled post check...');
    const response = await fetch(
      `http://localhost:3001/api/cron/publish-scheduled?secret=${encodeURIComponent(process.env.CRON_SECRET)}`,
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