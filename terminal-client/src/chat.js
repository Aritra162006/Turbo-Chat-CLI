
import { getMessages, sendMessage } from "./api.js";
import { clearLine, cursorTo } from "node:readline";
import { stdout } from "node:process";

export async function showMessages(token) {
  try {
    const messages = await getMessages(token);

    console.log("\n========== GENERAL CHAT ==========\n");

    if (messages.length === 0) {
      console.log("No messages yet. Start the conversation!");
      return;
    }

    messages.forEach((message) => {
      console.log(`${message.username}: ${message.body}`);
    });

    console.log("\n==================================\n");
  } catch (error) {
    console.log("Unable to fetch messages:", error.message);
  }
}

export async function sendChatMessage(token, body) {
  try {
    const message = await sendMessage(token, body);

    console.log("\nMessage sent successfully!");
    console.log(`${message.username}: ${message.body}`);
  } catch (error) {
    console.log("Unable to send message:", error.message);
  }
}

export async function startLiveChat(token, rl) {
  console.log("\n========== LIVE CHAT ==========");
  console.log("Type your message and press Enter.");
  console.log("Type 'q' to exit Live Chat.\n");

  let lastMessageId = 0;
  let polling = false;
  let sending = false;

  try {
    const messages = await getMessages(token);

    messages.forEach((message) => {
      console.log(`${message.username}: ${message.body}`);
      lastMessageId = Math.max(lastMessageId, message.id);
    });

    console.log("\nLive Chat started!\n");

    await new Promise((resolve) => {
      const printIncomingMessage = (message) => {
        clearLine(stdout, 0);
        cursorTo(stdout, 0);

        console.log(`\n${message.username}: ${message.body}`);

        rl.prompt(true);
      };

      const pollInterval = setInterval(async () => {
        if (polling) return;

        polling = true;

        try {
          const latestMessages = await getMessages(token);

          latestMessages.forEach((message) => {
            if (message.id > lastMessageId) {
              printIncomingMessage(message);
              lastMessageId = message.id;
            }
          });
        } catch (error) {
          console.log("\nUnable to refresh:", error.message);
          rl.prompt(true);
        } finally {
          polling = false;
        }
      }, 2000);

      const cleanup = () => {
        clearInterval(pollInterval);
        rl.removeListener("line", handleLine);
        resolve();
      };

      const handleLine = async (line) => {
        const body = line.trim();

        if (body.toLowerCase() === "q") {
          cleanup();
          return;
        }

        if (!body) {
          console.log("Message cannot be empty!");
          rl.prompt();
          return;
        }

        if (sending) return;

        sending = true;

        try {
          await sendMessage(token, body);
        } catch (error) {
          console.log("\nUnable to send message:", error.message);
        } finally {
          sending = false;
          rl.prompt();
        }
      };

      rl.setPrompt("You: ");
      rl.on("line", handleLine);
      rl.prompt();
    });

    console.log("\nExited Live Chat.");

  } catch (error) {
    console.log("Live Chat error:", error.message);
  }
}
