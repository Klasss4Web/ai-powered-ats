import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Requests starting with /api will be sent to the target
      "/api": {
        target:
          "http://ats-matcher-backend-alb-1819594825.eu-west-2.elb.amazonaws.com",
        changeOrigin: true,
        secure: false, // Set to false to ignore SSL certificate issues if any
      },
    },
  },
});
