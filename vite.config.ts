import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      // Use src/server.ts for the SSR error wrapper.
      server: { entry: "server" },
    }),
    react(),
    tsconfigPaths(),
    tailwindcss(),
    nitro({ preset: "vercel" }),
  ],
});
