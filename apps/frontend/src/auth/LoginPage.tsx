import {useState, type FormEvent} from "react";
import {Navigate, useLocation, useNavigate} from "react-router-dom";
import {Shield, AlertTriangle} from "lucide-react";
import {Button} from "@/shared/components/ui/button";
import {Input} from "@/shared/components/ui/input";
import {useAuth} from "@/auth/AuthProvider";

export default function LoginPage() {
  const {login, isAuthenticated} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@kavach.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = (location.state as {from?: string} | null)?.from ?? "/dashboard";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, {replace: true});
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#0891B2] text-white">
            <Shield className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">KAVACH AI</h1>
            <p className="text-sm text-slate-500">Secure intelligence workspace</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Email
            <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Password
            <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-[#DC2626]">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}
          <Button type="submit" className="w-full bg-[#1D4ED8]" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Prototype using synthetic data. All intelligence outputs require human verification and must not be used as the sole basis for law-enforcement action.
        </p>
      </section>
    </main>
  );
}
