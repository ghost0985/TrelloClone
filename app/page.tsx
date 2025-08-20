// File: src/app/page.tsx (or src/app/(marketing)/page.tsx if you use routes)
"use client";

import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckSquare,
  Users,
  Zap,
  Shield,
  ArrowRight,
  Trello,
} from "lucide-react";
import Navbar from "@/components/navbar";

export default function HomePage() {
  const { isSignedIn, user } = useUser();

  const features = [
    {
      icon: CheckSquare,
      title: "Team Management",
      description: "Organize your tasks with intuitive drag-and-drop boards",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Work together with your team in real time",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Built with Next.js for optimal performance",
    },
    {
      icon: Shield,
      title: "Secure",
      description: "Enterprise‑grade auth with Clerk",
    },
  ];

  return (
    <div
      className="
        min-h-screen 
        bg-gradient-to-br from-blue-50 via-background to-purple-50
        dark:from-[#0b1220] dark:via-background dark:to-[#0b1220]
        text-foreground
      "
    >
      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Organize work and life,{" "}
            <span className="text-blue-600 dark:text-blue-400">finally.</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            TrelloClone helps teams move work forward. Collaborate, manage
            projects, and reach new productivity peaks. From high rises to the
            home office, the way your team works is unique—accomplish it all
            with TrelloClone.
          </p>

          {!isSignedIn && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignInButton>
                <Button size="lg" className="text-lg px-8">
                  Start for free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignInButton>
              <Button variant="outline" className="text-lg px-8">
                Watch demo
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need to stay organized
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features to help your team collaborate and get more done.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="
                border 
                transition-shadow 
                hover:shadow-lg
              "
            >
              <CardHeader className="text-center">
                <div
                  className="
                    mx-auto w-12 h-12 rounded-lg mb-4
                    bg-blue-100 dark:bg-blue-500/20
                    flex items-center justify-center
                  "
                >
                  <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 dark:bg-blue-700 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of teams already using TrelloClone to organize their
            work.
          </p>

          {!isSignedIn && (
            <SignUpButton>
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Start your free trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </SignUpButton>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card text-card-foreground border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Trello className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span className="text-xl font-bold">TrelloClone</span>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6 text-sm text-muted-foreground">
              <span>
                &copy; {new Date().getFullYear()} TrelloClone. Logan Heath. All
                Rights Reserved.
              </span>
              <span>Built with Next.js & Clerk</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
