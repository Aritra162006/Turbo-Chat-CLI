
import { signup, login } from "./api.js";

export async function registerUser(username, password) {
  try {
    const data = await signup(username, password);
    console.log("Account created successfully!");
    return data;
  } catch (error) {
    console.log("Signup failed:", error.message);
    return null;
  }
}

export async function loginUser(username, password) {
  try {
    const data = await login(username, password);
    console.log("Login successful!");
    return data;
  } catch (error) {
    console.log("Login failed:", error.message);
    return null;
  }
}
