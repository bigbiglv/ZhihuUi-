import { createApp } from 'vue'
import App from '@/App.vue'
import tailwindStyles from '@/style.css?inline'
import { matchRoute } from '@/utils/routeMatcher'

// ==================== 防闪烁：最早时机路由检测与占位骨架注入 ====================
// 此段代码在 content script 被加载后同步执行（早于 Vue bundle 的 async import 解析），
// 配合 manifest.json 注入的 early-hide.css 实现零闪烁页面切换

const earlyMatchResult = matchRoute(window.location.pathname)

if (!earlyMatchResult.reshape) {
  // 当前页面不需要重塑 → 立即移除 early-hide.css 注入的样式，放行知乎原站渲染
  // early-hide.css 由 manifest.json 通过 <link> 或内联 <style> 注入，
  // 查找并禁用它以恢复 #root 的正常显示
  const disableEarlyHide = () => {
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules
        if (
          rules.length > 0 &&
          rules[0] instanceof CSSStyleRule &&
          rules[0].selectorText === '#root' &&
          rules[0].style.getPropertyValue('opacity') === '0.001'
        ) {
          sheet.disabled = true
          break
        }
      } catch {
        // 跨域样式表无法读取规则，跳过
      }
    }
  }

  // 在 document_start 阶段样式表可能尚未完全初始化，尝试立即执行 + DOMContentLoaded 兜底
  disableEarlyHide()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', disableEarlyHide, { once: true })
  }
}

/**
 * 在需要重塑的页面上注入占位骨架屏
 * 使用纯 DOM + 内联样式，不依赖 Tailwind（因为此时 Tailwind 尚未加载）
 */
