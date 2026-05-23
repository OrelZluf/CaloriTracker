const http = require('http');

const data = JSON.stringify({
  height_cm: 180,
  weight_kg: 80,
  age: 30,
  gender: 'male',
  daily_calorie_goal: 2500
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/profile',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
