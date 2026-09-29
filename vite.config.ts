import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // Permite probar desde el celular con enlaces temporales https (probar_en_celular.bat).
      allowedHosts: ['.trycloudflare.com', '.loca.lt'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      // Puerto propio de recarga automática (evita choque con otros proyectos, p. ej. Calcol).
      hmr: process.env.DISABLE_HMR !== 'true' ? { port: 24720 } : false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data/**', '**/data_store*.json', '**/*.bat', '**/*.log', '**/herramientas/**'] },
    },
  };
});
