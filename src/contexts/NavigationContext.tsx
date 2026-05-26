import { createContext, ReactNode, useContext, useState } from "react";

export enum Page {
	Search = "search",
	Library = "library",
}

interface NavigationContextType {
	activePage: Page;
	setActivePage: (page: Page) => void;
}

export const NavigationContext = createContext<NavigationContextType>({
	activePage: Page.Search,
	setActivePage: () => { },
});

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
	const [activePage, setActivePage] = useState(Page.Search);

	return (<NavigationContext.Provider value={{ activePage, setActivePage }}>
		{children}
	</NavigationContext.Provider>
	);
};

export const useNavigation = () => {
	const context = useContext(NavigationContext);
	if (!context) {
		throw new Error("useNavigation must be used within a NavigationProvider");
	}
	return context;
}

