const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'test-secret-key-123';

let users = [
  { id: '1', name: 'John Doe', email: 'john@example.com', password: 'password123' }
];

// Auth endpoints
app.post('/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/auth/register', (req, res) => {
  console.log('Register attempt:', req.body);
  const { name, email, password } = req.body;
  
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already in use' });
  }
  
  const newUser = { id: String(users.length + 1), name, email, password };
  users.push(newUser);
  
  const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET);
  res.json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
});

app.post('/orders', (req, res) => {
  res.json({ id: 'ORD' + Date.now(), ...req.body, status: 'confirmed' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', users: users.length });
});

app.listen(3002, () => {
  console.log('✅ Backend running on http://localhost:3002');
  console.log('📧 Test: john@example.com / password123');
});
