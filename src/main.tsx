import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listen, TauriEvent } from '@tauri-apps/api/event';
import { Toaster } from "@/components/ui/sonner";

listen(TauriEvent.DRAG_DROP, (event) => {
  const filePaths = event.payload;
  if (filePaths?.paths?.length > 0) {
    const firstPath = filePaths.paths[0];

    // Create and dispatch a standard browser event
    const dropEvent = new CustomEvent('tauri-file-dropped', {
      detail: firstPath
    });
    window.dispatchEvent(dropEvent);
  }
});
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
