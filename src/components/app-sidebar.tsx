import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarTrigger
} from "#components/ui/sidebar"
import { Library, Search } from "lucide-react"
import { useNavigation, Page } from "@/contexts/NavigationContext";

export function AppSidebar() {
	const { activePage, setActivePage } = useNavigation();
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader />
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton isActive={activePage === "search"} onClick={() => setActivePage(Page.Search)}>
								<Search /> Search
							</SidebarMenuButton>
							<SidebarMenuButton isActive={activePage === "library"} onClick={() => setActivePage(Page.Library)}>
								<Library /> Library
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter >
				<SidebarTrigger />
			</SidebarFooter>
		</Sidebar>
	)
}
