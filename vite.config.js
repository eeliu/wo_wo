import { defineConfig } from 'vite';

// GitHub Pages 项目站点部署在子路径 /bei_bei_recite/ 下，
// 因此需要设置 base 为仓库名，否则资源路径会指向站点根目录而 404。
// 若部署到自定义域名或用户站点（username.github.io），可将 base 改为 '/'。
const base = process.env.GITHUB_ACTIONS ? '/bei_bei_recite/' : '/';

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
