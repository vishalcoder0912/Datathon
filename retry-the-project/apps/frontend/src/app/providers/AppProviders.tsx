import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import AppErrorBoundary from "@/app/providers/AppErrorBoundary";
import { DataProvider } from "@/features/data/context/DataContext";
import { LocalDataProvider } from "@/features/data/context/localDataContext";

interface AppProvidersProps {
  children: ReactNode;
}

const AppProviders = ({ children }: AppProvidersProps) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="light"
    forcedTheme="light"
    enableSystem={false}
    storageKey="insightflow-theme"
    disableTransitionOnChange
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppErrorBoundary>
        <DataProvider>
          <LocalDataProvider>{children}</LocalDataProvider>
        </DataProvider>
      </AppErrorBoundary>
    </TooltipProvider>
  </ThemeProvider>
);

export default AppProviders;
