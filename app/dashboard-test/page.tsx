"use client";

export default function TestDashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Test Dashboard</h1>
      <p>This is a minimal test dashboard to isolate the client-side error.</p>
      <div className="mt-4 p-4 border rounded">
        <h2 className="text-lg font-semibold">Basic Test</h2>
        <p>If you can see this, the basic React rendering works.</p>
      </div>
    </div>
  );
}
