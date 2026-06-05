<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, markRaw } from 'vue'
import TheHeader from '@/components/TheHeader/index.vue'
import HomeView from '@/views/HomeView.vue'
import SearchView from '@/views/SearchView.vue'
import DetailView from '@/views/Question/DetailView.vue'
import AnswerView from '@/views/Question/AnswerView.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import ContextMenu from '@/components/ContextMenu/index.vue'
import { matchRoute, ZhihuPageType } from '@/utils/routeMatcher'

interface RouteConfig {
  key: string
  pageTypes?: ZhihuPageType[]
  component: any
  viewName?: string
}

// 声明路由映射配置表 (利用 markRaw 避免 Vue 对大型组件进行不必要的深层响应式代理)
const routes: RouteConfig[] = [
  {
    key: 'recommend',
    pageTypes: [ZhihuPageType.HOME, ZhihuPageType.SIGNIN, ZhihuPageType.SIGNUP],
    component: markRaw(HomeView),
  },
  {
    key: 'search',
    pageTypes: [ZhihuPageType.SEARCH],
    component: markRaw(SearchView),
  },
  {
    key: 'question_detail',
    pageTypes: [ZhihuPageType.QUESTION_DETAIL],
    component: markRaw(DetailView),
  },
  {
    key: 'question_answer',
    pageTypes: [ZhihuPageType.QUESTION_ANSWER],
    component: markRaw(AnswerView),
  },
]

// 兜底路由配置
const fallbackRoute = {
  key: 'other',
  component: markRaw(PlaceholderView),
  viewName: '知乎重塑空间',
}

// 全局主题状态
const isDarkMode = ref(false)

// 全局重塑开关（由 popup 通过 chrome.storage.local 控制）
const reshapeEnabled = ref(true)

// 路由与路径状态管理
const currentPath = ref(window.location.pathname)

// 动态计算当前页面路径是否需要进行 UI 重塑
const currentMatchResult = computed(() => matchRoute(currentPath.value))
const isReshapedPage = computed(() => currentMatchResult.value.reshape && reshapeEnabled.value)

/**
 * 移除 content.ts 注入的占位骨架屏（Vue 已就绪，不再需要）
 */
const removePlaceholderSkeleton = () => {
  const skeleton = document.getElementById('zhihu-reshape-skeleton')
  if (skeleton) {
    skeleton.remove()
  }
}

/**
 * 禁用 manifest.json 注入的 early-hide.css
 * 用于不需要重塑的页面，或 SPA 切换到不重塑页面时恢复原站
 */
const disableEarlyHideCSS = () => {
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

/**
 * 动态接管与切换知乎原站原生 DOM 节点与本 Vue UI 宿主容器 (声明式单一视图层管理器)
 */
const updateReshapeDOMState = () => {
  const isReshape = isReshapedPage.value
  const shadowHost = document.getElementById('custom-zhihu-app')
  let styleEl = document.getElementById('custom-hide-root-styles')

  // 无论何种状态，Vue 已就绪后都应移除占位骨架
  removePlaceholderSkeleton()

  if (isReshape) {
    // 优雅重置并隐藏知乎原站原生 #root 节点 (使用全局 `<style>` 避免与 React 渲染冲突)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'custom-hide-root-styles'
      styleEl.textContent = `
        #root {
          opacity: 0.001 !important;
          pointer-events: none !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          z-index: -9999 !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          background-color: #f6f8fa !important;
        }
        body.dark {
          background-color: #15171e !important;
        }
      `
      document.documentElement.appendChild(styleEl)
      console.log('[App] 声明式全局隐藏 #root 样式已注入，避开内联属性冲突')
    }
    // Vue 自有的 custom-hide-root-styles 已接管隐藏职责，可安全禁用 early-hide.css 避免冗余
    disableEarlyHideCSS()
    // 显示本 Vue 重塑插件宿主容器
    if (shadowHost) {
      shadowHost.style.setProperty('display', 'block', 'important')
    }
  } else {
    // 完美复原并显示知乎原站原生 #root 节点
    if (styleEl) {
      styleEl.remove()
      console.log('[App] 声明式全局隐藏 #root 样式已成功移除，完美复原原生网页')
    }
    // 同时禁用 early-hide.css，确保原站正常显示
    disableEarlyHideCSS()
    // 将本 Vue 重塑插件宿主容器隐藏，完美放行官方原生功能
    if (shadowHost) {
      shadowHost.style.setProperty('display', 'none', 'important')
    }
  }
}

/**
 * 路由解析与 DOM 状态同步更新
 */
const parseCurrentRoute = () => {
  if (currentPath.value !== window.location.pathname) {
    currentPath.value = window.location.pathname

    // 强制重置滚动条到顶部，防止浏览器缓存上次滚动位置触发首屏多次加载
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    window.scrollTo(0, 0)

    // 动态同步更新 DOM 隐藏/恢复展示状态
    updateReshapeDOMState()
  }
}

