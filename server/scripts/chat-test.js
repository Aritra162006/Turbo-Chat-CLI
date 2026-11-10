// Usage: node scripts/chat-test.js <username> [message]
// Logs in (or signs up), then prints every message:new. With a message, sends it and quits.
import { io } from 'socket.io-client';

const [username, text] = process.argv.slice(2);
const base = process.env.URL ?? 'http://localhost:3000';
const password = 'testpass123';

async function getToken() {
  for (const path of ['login', 'signup']) {
    const res = await fetch(`${base}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) return (await res.json()).token;
  }
  throw new Error('Could not log in or sign up');
}

const socket = io(base, { auth: { token: await getToken() } });
socket.on('connect_error', (err) => { console.log('connect_error:', err.message); process.exit(1); });
socket.on('message:new', (m) => console.log(`[${m.room}] ${m.username}: ${m.body}`));

socket.on('connect', () => {
  if (!text) return console.log('Listening as', username);
  socket.emit('message:send', { room: 'general', body: text }, (ack) => {
    console.log('ack:', ack);
    socket.close();
  });
});
