const express = require('express');
const app = express();
const PORT = 15044;

app.get('/', (req, res) => {
    res.send('Test server is working!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Test server running on http://localhost:${PORT}`);
});