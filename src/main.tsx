import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "@/App"
import { isNativeApp } from "@/native.ts"
import { SessionProvider } from "@/session"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && window.isSecureContext && "serviceWorker" in navigator && !isNativeApp()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
  })
}
