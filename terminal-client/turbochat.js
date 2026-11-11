#!/usr/bin/env node
// Usage: turbochat [server-url]
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

// Use the server URL typed after the command, or localhost if none was given.
let base = process.argv[2];
if (base === undefined) {
  base = 'http://localhost:3000';
}

// Everything readline prints goes through this stream.
// While hidden is true, the text is thrown away instead of shown, so a typed password stays invisible.
let hidden = false;

function writeToScreen(chunk, encoding, done) {
  if (hidden === false) {
    process.stdout.write(chunk);
  }
  done();
}

const output = new Writable({ write: writeToScreen });

// terminal: true makes readline echo the keys itself (through our stream) instead of the terminal doing it.
const rl = readline.createInterface({
  input: process.stdin,
  output: output,
  terminal: true,
});

// Ctrl+C quits.
rl.on('SIGINT', function () {
  process.exit(130);
});

// Ctrl+D closes the input, so quit instead of waiting forever.
rl.on('close', function () {
  process.exit(0);
});

async function askPassword() {
  process.stdout.write('Password: ');
  hidden = true;
  const password = await rl.question('');
  hidden = false;
  process.stdout.write('\n');
  return password;
}

// Asks for a username and password until the server accepts them, then returns { username, token }.
async function logIn() {
  const choice = await rl.question('(l)ogin or (s)ignup? ');

  let path;
  if (choice.trim().toLowerCase().startsWith('s')) {
    path = 'signup';
  } else {
    path = 'login';
  }

  while (true) {
    const typedName = await rl.question('Username: ');
    const username = typedName.trim();
    const password = await askPassword();

    let res;
    let data;
    try {
      res = await fetch(base + '/api/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password }),
      });
      data = await res.json();
    } catch (error) {
      console.log('Cannot reach the server at ' + base);
      process.exit(1);
    }

    if (res.ok) {
      return data;
    }

    // Wrong password, taken username, etc. Show the server's message and ask again.
    console.log(data.error);
  }
}

const result = await logIn();
const username = result.username;
const token = result.token;
console.log('Logged in as ' + username);
rl.close();
