// Simple server to test if port 15044 works
const express = require('express');
const path = require('path');
const app = express();
const PORT = 15044;

// Serve static files from web directory
app.use(express.static(path.join(__dirname, 'web')));

// Basic route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(PORT, 'localhost', () => {
    console.log(`🚀 Test server running on http://localhost:${PORT}`);
});