import { createContext, useContext, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetCurrentUser, 
  useLoginUser, 
  useLogoutUser, 
  useRegisterUser,
  User,
  LoginInput,
  RegisterInput,
  getGetCurrentUserQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginInput) => void;
  register: (data: RegisterInput) => void;
  logout: () => void;
  isLoggingIn: boolean;
  isRegistering: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useGetCurrentUser({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  });

  const loginMutation = useLoginUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Connexion réussie", description: "Bienvenue sur Joventy." });
      },
      onError: (error: any) => {
        toast({ 
          variant: "destructive", 
          title: "Erreur de connexion", 
          description: error.message || "Identifiants incorrects" 
        });
      }
    }
  });

  const registerMutation = useRegisterUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Inscription réussie", description: "Votre compte a été créé avec succès." });
      },
      onError: (error: any) => {
        toast({ 
          variant: "destructive", 
          title: "Erreur d'inscription", 
          description: error.message || "Impossible de créer le compte" 
        });
      }
    }
  });

  const logoutMutation = useLogoutUser({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
        setLocation("/");
        toast({ title: "Déconnexion", description: "Vous avez été déconnecté." });
      }
    }
  });

  useEffect(() => {
    if (user) {
      if (window.location.pathname === "/login" || window.location.pathname === "/register") {
        setLocation(user.role === "admin" ? "/admin" : "/dashboard");
      }
    }
  }, [user, setLocation]);

  const value = {
    user: user || null,
    isLoading,
    login: (data: LoginInput) => loginMutation.mutate({ data }),
    register: (data: RegisterInput) => registerMutation.mutate({ data }),
    logout: () => logoutMutation.mutate(),
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
