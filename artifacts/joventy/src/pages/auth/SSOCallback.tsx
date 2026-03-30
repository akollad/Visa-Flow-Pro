import { useClerk, useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { JoventyLogo } from "@/components/JoventyLogo";

export default function SSOCallback() {
  const { handleRedirectCallback, isLoaded } = useClerk();
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    // Already signed in → dashboard
    if (isSignedIn) {
      setLocation("/dashboard");
      return;
    }

    // Clerk puts OAuth params in the URL hash (e.g. #__clerk_hash=...)
    // or in the search string. If neither exists, this page was opened
    // directly without a real OAuth flow → send to login.
    const search = window.location.search;
    const hash = window.location.hash;
    const hasParams = search.length > 1 || (hash.length > 1 && hash.includes("__clerk"));

    if (!hasParams) {
      setLocation("/login");
      return;
    }

    // Valid OAuth callback — process it
    setProcessing(true);
    const timer = setTimeout(() => setLocation("/login"), 10000);

    handleRedirectCallback({
      afterSignInUrl: "/dashboard",
      afterSignUpUrl: "/dashboard",
      continueSignUpUrl: "/dashboard",
      firstFactorUrl: "/dashboard",
      secondFactorUrl: "/dashboard",
    })
      .then(() => clearTimeout(timer))
      .catch(() => {
        clearTimeout(timer);
        setLocation("/login");
      });

    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn]);

  // Don't render the loading screen until we know there's something to process
  if (!processing) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
      <JoventyLogo variant="light" size="md" />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-text-secondary text-sm font-medium">
          Connexion en cours…
        </p>
      </div>
    </div>
  );
}
