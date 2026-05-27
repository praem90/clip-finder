import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarTrigger,
} from "#components/ui/sidebar"
import { Library, Search } from "lucide-react"
import { useNavigation, Page } from "@/contexts/NavigationContext";

export function AppSidebar() {
	const { activePage, setActivePage } = useNavigation();
	return (
		<Sidebar collapsible="icon" className="hairline-r">
			<SidebarHeader className="px-3 pt-5 pb-4">
				<div className="flex items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
					<Aperture />
					<div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
						<span className="font-heading text-[13px] font-medium tracking-tight">clipfinder</span>
						<span className="mono-label mt-1">v0.1 · console</span>
					</div>
				</div>
			</SidebarHeader>

			<div className="mono-label px-4 pb-2 group-data-[collapsible=icon]:hidden">Navigate</div>

			<SidebarContent className="px-2">
				<SidebarGroup className="p-0">
					<SidebarMenu className="gap-0.5">
						<SidebarMenuItem>
							<NavButton
								active={activePage === Page.Search}
								onClick={() => setActivePage(Page.Search)}
								icon={<Search className="size-4" />}
								label="Search"
								shortcut="1"
							/>
							<NavButton
								active={activePage === Page.Library}
								onClick={() => setActivePage(Page.Library)}
								icon={<Library className="size-4" />}
								label="Library"
								shortcut="2"
							/>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="px-3 pb-3">
				<div className="hairline-t -mx-3 mb-3" />
				<div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
					<div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
						<span className="size-1.5 rounded-full bg-amber-400 amber-dot" />
						<span className="mono-label">engine · ready</span>
					</div>
					<SidebarTrigger className="size-7 rounded-sm border border-white/5 bg-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground" />
				</div>
			</SidebarFooter>
		</Sidebar>
	)
}

function NavButton({
	active,
	onClick,
	icon,
	label,
	shortcut,
}: {
	active: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
	shortcut: string;
}) {
	return (
		<SidebarMenuButton
			isActive={active}
			onClick={onClick}
			className="group/nav relative h-9 rounded-sm px-2.5 text-[13px] text-muted-foreground hover:bg-white/[0.03] hover:text-foreground data-[active=true]:bg-transparent data-[active=true]:text-foreground"
		>
			<span
				aria-hidden
				className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-amber-400 transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
			/>
			{icon}
			<span className="flex-1">{label}</span>
			<span className="kbd group-data-[collapsible=icon]:hidden">⌘{shortcut}</span>
		</SidebarMenuButton>
	);
}

function Aperture() {
	return (
		<svg viewBox="0 0 24 24" fill="none" className="size-7 text-amber-400" aria-hidden>
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.25" />
			<path d="M12 3 L14 11 L21 11.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
			<path d="M21 12 L14.5 13 L17 20" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
			<path d="M19 17 L13 12 L11 21" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
			<path d="M11 21 L11 12.5 L3 13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
			<path d="M3 12 L11 11 L7 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
			<path d="M5 6 L11 11.5 L12 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
		</svg>
	);
}
