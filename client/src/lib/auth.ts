
export interface User {
  id: string;
  username: string;
  fullName: string;
  role?: string; // For backward compatibility
  roles?: string[]; // Array of roles from server
}

interface LoginResponse {
  token: string;
  user: User;
}

const API_BASE = "";

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error("Invalid credentials");
    }

    return response.json();
  },

  async getMe(): Promise<User> {
    const token = tokenStorage.get();
    const response = await fetch(`${API_BASE}/api/users/me`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get user info");
    }

    return response.json();
  },
};

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem("hospital_token");
  },

  set(token: string): void {
    localStorage.setItem("hospital_token", token);
  },

  remove(): void {
    localStorage.removeItem("hospital_token");
  },
};
