import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "@/App"
import { SessionProvider } from "@/session"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && window.isSecureContext && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
  })
}
