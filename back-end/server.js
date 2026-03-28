require('dotenv').config();
const https = require('https');
const fs = require('fs');
const app = require('./app');

const PORT = process.env.PORT || 9115;

const options = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
};

https.createServer(options, app).listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});