// 同步初始化路由与 DOM 节点接管状态，消除冷启动闪烁
// 注意：不要在这里同步调用 updateReshapeDOMState()，
// 因为 reshapeEnabled 的状态需要等 onMounted 中异步读取 chrome.storage。
// 如果这里同步调用，由于 reshapeEnabled 默认是 true，会错误地隐藏原网页的 #root。
// 隐藏逻辑会放到 onMounted 里面，确保根据真实配置执行。
parseCurrentRoute()

// 当前匹配到的路由配置项
const currentRouteConfig = computed(() => {
  return (
    routes.find(
      (r) =>
        r.pageTypes && r.pageTypes.includes(currentMatchResult.value.pageType),
    ) || fallbackRoute
  )
})

// 当前渲染的视图组件
const currentViewComponent = computed(() => currentRouteConfig.value.component)

// 当前路由 Key 标识 (用于 Header 的 active-nav 激活属性)
const currentRoute = computed(() => currentRouteConfig.value.key)

// 当前视图显示名
const currentViewName = computed(
  () => currentRouteConfig.value.viewName || '知乎重塑空间',
)

// 当前渲染组件需要绑定的 Props
const currentViewProps = computed(() => {
  const config = currentRouteConfig.value
  if (
    config.key === 'follow' ||
    config.key === 'hot' ||
    config.key === 'other'
  ) {
    return { viewName: currentViewName.value }
  }
  return {}
})

// 切换暗黑模式
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('zhihu-reshaped-dark-mode', String(isDarkMode.value))

  const shadowHost = document.getElementById('custom-zhihu-app')
  if (shadowHost) {
    if (isDarkMode.value) {
      shadowHost.classList.add('dark')
      document.body.classList.add('dark')
    } else {
      shadowHost.classList.remove('dark')
      document.body.classList.remove('dark')
    }
  }
}

/**
 * 劫持捕获来自主环境 (MAIN World) History API Hook 的零延迟路由通知
 */
const handleSPAChange = (event: MessageEvent) => {
  if (event.data && event.data.type === 'ZHIHU_SPA_URL_CHANGE') {
    parseCurrentRoute()
  }
}

let fallbackTimer: any = null

onMounted(async () => {
  // 初始化检查 localStorage 缓存或系统暗色偏好
  const savedDarkMode = localStorage.getItem('zhihu-reshaped-dark-mode')
  const isDark =
    savedDarkMode === 'true' ||
    (savedDarkMode === null &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  isDarkMode.value = isDark
  const shadowHost = document.getElementById('custom-zhihu-app')
  if (shadowHost) {
    if (isDark) {
      shadowHost.classList.add('dark')
      document.body.classList.add('dark')
    } else {
      shadowHost.classList.remove('dark')
      document.body.classList.remove('dark')
    }
  }

  // 注册主路由监听器 (100% 纯事件驱动，秒级零时延响应)
  window.addEventListener('popstate', parseCurrentRoute)
  window.addEventListener('message', handleSPAChange)

  // 从 chrome.storage.local 读取重塑开关初始状态
  try {
    const result = await chrome.storage.local.get('reshapeEnabled')
    // 首次安装时默认开启
    reshapeEnabled.value = result.reshapeEnabled !== false
  } catch {
    // storage 读取失败时保持默认开启
  }

  // 监听 popup 实时修改开关 → 重载页面以确保知乎 React 应用完整重新初始化
  // 知乎 React 在 #root 被缩至 10px 后会停止渲染子树，仅恢复 CSS 无法使其重新布局
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.reshapeEnabled) {
      window.location.reload()
    }
  })

  // 页面可见状态改变时立即重新解析一次，优化多 Tab 切换体验
  document.addEventListener('visibilitychange', parseCurrentRoute)

  // 初始化 DOM 宿主层隐藏/展示状态
  updateReshapeDOMState()

  // 设立 1500ms 极低频 Fallback 兜底轮询定时器
  // 仅在 visibilityState === 'visible' 时才检测，完全杜绝页面在后台时频繁唤醒 JS Event Loop，实现极致的省电与零性能开销
  fallbackTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      if (window.location.pathname !== currentPath.value) {
        parseCurrentRoute()
      }
    }
  }, 1500)
})

onUnmounted(() => {
  // 安全清理事件与定时器以防内存泄露
  window.removeEventListener('popstate', parseCurrentRoute)
  window.removeEventListener('message', handleSPAChange)
  document.removeEventListener('visibilitychange', parseCurrentRoute)

  if (fallbackTimer) {
    clearInterval(fallbackTimer)
  }
})
</script>

<template>
  <div
    :class="{ dark: isDarkMode }"
    class="min-h-screen bg-background text-foreground transition-colors duration-300"
  >
    <!-- 全局复用的顶栏 Header -->
    <TheHeader
      :is-dark-mode="isDarkMode"
      :active-nav="currentRoute"
      @toggle-dark-mode="toggleDarkMode"
    />

    <!-- 根据路由渲染对应的视图 -->
    <transition name="fade" mode="out-in">
      <component :is="currentViewComponent" v-bind="currentViewProps" />
    </transition>

    <!-- 全局自定义右键菜单 -->
    <ContextMenu v-if="isReshapedPage" />
  </div>
</template>

<style>
/* 全局页面过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
