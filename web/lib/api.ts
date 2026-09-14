const API_PREFIX = "/api/v1";

export async function login(email: string, password: string) {
  return fetch(`${API_PREFIX}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return fetch(`${API_PREFIX}/auth/logout`, {
    method: "POST",
  });
}

export async function register(firstName: string, lastName: string, email: string, password: string) {
  return fetch(`${API_PREFIX}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName, email, password }),
  });
}

export async function getDocuments() {
  return fetch(`${API_PREFIX}/document/list`, {
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function uploadDocument(file: File) {
  const body = new FormData();
  body.append("file", file);
  return fetch(`${API_PREFIX}/document/upload`, {
    method: "POST",
    body,
  });
}

export async function deleteDocument(id: string) {
  return fetch(`${API_PREFIX}/document/delete?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function retryDocument(id: string) {
  return fetch(`${API_PREFIX}/document/retry?id=${encodeURIComponent(id)}`, {
    method: "POST",
  });
}

export async function getUser() {
  return fetch(`${API_PREFIX}/user/me`, {
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function updateUser(body: { firstName?: string; lastName?: string; email?: string }) {
  return fetch(`${API_PREFIX}/user/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteUser() {
  return fetch(`${API_PREFIX}/user/delete`, {
    method: "DELETE",
  });
}

export async function searchDocuments(query: string, signal?: AbortSignal) {
  return fetch(`${API_PREFIX}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
}