import type { CapacitorConfig } from "@capacitor/cli"
import { API_ORIGIN, APP_NAME, BUNDLE_ID } from "./src/shared/app.ts"

const config: CapacitorConfig = {
  appId: BUNDLE_ID,
  appName: APP_NAME,
  webDir: "dist",
  server: {
    androidScheme: "https",
    allowNavigation: [API_ORIGIN.replace(/^https?:\/\//, "")],
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#0c0a08",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0c0a08",
      showSpinner: false,
    },
  },
}

export default config
