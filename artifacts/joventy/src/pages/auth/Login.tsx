import { Link } from "wouter";
import { SignIn } from "@clerk/clerk-react";
import { Shield, ArrowLeft } from "lucide-react";

const clerkAppearance = {
  variables: {
    colorPrimary: "#0A192F",
    colorBackground: "#ffffff",
    colorText: "#0A192F",
    colorTextSecondary: "#64748b",
    colorNeutral: "#64748b",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-0 p-0",
    headerTitle: "font-serif text-3xl font-bold text-[#0A192F]",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButton:
      "border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium h-11 rounded-xl",
    socialButtonsBlockButtonText: "font-medium",
    dividerLine: "bg-slate-200",
    dividerText: "text-slate-400 text-xs",
    formFieldLabel: "text-sm font-medium text-[#0A192F]",
    formFieldInput:
      "h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F]",
    formButtonPrimary:
      "bg-[#0A192F] hover:bg-[#0A192F]/90 text-white font-bold h-12 rounded-xl",
    footerActionLink:
      "text-[#0A192F] font-semibold hover:text-[#D4AF37] transition-colors",
    identityPreviewEditButton: "text-[#0A192F]",
    formFieldSuccessText: "text-green-600",
    formFieldErrorText: "text-red-500",
    alertText: "text-red-600",
    alert: "bg-red-50 border-red-200 rounded-xl",
    otpCodeFieldInput:
      "h-12 w-12 border-slate-200 rounded-xl focus:border-[#0A192F]",
  },
};

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'accueil
        </Link>

        <div className="bg-white p-8 rounded-2xl shadow-xl shadow-primary/5 border border-border">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-secondary" />
            </div>
            <h2 className="text-3xl font-serif font-bold text-primary text-center">
              Connexion
            </h2>
            <p className="mt-2 text-muted-foreground text-center">
              Accédez à votre espace sécurisé
            </p>
          </div>

          <SignIn
            routing="hash"
            appearance={clerkAppearance}
            fallbackRedirectUrl="/dashboard"
          />

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Vous n'avez pas de compte ?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary hover:text-secondary transition-colors"
            >
              Créer un dossier
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
