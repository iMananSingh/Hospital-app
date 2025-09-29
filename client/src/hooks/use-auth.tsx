import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi, tokenStorage, type User } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const initAuth = async () => {
      const token = tokenStorage.get();
      if (token) {
        try {
          const userData = await authApi.getMe();
          setUser(userData);
        } catch (error) {
          tokenStorage.remove();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const { token, user: userData } = await authApi.login(username, password);
      tokenStorage.set(token);
      setUser(userData);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${userData.fullName}`,
      });

      // Check if user has only admin role (not super_user) and redirect to settings
      const userRoles = userData.roles || [userData.role];
      const hasAdminOnly = userRoles.includes('admin') && !userRoles.includes('super_user');

      if (hasAdminOnly) {
        // Use setTimeout to ensure the redirect happens after login completion
        setTimeout(() => {
          window.location.href = '/settings';
        }, 100);
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = () => {
    tokenStorage.remove();
    setUser(null);
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}