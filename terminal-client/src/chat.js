
import { getMessages, sendMessage } from "./api.js";

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