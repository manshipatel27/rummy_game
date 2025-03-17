const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const {initSocket} = require('./Socket')

initSocket(server);

app.get('/', (req, res) => {
  res.send('Welcome to the Rummy Game!');
});


const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});