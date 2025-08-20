import { PlanProvider } from "@/lib/context/PlanContext";
import { ThemeProvider } from "@/lib/themeProvided";
import { auth } from "@clerk/nextjs/server";

export default async function dashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { has } = await auth();
  const hasProPlan = has({ plan: "pro_user" });
  const hasEnterprisePlan = has({ plan: "enterprise_user" });

  return (
    <ThemeProvider>
      <PlanProvider
        hasProPlan={hasProPlan}
        hasEnterprisePlan={hasEnterprisePlan}
      >
        {children}
      </PlanProvider>
    </ThemeProvider>
  );
}
