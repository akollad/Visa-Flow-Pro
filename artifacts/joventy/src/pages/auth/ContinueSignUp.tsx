import { useSignUp } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { JoventyLogo } from "@/components/JoventyLogo";
import { CheckCircle2, XCircle } from "lucide-react";

function randomUsername() {
  return "user_" + Math.random().toString(36).slice(2, 10);
}

export default function ContinueSignUp() {
  const { signUp } = useSignUp();
  const [, setLocation] = useLocation();
  const attempted = useRef(false);
  const [statusMsg, setStatusMsg] = useState("Finalisation du compte…");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!signUp || attempted.current) return;
    attempted.current = true;

    const run = async () => {
      try {
        if (signUp.status === "complete") {
          await signUp.finalize();
          setLocation("/dashboard");
          return;
        }

        if (signUp.status !== "missing_requirements") {
          setLocation("/login");
          return;
        }

        const missing = signUp.missingFields ?? [];
        const updates: Record<string, string> = {};

        if (missing.includes("username")) {
          updates.username = randomUsername();
        }

        if (Object.keys(updates).length > 0) {
          setStatusMsg("Création du profil…");
          const { error } = await signUp.update(updates);
          if (error) {
            setHasError(true);
            setStatusMsg("Erreur lors de la configuration du compte.");
            setTimeout(() => setLocation("/register"), 2500);
            return;
          }
        }

        setStatusMsg("Activation de la session…");
        const { error: finalizeErr } = await signUp.finalize();
        if (finalizeErr) {
          setHasError(true);
          setStatusMsg("Erreur lors de l'activation du compte.");
          setTimeout(() => setLocation("/register"), 2500);
          return;
        }

        setStatusMsg("Compte activé !");
        setLocation("/dashboard");
      } catch {
        setHasError(true);
        setStatusMsg("Une erreur inattendue s'est produite.");
        setTimeout(() => setLocation("/register"), 2500);
      }
    };

    run();
  }, [signUp?.status]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4">
      <JoventyLogo variant="sidebar" size="md" />
      <div className="flex flex-col items-center gap-3 text-center max-w-xs">
        {hasError ? (
          <XCircle className="w-10 h-10 text-red-500" />
        ) : statusMsg === "Compte activé !" ? (
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        ) : (
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        )}
        <p className={`text-sm font-medium ${hasError ? "text-red-600" : "text-slate-600"}`}>
          {statusMsg}
        </p>
        {hasError && (
          <p className="text-xs text-slate-400">
            Vous allez être redirigé vers l'inscription…
          </p>
        )}
      </div>
    </div>
  );
}
