import {Link} from "react-router-dom";
import {ShieldAlert} from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-5">
      <section className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-lg">
        <ShieldAlert className="mx-auto size-10 text-[#D97706]" />
        <h1 className="mt-4 text-xl font-bold text-[#0F172A]">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-600">Your assigned role does not permit access to this KAVACH AI workspace.</p>
        <Link to="/dashboard" className="mt-6 inline-flex rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white">Return to dashboard</Link>
      </section>
    </main>
  );
}
