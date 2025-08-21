// File: src/components/AppProviders.tsx
"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import SupabaseProvider from "@/lib/supabase/SupabaseProvider";
import { ThemeProvider, useTheme } from "@/lib/themeProvided";

function ClerkWithTheme({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!pk) {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  return (
    <ClerkProvider
      publishableKey={pk}
      appearance={{ baseTheme: theme === "dark" ? dark : undefined }}
    >
      <SupabaseProvider>{children}</SupabaseProvider>
    </ClerkProvider>
  );
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ClerkWithTheme>{children}</ClerkWithTheme>
    </ThemeProvider>
  );
}
