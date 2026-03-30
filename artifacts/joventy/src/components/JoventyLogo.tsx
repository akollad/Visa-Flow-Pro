import { Link } from "wouter";

type LogoVariant = "dark" | "light" | "sidebar";
type LogoSize = "sm" | "md" | "lg";

interface JoventyLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  showText?: boolean;
  href?: string;
}

const sizeMap: Record<LogoSize, { img: string; container: string; text: string; gap: string }> = {
  sm: {
    img: "w-5 h-5 object-contain",
    container: "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
    text: "font-sans text-lg font-bold leading-none",
    gap: "gap-2",
  },
  md: {
    img: "w-6 h-6 object-contain",
    container: "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
    text: "font-sans text-xl font-bold leading-none",
    gap: "gap-2.5",
  },
  lg: {
    img: "w-8 h-8 object-contain",
    container: "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
    text: "font-sans text-2xl font-bold leading-none",
    gap: "gap-3",
  },
};

const variantMap: Record<LogoVariant, { container: string; text: string }> = {
  dark: {
    container: "bg-white/15 border border-white/30",
    text: "text-white",
  },
  light: {
    container: "bg-primary/10",
    text: "text-primary",
  },
  sidebar: {
    container: "bg-primary",
    text: "text-primary",
  },
};

const IMG_SRC = "/icon.png";

export function JoventyLogo({
  variant = "light",
  size = "md",
  className = "",
  showText = true,
  href,
}: JoventyLogoProps) {
  const s = sizeMap[size];
  const v = variantMap[variant];

  const inner = (
    <span className={`flex items-center ${s.gap} ${className}`}>
      <span className={`${s.container} ${v.container}`}>
        <img src={IMG_SRC} alt="Joventy logo" className={s.img} />
      </span>
      {showText && (
        <span className={`${s.text} ${v.text}`}>Joventy</span>
      )}
    </span>
  );

  if (href !== undefined) {
    return <Link href={href}>{inner}</Link>;
  }

  return inner;
}
