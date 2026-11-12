
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "TestPass123";

const suffix = randomUUID().replaceAll("-", "").slice(0, 10);

const users = {
  A: `testa${suffix}`,
  B: `testb${suffix}`,
  C: `testc${suffix}`,
};

const sockets = [];

async function signup(username) {
  const response = await fetch(`${BASE_URL}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      transports: ["websocket"],
    });

    sockets.push(socket);

    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function waitForEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeout);

    function handler(data) {
      clearTimeout(timer);
      resolve(data);
    }

    socket.once(eventName, handler);
  });
}

function sendDm(socket, toUsername, body) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(
      "dm:send",
      { toUsername, body },
      (err, response) => {
        if (err) return reject(new Error("DM acknowledgement timed out"));
        resolve(response);
      }
    );
  });
}

async function getConversations(token) {
  const response = await fetch(`${BASE_URL}/api/dms`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Conversations API failed: ${response.status}`);
  }

  return response.json();
}

async function runTests() {
  try {
    console.log("\nCreating test users...");

    const tokenA = await signup(users.A);
    const tokenB = await signup(users.B);
    const tokenC = await signup(users.C);

    console.log("PASS: All three users created");

    console.log("\nConnecting four sockets...");

    const [a1, a2, b, c] = await Promise.all([
      connectSocket(tokenA),
      connectSocket(tokenA),
      connectSocket(tokenB),
      connectSocket(tokenC),
    ]);

    console.log("PASS: User A has two connections; B and C connected");

    console.log("\nTesting DM delivery...");

    const eventA1 = waitForEvent(a1, "dm:new");
    const eventA2 = waitForEvent(a2, "dm:new");
    const eventB = waitForEvent(b, "dm:new");

    const ack = await sendDm(
      b,
      users.A,
      "Hello from user B!"
    );

    if (!ack.ok || ack.recipientOnline !== true) {
      throw new Error(`Unexpected DM acknowledgement: ${JSON.stringify(ack)}`);
    }

    const [messageA1, messageA2, messageB] = await Promise.all([
      eventA1,
      eventA2,
      eventB,
    ]);

    if (
      messageA1.id !== ack.message.id ||
      messageA2.id !== ack.message.id ||
      messageB.id !== ack.message.id
    ) {
      throw new Error("DM event payload mismatch");
    }

    console.log("PASS: A's two sockets and B received dm:new");
    console.log("PASS: recipientOnline is true");

    console.log("\nTesting self-DM rejection...");

    const selfDm = await sendDm(a1, users.A, "Sending to myself");

    if (selfDm.ok || !selfDm.error) {
      throw new Error("Self-DM was not rejected");
    }

    console.log("PASS: Self-DM rejected");

    console.log("\nTesting unread count...");

    const conversations = await getConversations(tokenA);
    const conversation = conversations.find(
      (item) => item.username === users.B
    );

    if (!conversation || conversation.unread < 1) {
      throw new Error(
        `Expected unread count >= 1, received: ${JSON.stringify(conversation)}`
      );
    }

    console.log(`PASS: User A unread count = ${conversation.unread}`);

    console.log("\nTesting rate limit (5 allowed, 6th rejected)...");

    for (let i = 1; i <= 5; i++) {
      const result = await sendDm(c, users.A, `Rate limit test ${i}`);

      if (!result.ok) {
        throw new Error(`Message ${i} was unexpectedly rejected`);
      }
    }

    const sixth = await sendDm(c, users.A, "Rate limit test 6");

    if (sixth.ok || !sixth.error?.toLowerCase().includes("rate limit")) {
      throw new Error("Sixth message was not rate-limited");
    }

    console.log("PASS: First five messages accepted");
    console.log("PASS: Sixth message rejected");

    console.log("\nALL DM SOCKET TESTS PASSED!");
  } finally {
    for (const socket of sockets) {
      socket.disconnect();
    }
  }
}

runTests().catch((error) => {
  console.error("\nDM SOCKET TEST FAILED:", error.message);
  process.exitCode = 1;
});
