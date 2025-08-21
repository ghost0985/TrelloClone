"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import SupabaseProvider from "@/lib/supabase/SupabaseProvider";
import { ThemeProvider, useTheme } from "@/lib/themeProvided";

function ClerkWithTheme({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{ baseTheme: theme === "dark" ? dark : undefined }}
    >
      <SupabaseProvider>{children}</SupabaseProvider>
    </ClerkProvider>
  );
}

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ClerkWithTheme>{children}</ClerkWithTheme>
    </ThemeProvider>
  );
}
