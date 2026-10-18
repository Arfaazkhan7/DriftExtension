const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const token = jwt.sign({ username }, 'secret-key');
  res.json({ token, message: 'Authentication successful' });
});

app.get('/api/users/profile', (req, res) => {
  res.json({ id: 1, role: 'member', status: 'active' });
});

app.listen(3000, () => console.log('API Server running on port 3000'));
