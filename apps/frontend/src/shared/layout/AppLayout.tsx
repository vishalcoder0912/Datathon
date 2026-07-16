import { Outlet } from "react-router-dom";
import AppSidebar from "@/shared/layout/AppSidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]" style={{ backgroundColor: 'var(--kavach-surface, #F8FAFC)' }}>
      <div className="grid min-h-screen grid-cols-[256px_minmax(0,1fr)]">
        <AppSidebar />

        <div className="flex min-w-0 flex-col">
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
