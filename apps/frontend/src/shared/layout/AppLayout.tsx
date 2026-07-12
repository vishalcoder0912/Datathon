import { Outlet } from "react-router-dom";
import AppSidebar from "@/shared/layout/AppSidebar";
import CommandTopBar from "@/shared/layout/CommandTopBar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="grid min-h-screen grid-cols-[256px_minmax(0,1fr)]">
        <AppSidebar />

        <div className="flex min-w-0 flex-col">
          <CommandTopBar />

          <main className="min-w-0 flex-1 overflow-x-hidden bg-[#F8FAFC]">
            <div className="mx-auto w-full max-w-none px-6 py-6 xl:px-8 2xl:px-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
