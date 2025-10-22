
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import LandingPage from "@/pages/landing";

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="landing-theme">
      <Toaster />
      <LandingPage />
    </ThemeProvider>
  );
}

export default App;
