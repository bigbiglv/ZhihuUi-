<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ZHIHU_WEB_URL, ZHIHU_STATIC } from '@/config/api.ts'
import { Search, Sun, Moon } from 'lucide-vue-next'

interface Props {
  isDarkMode: boolean
  activeNav: string
}

interface Emits {
  (e: 'toggle-dark-mode'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

// 当前登录用户的头像与姓名（使用知乎默认灰色头像作为保底）
const currentUserAvatar = ref<string>(ZHIHU_STATIC.defaultAvatar)
const currentUserName = ref('当前用户')
const currentUserUrlToken = ref('')

onMounted(() => {
  // 尝试从 SSR 数据 js-initialData 中提取
  try {
    const initialDataEl = document.getElementById('js-initialData')
    if (initialDataEl && initialDataEl.textContent) {
      const initialData = JSON.parse(initialDataEl.textContent)
      const state = initialData?.initialState
      if (state) {
        const currentUser = state.currentUser
        if (currentUser) {
          // 如果 currentUser 是对象结构
          if (typeof currentUser === 'object') {
            const avatar = currentUser.avatarUrl || currentUser.avatar_url
            const name = currentUser.name || currentUser.username
            const urlToken =
              currentUser.urlToken || currentUser.url_token || currentUser.id
            if (avatar) currentUserAvatar.value = avatar
            if (name) currentUserName.value = name
            if (urlToken && urlToken !== 'undefined' && urlToken !== 'null')
              currentUserUrlToken.value = String(urlToken)
          }
          // 如果 currentUser 是 Hash 字符串（知乎的标准规范化数据结构）
          else if (typeof currentUser === 'string') {
            const userObj =
              state.entities?.users?.[currentUser] ||
              state.entities?.people?.[currentUser]
            if (userObj) {
              const avatar = userObj.avatarUrl || userObj.avatar_url
              const name = userObj.name || userObj.username
              const urlToken =
                userObj.urlToken ||
                userObj.url_token ||
                userObj.id ||
                currentUser
              if (avatar) currentUserAvatar.value = avatar
              if (name) currentUserName.value = name
              if (urlToken && urlToken !== 'undefined' && urlToken !== 'null')
                currentUserUrlToken.value = String(urlToken)
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[TheHeader] 解析 js-initialData 获取用户头像失败:', err)
  }

  // 延迟 1 秒后保底从原 DOM 结构中提取
  setTimeout(() => {
    if (
      currentUserAvatar.value.includes(ZHIHU_STATIC.defaultAvatar) ||
      currentUserAvatar.value.includes('unsplash.com')
    ) {
      const nativeAvatarImg = document.querySelector(
        '.AppHeader-profileAvatar, .AppHeader-profile img, img.Avatar, a[href*="/people/"] img',
      ) as HTMLImageElement | null
      if (nativeAvatarImg && nativeAvatarImg.src) {
        currentUserAvatar.value = nativeAvatarImg.src
      }

      const nativeNameEl = document.querySelector(
        '.AppHeader-profileName, a[href*="/people/"] .name, .AppHeader-profile',
      ) as HTMLElement | null
      if (nativeNameEl && nativeNameEl.textContent) {
        const name = nativeNameEl.textContent.trim()
        if (name) currentUserName.value = name
      }
    }

    // 保底抓取 native 个人中心的链接，提取其中的 urlToken
    const profileLink = document.querySelector(
      'a[href*="/people/"]',
    ) as HTMLAnchorElement | null
    if (profileLink && profileLink.href) {
      const match = profileLink.href.match(/\/people\/([^/?#]+)/)
      if (
        match &&
        match[1] &&
        match[1] !== 'undefined' &&
        match[1] !== 'null'
      ) {
        currentUserUrlToken.value = match[1]
      }
    }
  }, 1000)
})

// 跳转到个人中心
function handleGoToProfile() {
  let token = currentUserUrlToken.value
  // 稳健校验：若 token 无效或为 "undefined"/"null" 字符串，则尝试从 DOM 实时解析保底
  if (!token || token === 'undefined' || token === 'null') {
    const profileLink = document.querySelector(
      'a[href*="/people/"]',
    ) as HTMLAnchorElement | null
    if (profileLink && profileLink.href) {
      const match = profileLink.href.match(/\/people\/([^/?#]+)/)
      if (
        match &&
        match[1] &&
        match[1] !== 'undefined' &&
        match[1] !== 'null'
      ) {
        token = match[1]
        currentUserUrlToken.value = token // 缓存有效 token
      }
    }
  }

  // 过滤掉非法的字符串值，ZHIHU_WEB_URL.profile 有降级逻辑
  const finalToken =
    token && token !== 'undefined' && token !== 'null' ? token : undefined
  window.open(ZHIHU_WEB_URL.profile(finalToken), '_blank')
}

// 搜索栏逻辑：双向绑定并支持回车与点击搜索跳转知乎
const searchQuery = ref('')
function handleSearch() {
  const query = searchQuery.value.trim()
  if (query) {
    // 若当前已经是搜索页，则直接进行 SPA 跳转
    if (window.location.pathname.startsWith('/search')) {
      window.location.href = ZHIHU_WEB_URL.search(query)
    } else {
      window.open(ZHIHU_WEB_URL.search(query), '_blank')
    }
    searchQuery.value = ''
  }
}

onMounted(() => {
  // ... 其他代码 ...
  const params = new URLSearchParams(window.location.search)
  const q = params.get('q')
  if (q) {
    searchQuery.value = q
  }
})
</script>

<template>
  <!-- 顶部极简毛玻璃 Header -->
  <header
    class="sticky top-0 z-50 w-full border-b border-border bg-card/70 backdrop-blur-md transition-all duration-300"
  >
    <div
      class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"
    >
      <!-- 左侧：品牌 Logo 与版本号 -->
      <div class="flex items-center space-x-6">
        <a
          href="/"
          class="flex items-center space-x-2 select-none hover:opacity-90 transition"
        >
          <span
            class="bg-linear-to-r from-blue-600 to-indigo-500 bg-clip-text text-xl font-bold tracking-wider text-transparent"
          >
            ZHIHU
          </span>
        </a>
      </div>

      <!-- 中间：搜索框 -->
      <div class="relative w-64 lg:w-80 hidden sm:block">
        <input
          type="text"
          v-model="searchQuery"
          @keyup.enter="handleSearch"
          placeholder="搜索你感兴趣的内容..."
          class="w-full rounded-full border border-input-border bg-input py-2 pl-4 pr-10 text-xs outline-none transition focus:border-input-focus-border focus:bg-card text-foreground placeholder-placeholder"
        />
        <span
          @click="handleSearch"
          class="absolute right-3 top-2.5 text-placeholder cursor-pointer hover:text-primary transition"
        >
          <Search class="h-4.5 w-4.5" />
        </span>
      </div>

      <!-- 右侧：控制与用户信息 -->
      <div class="flex items-center space-x-4">
        <!-- 主题切换按钮 -->
        <button
          @click="$emit('toggle-dark-mode')"
          class="rounded-full p-2 text-muted-foreground hover:bg-accent transition cursor-pointer"
          title="切换暗黑/明亮模式"
        >
          <Sun v-if="isDarkMode" class="h-5 w-5" />
          <Moon v-else class="h-5 w-5" />
        </button>

        <!-- 真实用户头像 -->
        <div
          @click="handleGoToProfile"
          :title="currentUserName"
          class="h-8 w-8 overflow-hidden rounded-full border-2 border-blue-500/30 cursor-pointer hover:scale-105 transition duration-300"
        >
          <img
            :src="currentUserAvatar"
            :alt="currentUserName"
            class="h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* 头部专有动画样式 */
</style>
