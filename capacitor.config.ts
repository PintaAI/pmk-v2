import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.pempek.kasir",
  appName: "Kasir",
  webDir: "out",
  server: {
    url: "https://pmk-v2.vercel.app",
    cleartext: false,
    allowNavigation: ["pmk-v2.vercel.app"],
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
