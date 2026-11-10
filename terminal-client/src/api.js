
const BASE_URL = "http://localhost:3000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}


export function signup(username, password) {
  return request("/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function login(username, password) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getMe(token) {
  return request("/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getMessages(token) {
  return request("/rooms/general/messages", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function sendMessage(token, body) {
  return request("/rooms/general/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
  });
}
