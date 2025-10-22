import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import LandingPage from "@/pages/landing";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="hmsync-theme">
        <Toaster />
        <LandingPage />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
