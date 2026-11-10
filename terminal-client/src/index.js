
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { registerUser, loginUser } from "./auth.js";
import { showMessages } from "./chat.js";

const rl = createInterface({ input: stdin, output: stdout });

let token = null;
let currentUser = null;

async function main() {
  console.log("\n================================");
  console.log("       TURBO CHAT CLI");
  console.log("================================");

  while (true) {
    if (!token) {
      console.log("\n1. Signup");
      console.log("2. Login");
      console.log("3. Exit");

      const choice = await rl.question("\nChoose an option: ");

      if (choice === "1") {
        const username = await rl.question("Username: ");
        const password = await rl.question("Password: ");

        await registerUser(username, password);

      } else if (choice === "2") {
        const username = await rl.question("Username: ");
        const password = await rl.question("Password: ");

        const data = await loginUser(username, password);

        if (data?.token) {
          token = data.token;
          currentUser = data.username;

          console.log(`\nWelcome, ${currentUser}!`);
        }

      } else if (choice === "3") {
        console.log("Goodbye!");
        break;

      } else {
        console.log("Invalid option. Try again.");
      }

    } else {
      console.log("\n1. View General Chat History");
      console.log("2. Logout");

      const choice = await rl.question("\nChoose an option: ");

      if (choice === "1") {
        await showMessages(token);

      } else if (choice === "2") {
        token = null;
        currentUser = null;
        console.log("Logged out successfully!");

      } else {
        console.log("Invalid option. Try again.");
      }
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error("Application error:", error.message);
  rl.close();
});

