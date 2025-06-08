import { redirect } from "next/navigation";

// Redirect root to dashboard - no homepage needed
export default function HomePage() {
  redirect("/dashboard");
}
