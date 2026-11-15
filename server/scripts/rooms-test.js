import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'TestPass123';

const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
const testRoom = `room-${suffix}`;

const users = {
  A: `rma${suffix}`,
  B: `rmb${suffix}`,
  C: `rmc${suffix}`,
};

const sockets = [];

async function signup(username) {
  const response = await fetch(`${BASE_URL}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Signup failed for ${username}: ${data.error}`);
  }

  return data.token;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    sockets.push(socket);

    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function waitForEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    function handler(data) {
      clearTimeout(timer);
      resolve(data);
    }

    socket.once(eventName, handler);
  });
}

function emitAck(socket, eventName, data, timeout = 5000) {
  return new Promise((resolve, reject) => {
    socket.timeout(timeout).emit(eventName, data, (err, response) => {
      if (err) return reject(new Error(`${eventName} acknowledgement timed out`));
      resolve(response);
    });
  });
}

async function runTests() {
  try {
    console.log('\n--- Starting Rooms Socket & History Tests ---');

    console.log('\nCreating test users...');
    const tokenA = await signup(users.A);
    const tokenB = await signup(users.B);
    const tokenC = await signup(users.C);
    console.log(`PASS: Test users created: ${users.A}, ${users.B}, ${users.C}`);

    console.log('\nUser A connects socket...');
    const socketA = await connectSocket(tokenA);
    console.log('PASS: User A connected');

    console.log(`\nUser A joins ${testRoom}...`);
    const ackJoinA = await emitAck(socketA, 'room:join', { room: testRoom });
    if (!ackJoinA.ok || ackJoinA.room?.name !== testRoom || ackJoinA.room?.memberCount !== 1) {
      throw new Error(`User A join failed: ${JSON.stringify(ackJoinA)}`);
    }
    console.log(`PASS: User A joined ${testRoom} as owner (memberCount: 1)`);

    console.log('\nUser B connects socket...');
    const socketB = await connectSocket(tokenB);
    console.log('PASS: User B connected');

    console.log(`\nUser B joins ${testRoom} and User A expects room:user-joined...`);
    const userJoinedPromise = waitForEvent(socketA, 'room:user-joined');

    const ackJoinB = await emitAck(socketB, 'room:join', { room: testRoom });
    if (!ackJoinB.ok || ackJoinB.room?.name !== testRoom || ackJoinB.room?.memberCount !== 2) {
      throw new Error(`User B join failed: ${JSON.stringify(ackJoinB)}`);
    }

    const joinedPayload = await userJoinedPromise;
    if (joinedPayload.room !== testRoom || joinedPayload.username !== users.B) {
      throw new Error(`Unexpected room:user-joined payload: ${JSON.stringify(joinedPayload)}`);
    }
    console.log(`PASS: User A received room:user-joined for ${users.B}`);

    console.log(`\nUser B sends message:send to ${testRoom}...`);
    const messageNewPromise = waitForEvent(socketA, 'message:new');

    const ackSend = await emitAck(socketB, 'message:send', {
      room: testRoom,
      body: 'Hello room from B!',
    });
    if (!ackSend.ok || ackSend.message?.body !== 'Hello room from B!') {
      throw new Error(`Send message failed: ${JSON.stringify(ackSend)}`);
    }

    const messageNewPayload = await messageNewPromise;
    if (messageNewPayload.room !== testRoom || messageNewPayload.body !== 'Hello room from B!' || messageNewPayload.username !== users.B) {
      throw new Error(`Unexpected message:new payload: ${JSON.stringify(messageNewPayload)}`);
    }
    console.log('PASS: User A received message:new with correct room and content');

    console.log(`\nUser B leaves ${testRoom} and User A expects room:user-left...`);
    const userLeftPromise = waitForEvent(socketA, 'room:user-left');

    const ackLeave = await emitAck(socketB, 'room:leave', { room: testRoom });
    if (!ackLeave.ok) {
      throw new Error(`Leave room failed: ${JSON.stringify(ackLeave)}`);
    }

    const leftPayload = await userLeftPromise;
    if (leftPayload.room !== testRoom || leftPayload.username !== users.B) {
      throw new Error(`Unexpected room:user-left payload: ${JSON.stringify(leftPayload)}`);
    }
    console.log(`PASS: User A received room:user-left for ${users.B}`);

    console.log('\nTesting non-member room history access (expects 403)...');
    const historyRes = await fetch(`${BASE_URL}/api/rooms/${testRoom}/messages`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });

    if (historyRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for non-member history request, got ${historyRes.status}`);
    }
    console.log('PASS: Non-member received HTTP 403 on room history request');

    console.log('\nALL ROOM SOCKET TESTS PASSED!');
  } finally {
    for (const socket of sockets) {
      socket.disconnect();
    }
  }
}

runTests().catch((err) => {
  console.error('\nROOM SOCKET TEST FAILED:', err.message);
  process.exitCode = 1;
});
