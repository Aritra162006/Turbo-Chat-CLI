#!/usr/bin/env node
// Usage: turbochat [server-url]
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { styleText } from 'node:util';
import { io } from 'socket.io-client';

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
    console.log(styleText('red', data.error));
  }
}

const result = await logIn();
const username = result.username;
const token = result.token;
console.log(styleText('green', 'Logged in as ' + username + '. Type /help for commands.'));

function printMessage(message) {
  // username is null when the sender's account was deleted.
  let name = message.username;
  if (name === null) {
    name = 'deleted user';
  }
  // My own name in green, everyone else in cyan.
  let colour = 'cyan';
  if (name === username) {
    colour = 'green';
  }
  console.log(styleText(['bold', colour], name) + ': ' + message.body);
}

// History first, so old messages print above any live ones.
let history;
try {
  const res = await fetch(base + '/api/rooms/general/messages', {
    headers: { Authorization: 'Bearer ' + token },
  });
  history = await res.json();
  if (!res.ok) {
    console.log(styleText('red', history.error));
    process.exit(1);
  }
} catch (error) {
  console.log('Cannot reach the server at ' + base);
  process.exit(1);
}

for (const message of history) {
  printMessage(message);
}

// Open the live connection. The server checks the token before letting us in.
const socket = io(base, { auth: { token: token } });

// The server already sent this to everyone in the room (us included). We only print it.
socket.on('message:new', printMessage);

socket.on('connect_error', function (error) {
  // active = socket.io is still retrying by itself (server down for now). Nothing to do.
  if (socket.active) {
    return;
  }
  // The server refused us (bad or logged-out token). Retrying would not help.
  console.log(styleText('red', 'Connection refused: ' + error.message + '. Log in again.'));
  process.exit(1);
});

// Each command is a function. A line starting with / runs the command with that name.
const commands = {
  help: function () {
    console.log(styleText('gray', 'Commands:'));
    console.log(styleText('gray', '  /help   show this list'));
    console.log(styleText('gray', '  /quit   leave the chat'));
    console.log(styleText('gray', 'Anything else you type is sent to #general.'));
  },
  quit: function () {
    console.log(styleText('gray', 'Bye!'));
    process.exit(0);
  },
};

// Every line I type is either a command or a message for general.
rl.on('line', function (line) {
  const body = line.trim();
  if (body === '') {
    return;
  }

  if (body.startsWith('/')) {
    // "/help extra words" -> "help"
    const name = body.slice(1).split(' ')[0];
    // Object.hasOwn so names like /toString don't match built-in object properties.
    if (Object.hasOwn(commands, name)) {
      commands[name]();
    } else {
      console.log(styleText('red', 'Unknown command, try /help'));
    }
    return;
  }

  // The ack is the server's answer to this one message.
  socket.emit('message:send', { room: 'general', body: body }, function (ack) {
    // On success nothing to print: our own message comes back as message:new.
    if (ack.ok === false) {
      console.log(styleText('red', 'Not sent: ' + ack.error));
    }
  });
});