const injectPlaceholderSkeleton = () => {
  if (!earlyMatchResult.reshape) return

  // 检测暗色模式偏好（与 content.ts 原有逻辑保持一致）
  const savedDarkMode = localStorage.getItem('zhihu-reshaped-dark-mode')
  const isDark =
    savedDarkMode === 'true' ||
    (savedDarkMode === null &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const bgColor = isDark ? '#15171e' : '#f6f8fa'
  const cardBg = isDark ? '#1c1f26' : '#ffffff'
  const shimmerTo = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
  const skeletonBg = isDark ? '#272c38' : '#e2e8f0'
  const headerBg = isDark ? 'rgba(28,31,38,0.85)' : 'rgba(255,255,255,0.85)'
  const borderColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(226,232,240,0.8)'

  const container = document.createElement('div')
  container.id = 'zhihu-reshape-skeleton'
  container.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 999998;
    background: ${bgColor};
    font-family: Inter, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow: hidden;
  `

  container.innerHTML = `
    <style>
      @keyframes zhihu-reshape-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .zr-skeleton-bar {
        background: ${skeletonBg};
        border-radius: 6px;
        position: relative;
        overflow: hidden;
      }
      .zr-skeleton-bar::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, ${shimmerTo}, transparent);
        animation: zhihu-reshape-shimmer 1.5s ease-in-out infinite;
      }
    </style>
    <!-- 模拟 Header -->
    <div style="
      height: 64px;
      background: ${headerBg};
      backdrop-filter: blur(12px);
      border-bottom: 1px solid ${borderColor};
      display: flex;
      align-items: center;
      padding: 0 max(16px, calc((100vw - 1152px) / 2 + 16px));
    ">
      <div style="
        background: linear-gradient(to right, #2563eb, #6366f1);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 2px;
      ">ZHIHU · 重塑</div>
    </div>
    <!-- 模拟骨架卡片 -->
    <div style="
      max-width: 1152px;
      margin: 32px auto;
      padding: 0 16px;
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 32px;
    ">
      <div style="display:flex;flex-direction:column;gap:24px;">
        ${[1, 2, 3]
          .map(
            () => `
          <div style="
            background: ${cardBg};
            border-radius: 16px;
            padding: 24px;
            border: 1px solid ${borderColor};
          ">
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="zr-skeleton-bar" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;"></div>
              <div style="flex:1;">
                <div class="zr-skeleton-bar" style="width:96px;height:14px;margin-bottom:8px;"></div>
                <div class="zr-skeleton-bar" style="width:160px;height:10px;"></div>
              </div>
            </div>
            <div style="margin-top:16px;">
              <div class="zr-skeleton-bar" style="width:75%;height:18px;margin-bottom:10px;"></div>
              <div class="zr-skeleton-bar" style="width:100%;height:12px;margin-bottom:8px;"></div>
              <div class="zr-skeleton-bar" style="width:83%;height:12px;"></div>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
      <div>
        <div style="
          background: ${cardBg};
          border-radius: 16px;
          padding: 24px;
          border: 1px solid ${borderColor};
        ">
          <div class="zr-skeleton-bar" style="width:60%;height:14px;margin-bottom:16px;"></div>
          <div class="zr-skeleton-bar" style="width:100%;height:10px;margin-bottom:8px;"></div>
          <div class="zr-skeleton-bar" style="width:80%;height:10px;"></div>
        </div>
      </div>
    </div>
  `

  // 在 body 可用时立即注入
  const inject = () => document.body.appendChild(container)
  if (document.body) {
    inject()
  } else {
    document.addEventListener('DOMContentLoaded', inject, { once: true })
  }
}

// ==================== 异步初始化：先读取重塑开关，再决定是否启动 ====================
// 骨架屏先同步注入（防闪烁），若用户关闭了重塑则在读取 storage 后立即回退
injectPlaceholderSkeleton()

const disableEarlyHideCSSGlobal = () => {
  for (const sheet of document.styleSheets) {
    try {
      const rules = sheet.cssRules
      if (
        rules.length > 0 &&
        rules[0] instanceof CSSStyleRule &&
        rules[0].selectorText === '#root' &&
        rules[0].style.getPropertyValue('opacity') === '0.001'
      ) {
        sheet.disabled = true
        break
      }
    } catch {
      // 跨域样式表无法读取规则，跳过
    }
  }
}

// 读取 storage 开关状态，决定后续行为
let reshapeEnabledFromStorage = true
try {
  const result = await chrome.storage.local.get('reshapeEnabled')
  reshapeEnabledFromStorage = result.reshapeEnabled !== false
} catch {
  // storage 不可用时保持默认行为（继续重塑）
}

if (!reshapeEnabledFromStorage && earlyMatchResult.reshape) {
  // 用户通过 popup 关闭了重塑 → 撤销同步阶段注入的骨架和 early-hide
  const skeleton = document.getElementById('zhihu-reshape-skeleton')
  if (skeleton) skeleton.remove()
  disableEarlyHideCSSGlobal()
}

// ==================== Vue App 挂载 ====================

console.log(
  '[Content Script] 初始化并注入成功，当前路径:',
  window.location.pathname,
)

let appContainer: HTMLDivElement | null = null
let appInstance: any = null

/**
 * 挂载 Vue 3 UI 到 Shadow DOM (全局唯一一次挂载，生命周期常驻后台)
 * 即使重塑关闭也需挂载，以便监听 storage 变化后触发页面重载
 */
const initVueApp = () => {
  if (document.getElementById('custom-zhihu-app')) return

  if (!document.body) {
    // 若 body 节点暂不存在，则等待 DOMContentLoaded 后挂载
    document.addEventListener('DOMContentLoaded', () => initVueApp(), {
      once: true,
    })
    return
  }

  // 创建宿主容器 (初始 display 设为 none，后续由 App.vue 路由匹配状态进行显示/隐藏控制)
  appContainer = document.createElement('div')
  appContainer.id = 'custom-zhihu-app'
  appContainer.style.display = 'none'

  // 创建 Shadow Root
  const shadowRoot = appContainer.attachShadow({ mode: 'open' })

  // 注入 Tailwind CSS 样式到 Shadow DOM
  const styleElement = document.createElement('style')
  styleElement.textContent = tailwindStyles
  shadowRoot.appendChild(styleElement)

  // 4. 创建内部 Vue 挂载容器
  const innerRoot = document.createElement('div')
  innerRoot.id = 'app-root'
  innerRoot.style.minHeight = '100vh'
  shadowRoot.appendChild(innerRoot)

  // 5. 挂载宿主容器到页面 body
  document.body.appendChild(appContainer)

  // 6. 检测本地缓存或系统暗色偏好，设置 dark 语义样式以消除挂载闪烁
  const savedDarkMode = localStorage.getItem('zhihu-reshaped-dark-mode')
  const isDark =
    savedDarkMode === 'true' ||
    (savedDarkMode === null &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark) {
    appContainer.classList.add('dark')
    document.body.classList.add('dark')
  } else {
    appContainer.classList.remove('dark')
    document.body.classList.remove('dark')
  }

  // 7. 挂载全局唯一 Vue 3 实例
  appInstance = createApp(App)
  appInstance.mount(innerRoot)

  console.log('[Content Script] Vue 3 重塑空间 App 实例已成功被全局唯一挂载！')
}

// 启动挂载流程
initVueApp()

