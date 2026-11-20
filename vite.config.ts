import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: { alias: { "@": path.join(root, "src") } },
  plugins: [react(), tailwindcss()],
  server: { host: "0.0.0.0", port: 4477 },
})
