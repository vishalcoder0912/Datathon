import { Outlet } from "react-router-dom";
import AppSidebar from "@/shared/layout/AppSidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]" style={{ backgroundColor: 'var(--kavach-surface, #F8FAFC)' }}>
      <div className="grid min-h-screen grid-cols-[256px_minmax(0,1fr)]">
        <AppSidebar />

        <div className="flex min-w-0 flex-col">
          <div role="note" className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-xs font-medium text-amber-950 xl:px-8">
            Prototype using synthetic data. All intelligence outputs require human verification and must not be used as the sole basis for law-enforcement action.
          </div>
          <main className="min-w-0 flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-none px-6 py-6 xl:px-8 2xl:px-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
