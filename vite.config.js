import { defineConfig } from 'vite';

// The GitHub Pages project site is deployed under the /wo_wo/ path,
// so base must match the repository name or assets will point to the site root and 404.
// For a custom domain or user site (username.github.io), set base to '/'.
const base = process.env.GITHUB_ACTIONS ? '/wo_wo/' : '/';

export default defineConfig({
    base,
    server: {
        port: 5173,
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    }
});
