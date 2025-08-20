// File: src/app/pricing/page.tsx
"use client";

import Navbar from "@/components/navbar";
import { PricingTable } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "@/lib/themeProvided";
import { Card, CardContent } from "@/components/ui/card";

export default function PricingPage() {
  const { theme } = useTheme(); 

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="py-12 container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose your plan</h1>
          <p className="text-xl text-muted-foreground">
            Select the perfect plan for your needs
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="p-0">
              <PricingTable
                newSubscriptionRedirectUrl="/dashboard"
                appearance={{ baseTheme: theme === "dark" ? dark : undefined }}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
