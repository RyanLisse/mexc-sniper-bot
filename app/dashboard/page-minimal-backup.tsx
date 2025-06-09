"use client";

export default function MinimalDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Trading Dashboard</h1>
        <p className="text-slate-400">Minimal dashboard test</p>
        
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold">Auto-Snipe Status</h2>
            <p className="text-green-400 text-xl font-bold">Test Working</p>
          </div>
          
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold">System Status</h2>
            <p className="text-blue-400 text-xl font-bold">Operational</p>
          </div>
        </div>
      </div>
    </div>
  );
}