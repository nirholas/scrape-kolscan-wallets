const https = require('https');

const url = 'https://docs.gmgn.ai/index/llms-full.txt';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
  res.on('error', err => console.error(err));
}).on('error', err => console.error('Request error:', err));
