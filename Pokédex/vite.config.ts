import { defineConfig } from 'vite';

export default defineConfig({
    // Caminhos relativos: funciona em GitHub Pages / subpastas
    base: './',
    build: {
        target: 'es2022',
        // GitHub Pages publica a partir de /docs na raiz do repositório
        outDir: '../docs',
        emptyOutDir: true,
        assetsInlineLimit: 0,
    },
    server: {
        port: 5173,
        strictPort: false,
    },
});
