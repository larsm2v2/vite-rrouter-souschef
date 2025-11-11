import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // bind to all addresses so both IPv4 and IPv6 localhost work (prevents "refused to connect" when
    // the dev server listens only on IPv6 ::1 but browser uses 127.0.0.1)
    host: true,
    port: 5173,
  },
})
