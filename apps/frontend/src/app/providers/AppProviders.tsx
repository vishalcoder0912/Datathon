import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import AppErrorBoundary from "@/app/providers/AppErrorBoundary";
import { DataProvider } from "@/features/data/context/DataContext";
import { LocalDataProvider } from "@/features/data/context/localDataContext";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {AuthProvider} from "@/auth/AuthProvider";
import { ImportDataProvider } from "@/kavach/context/ImportDataContext";

interface AppProvidersProps {
  children: ReactNode;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppProviders = ({children}: AppProvidersProps) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="light"
    forcedTheme="light"
    enableSystem={false}
    storageKey="insightflow-theme"
    disableTransitionOnChange
  >
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppErrorBoundary>
            <ImportDataProvider>
              <DataProvider>
                <LocalDataProvider>{children}</LocalDataProvider>
              </DataProvider>
            </ImportDataProvider>
          </AppErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default AppProviders;
