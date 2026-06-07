import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";

interface EngineContextType {
	engineReady: boolean;
}

export const EngineContext = createContext<EngineContextType>({
	engineReady: false,
});

export const EngineProvider = ({ children }: { children: ReactNode }) => {
	const [engineReady, setEngineReady] = useState(false);

	// The backend emits `engine-ready` once the CLIP model finishes loading
	// (model download + init). Register the listener first, then announce
	// ourselves: a fast (cached) load can finish before this listener exists,
	// and Tauri does not replay events to listeners that attach later — so the
	// backend replays current readiness in response to `frontend-ready`.
	useEffect(() => {
		let cancelled = false;
		let unlisten: (() => void) | undefined;
		(async () => {
			const fn = await listen<boolean>("engine-ready", (e) => setEngineReady(e.payload));
			if (cancelled) return fn();
			unlisten = fn;
			await emit("frontend-ready");
		})();
		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, []);

	return (<EngineContext.Provider value={{ engineReady }}>
		{children}
	</EngineContext.Provider>
	);
};

export const useEngine = () => {
	const context = useContext(EngineContext);
	if (!context) {
		throw new Error("useEngine must be used within an EngineProvider");
	}
	return context;
}
