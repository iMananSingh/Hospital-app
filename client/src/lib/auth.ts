import { apiRequest } from "./queryClient";

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await apiRequest("POST", "/api/auth/login", { username, password });
    return response.json();
  },

  register: async (userData: { username: string; password: string; fullName: string; role: string }): Promise<User> => {
    const response = await apiRequest("POST", "/api/auth/register", userData);
    return response.json();
  },

  getMe: async (): Promise<User> => {
    const response = await apiRequest("GET", "/api/users/me");
    return response.json();
  },
};

export const tokenStorage = {
  get: () => localStorage.getItem("hospital_token"),
  set: (token: string) => localStorage.setItem("hospital_token", token),
  remove: () => localStorage.removeItem("hospital_token"),
};
