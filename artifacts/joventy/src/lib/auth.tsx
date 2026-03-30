import { createContext, useContext, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/clerk-react";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "client";
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  const role: "admin" | "client" =
    (clerkUser?.publicMetadata?.role as string) === "admin" ? "admin" : "client";

  const user: AuthUser | null = clerkUser
    ? {
        id: clerkUser.id,
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        role,
      }
    : null;

  useEffect(() => {
    if (!isLoaded || !user) return;
    const path = window.location.pathname.replace(/^\/[^/]+/, "") || "/";
    if (user.role === "admin" && (path === "/login" || path === "/register" || path === "/dashboard")) {
      setLocation("/admin");
    } else if (user.role === "client" && (path === "/login" || path === "/register")) {
      setLocation("/dashboard");
    }
  }, [isLoaded, user?.id, user?.role]);

  const logout = () => {
    signOut(() => setLocation("/"));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading: !isLoaded, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
