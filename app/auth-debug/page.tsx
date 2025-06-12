import { AuthDebug } from "@/src/components/auth/auth-debug";

export default function AuthDebugPage() {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Auth System Debug</h1>
        <AuthDebug />
      </div>
    </div>
  );
}