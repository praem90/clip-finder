import Media from "./pages/media";
import Search from "./pages/search";
import { AppSidebar } from "#components/app-sidebar";
import { SidebarProvider } from "#components/ui/sidebar"
import { TooltipProvider } from "#components/ui/tooltip";
import { useNavigation, Page } from "@/contexts/NavigationContext";

export function App() {
  const { activePage } = useNavigation();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="p-4 pt-0 h-screen w-full">
          {activePage === Page.Search && <Search />}
          {activePage === Page.Library && <Media />}
        </main>
      </SidebarProvider>
    </TooltipProvider>
  )
}


export default App;
