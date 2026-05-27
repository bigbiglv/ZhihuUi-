import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import manifest from './manifest.json'

// Vite 插件：移除 CRXJS 在 MAIN world 注入时由于不支持 HMR 产生的控制台警告
// 该警告会被 Chrome 扩展管理页捕获并标记为错误，影响开发体验
const removeCrxjsMainWorldWarning = () => {
  return {
    name: 'remove-crxjs-main-world-warning',
    enforce: 'post' as const,
    transform(code: string, id: string) {
      if (id.includes('.ts-loader') || id.includes('crx')) {
        if (code.includes('Content-script doesn\'t support HMR because the world is MAIN')) {
          return code.replace(
            /console\.warn\([^)]+"Content-script doesn't support HMR because the world is MAIN"[^)]+\);?/g,
            ''
          )
        }
      }
      return null
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    vue(),
    crx({ manifest }),
    removeCrxjsMainWorldWarning(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
})
