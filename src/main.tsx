import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listen, TauriEvent } from '@tauri-apps/api/event';
import { Toaster } from "#components/ui/sonner";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { EngineProvider } from "@/contexts/EngineContext";

listen(TauriEvent.DRAG_DROP, (event: { payload: { paths: string[] } }) => {
  const filePaths = event.payload;
  if (filePaths?.paths?.length > 0) {
    filePaths.paths.forEach((path: string) => {
      const dropEvent = new CustomEvent('tauri-file-dropped', {
        detail: path
      });
      window.dispatchEvent(dropEvent);
    });
  }
});
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <NavigationProvider>
        <EngineProvider>
          <App />
          <Toaster />
        </EngineProvider>
      </NavigationProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
