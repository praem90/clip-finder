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
import { useNavigation } from "@/contexts/NavigationContext";

export function AppSidebar() {
	const { activePage, setActivePage } = useNavigation();
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader />
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild isActive={activePage === "search"} onClick={() => setActivePage("search")}>
								<Search /> Search
							</SidebarMenuButton>
							<SidebarMenuButton asChild isActive={activePage === "library"} onClick={() => setActivePage("library")}>
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
