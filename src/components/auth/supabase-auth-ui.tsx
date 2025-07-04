"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser-client";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

export function SupabaseAuthUI() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Detect test environment to disable OAuth providers
  const isTestEnvironment = 
    typeof window !== "undefined" && (
      window.location.hostname === "localhost" ||
      process.env.NODE_ENV === "test" ||
      process.env.PLAYWRIGHT_TEST === "true"
    );

  // Fix hydration by ensuring consistent rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get initial session and listen for auth changes
  useEffect(() => {
    if (!supabase || !mounted) return;

    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        setIsLoading(false);
      } catch (error) {
        console.error("Error getting session:", error);
        setIsLoading(false);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (event === "SIGNED_IN" && session) {
        router.push("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, mounted]);

  // Redirect if already authenticated
  useEffect(() => {
    if (mounted && user && !isLoading) {
      router.push("/dashboard");
    }
  }, [mounted, user, isLoading, router]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/auth");
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // Don't render if Supabase client is not available (SSR)
  if (!supabase) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Authentication not available in SSR environment
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (user) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Welcome back!</CardTitle>
          <CardDescription className="text-muted-foreground">
            Signed in as {user.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleSignOut} variant="outline" className="w-full">
            Sign Out
          </Button>
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-lg">
      <CardHeader>
        <CardTitle className="text-foreground">
          Welcome to MEXC Sniper Bot
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Sign in to your account or create a new one
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "hsl(var(--primary))",
                  brandAccent: "hsl(var(--primary))",
                  brandButtonText: "hsl(var(--primary-foreground))",
                  defaultButtonBackground: "hsl(var(--secondary))",
                  defaultButtonBackgroundHover: "hsl(var(--secondary)/0.8)",
                  defaultButtonBorder: "hsl(var(--border))",
                  defaultButtonText: "hsl(var(--secondary-foreground))",
                  dividerBackground: "hsl(var(--border))",
                  inputBackground: "hsl(var(--background))",
                  inputBorder: "hsl(var(--border))",
                  inputBorderHover: "hsl(var(--border))",
                  inputBorderFocus: "hsl(var(--ring))",
                  inputText: "hsl(var(--foreground))",
                  inputLabelText: "hsl(var(--foreground))",
                  inputPlaceholder: "hsl(var(--muted-foreground))",
                  messageText: "hsl(var(--foreground))",
                  messageTextDanger: "hsl(var(--destructive))",
                  anchorTextColor: "hsl(var(--primary))",
                  anchorTextHoverColor: "hsl(var(--primary)/0.8)",
                },
                space: {
                  spaceSmall: "4px",
                  spaceMedium: "8px",
                  spaceLarge: "16px",
                  labelBottomMargin: "8px",
                  anchorBottomMargin: "4px",
                  emailInputSpacing: "4px",
                  socialAuthSpacing: "4px",
                  buttonPadding: "10px 15px",
                  inputPadding: "10px 15px",
                },
                fontSizes: {
                  baseBodySize: "14px",
                  baseInputSize: "14px",
                  baseLabelSize: "14px",
                  baseButtonSize: "14px",
                },
                borderWidths: {
                  buttonBorderWidth: "1px",
                  inputBorderWidth: "1px",
                },
                radii: {
                  borderRadiusButton: "6px",
                  buttonBorderRadius: "6px",
                  inputBorderRadius: "6px",
                },
              },
            },
            className: {
              anchor: "text-primary hover:text-primary/80",
              button: "bg-primary text-primary-foreground hover:bg-primary/90",
              container: "flex flex-col space-y-4",
              divider: "border-border",
              input:
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              label:
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              loader: "animate-spin",
              message: "text-sm",
            },
          }}
          providers={isTestEnvironment ? [] : ["google", "github"]}
          redirectTo={
            typeof window !== "undefined"
              ? `${window.location.origin}/dashboard`
              : "/dashboard"
          }
          onlyThirdPartyProviders={false}
          magicLink={true}
          view="sign_in"
          showLinks={true}
          localization={{
            variables: {
              sign_in: {
                email_label: "Email address",
                password_label: "Password",
                email_input_placeholder: "Your email address",
                password_input_placeholder: "Your password",
                button_label: "Sign In",
                loading_button_label: "Signing in...",
                social_provider_text: "Sign in with {{provider}}",
                link_text: "Don't have an account? Sign up",
              },
              sign_up: {
                email_label: "Email address",
                password_label: "Create a password",
                email_input_placeholder: "Your email address",
                password_input_placeholder: "Create a password",
                button_label: "Sign Up",
                loading_button_label: "Signing up...",
                social_provider_text: "Sign up with {{provider}}",
                link_text: "Already have an account? Sign in",
                confirmation_text: "Check your email for the confirmation link",
              },
              magic_link: {
                email_input_label: "Email address",
                email_input_placeholder: "Your email address",
                button_label: "Send magic link",
                loading_button_label: "Sending magic link...",
                link_text: "Send a magic link email",
                confirmation_text: "Check your email for the magic link",
              },
              forgotten_password: {
                email_label: "Email address",
                password_label: "Your password",
                email_input_placeholder: "Your email address",
                button_label: "Send reset instructions",
                loading_button_label: "Sending reset instructions...",
                link_text: "Forgot your password?",
                confirmation_text:
                  "Check your email for the password reset link",
              },
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
