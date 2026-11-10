"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signInWithEmailAndPassword } from "firebase/auth";
import { toast } from "sonner";
import { MapPinned, ShieldCheck, Users2 } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Logo, LogoMark } from "@/components/layout/Logo";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

const HIGHLIGHTS = [
  {
    icon: MapPinned,
    title: "All 25 provinces, one pipeline",
    description: "Track every applicant from information session through committee decision.",
  },
  {
    icon: Users2,
    title: "Built for field teams",
    description: "Exam, interview, and home visit data capture designed for real conditions.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based by design",
    description: "Committee, NGO partners, and donors each see exactly what they need to.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Role-based redirect happens in (dashboard)/layout.tsx once claims load;
  // /dashboard is a safe landing default for every role.
  function goToDashboard() {
    router.push("/dashboard");
  }

  async function onSubmit(values: LoginValues) {
    setIsSubmitting(true);
    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), values.email, values.password);
      // useAuth()'s onIdTokenChanged listener also writes this cookie, but
      // fire-and-forget — navigating before it lands races the middleware's
      // cookie check on the very first sign-in in a browser with no prior
      // session, bouncing straight back to /login. Await our own write here
      // so the cookie is guaranteed to exist before we navigate.
      const idToken = await credential.user.getIdToken();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      goToDashboard();
    } catch {
      toast.error("Sign in failed. Check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1.2px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="text-sm font-medium text-primary-foreground/80">
            NGO Education Partnership
          </span>
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Scholarship Selection Tracker
          </h1>
          <p className="text-primary-foreground/80">
            One system to recruit, assess, and select scholarship students across
            all provinces of Cambodia — from information session to final
            committee approval.
          </p>

          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4.5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm text-primary-foreground/70">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} NGO Education Partnership. Internal use only.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center space-y-2 text-center">
            <Logo className="mb-2" />
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to continue to your dashboard.
            </p>
          </div>

          <div className="space-y-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.org"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Accounts are created by an administrator. Contact your Program
            Manager if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
