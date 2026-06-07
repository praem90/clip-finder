import Media from "./pages/media";
import Search from "./pages/search";
import { AppSidebar } from "#components/app-sidebar";
import { SidebarProvider } from "#components/ui/sidebar"
import { TooltipProvider } from "#components/ui/tooltip";
import { useNavigation, Page } from "@/contexts/NavigationContext";
import { useEffect } from "react";

export function App() {
  const { activePage, setActivePage } = useNavigation();

  // ⌘1 / Ctrl+1 → Search, ⌘2 / Ctrl+2 → Library
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.repeat) return;
      if (e.key === "1") {
        e.preventDefault();
        setActivePage(Page.Search);
      } else if (e.key === "2") {
        e.preventDefault();
        setActivePage(Page.Library);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setActivePage]);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="h-screen w-full overflow-hidden">
          {activePage === Page.Search && <Search />}
          {activePage === Page.Library && <Media />}
        </main>
      </SidebarProvider>
    </TooltipProvider>
  )
}


export default App;
