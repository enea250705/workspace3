import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

// Define utility classes as CSS variables with direct HSL notation
export const cn = {
  background: "bg-[hsl(var(--background))]",
  foreground: "text-[hsl(var(--foreground))]",
  card: "bg-[hsl(var(--card))]",
  cardForeground: "text-[hsl(var(--card-foreground))]",
  popover: "bg-[hsl(var(--popover))]",
  popoverForeground: "text-[hsl(var(--popover-foreground))]",
  primary: "bg-[hsl(var(--primary))]",
  primaryForeground: "text-[hsl(var(--primary-foreground))]",
  secondary: "bg-[hsl(var(--secondary))]",
  secondaryForeground: "text-[hsl(var(--secondary-foreground))]",
  muted: "bg-[hsl(var(--muted))]",
  mutedForeground: "text-[hsl(var(--muted-foreground))]",
  accent: "bg-[hsl(var(--accent))]",
  accentForeground: "text-[hsl(var(--accent-foreground))]",
  destructive: "bg-[hsl(var(--destructive))]",
  destructiveForeground: "text-[hsl(var(--destructive-foreground))]",
  border: "border-[hsl(var(--border))]",
  input: "border-[hsl(var(--input))]",
  ring: "ring-[hsl(var(--ring))]",
}; 