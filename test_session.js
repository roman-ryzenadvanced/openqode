const http = require('http');

const data = JSON.stringify({
    sessions: {
        "test": { name: "Test Session", messages: [] }
    },
    currentSession: "test"
});

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sessions/save',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
}, (res) => {
    console.log(`StatusCode: ${res.statusCode}`);
    res.on('data', d => process.stdout.write(d));
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
