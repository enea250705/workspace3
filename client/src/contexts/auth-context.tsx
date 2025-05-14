import { createContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Check if user is already logged in
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        const data = await response.json();
        
        if (data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Failed to check authentication:", error);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { username, password });
      const data = await response.json();
      
      if (data.user) {
        setUser(data.user);
        return;
      }
      
      throw new Error("Login failed");
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      setUser(null);
      
      // Clear all queries from the cache on logout
      queryClient.clear();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
