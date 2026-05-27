<script setup lang="ts">
import { ref, onMounted } from 'vue'

// ==================== 设置项状态 ====================

/** 全局 - 页面重塑开关（持久化到 chrome.storage.local，content script 实时响应） */
const reshapeEnabled = ref(true)

/** 首页 - 隐藏盐选（仅 UI，暂不对接功能） */
const hideYanxuan = ref(false)

/** 首页 - 隐藏屏蔽词内容 */
const hideBlockedWords = ref(false)

/** 初始化加载状态 */
const isLoading = ref(true)

onMounted(async () => {
  try {
    const result = await chrome.storage.local.get([
      'reshapeEnabled',
      'hideYanxuan',
      'hideBlockedWords',
    ])
    // 首次安装时默认开启重塑
    reshapeEnabled.value = result.reshapeEnabled !== false
    hideYanxuan.value = result.hideYanxuan !== false // 默认开启屏蔽盐选
    hideBlockedWords.value = result.hideBlockedWords !== false
  } catch {
    // storage 读取失败时使用默认值
  } finally {
    isLoading.value = false
  }
})

const toggleReshape = async () => {
  reshapeEnabled.value = !reshapeEnabled.value
  await chrome.storage.local.set({ reshapeEnabled: reshapeEnabled.value })
}

const toggleHideYanxuan = async () => {
  hideYanxuan.value = !hideYanxuan.value
  await chrome.storage.local.set({ hideYanxuan: hideYanxuan.value })
}

const toggleHideBlockedWords = async () => {
  hideBlockedWords.value = !hideBlockedWords.value
  await chrome.storage.local.set({ hideBlockedWords: hideBlockedWords.value })
}
</script>

<template>
  <div class="popup-container">
    <!-- 顶部标题 -->
    <header class="popup-header">
      <div class="header-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="header-text">
        <h1>知乎 · 重塑助手</h1>
        <p>快捷设置面板</p>
      </div>
    </header>

    <div v-if="isLoading" class="loading-skeleton">
      <div class="skeleton-bar" />
      <div class="skeleton-bar short" />
    </div>

    <template v-else>
      <!-- 全局设置分组 -->
      <section class="settings-group">
        <div class="group-label">
          <span class="group-dot global" />
          全局
        </div>

        <div class="setting-item" :class="{ active: reshapeEnabled }" @click="toggleReshape">
          <div class="setting-info">
            <span class="setting-icon">✦</span>
            <div>
              <div class="setting-title">页面重塑</div>
              <div class="setting-desc">启用后将接管知乎页面渲染</div>
            </div>
          </div>
          <div class="toggle-switch" :class="{ on: reshapeEnabled }">
            <div class="toggle-thumb" />
          </div>
        </div>
      </section>

      <!-- 首页设置分组 -->
      <section class="settings-group">
        <div class="group-label">
          <span class="group-dot home" />
          首页
        </div>

        <div class="setting-item" :class="{ active: hideYanxuan }" @click="toggleHideYanxuan">
          <div class="setting-info">
            <span class="setting-icon">🛍</span>
            <div>
              <div class="setting-title">隐藏盐选</div>
              <div class="setting-desc">隐藏首页知乎盐选推广内容</div>
            </div>
          </div>
          <div class="toggle-switch" :class="{ on: hideYanxuan }">
            <div class="toggle-thumb" />
          </div>
        </div>

        <div class="setting-item" :class="{ active: hideBlockedWords }" @click="toggleHideBlockedWords">
          <div class="setting-info">
            <span class="setting-icon">🚫</span>
            <div>
              <div class="setting-title">隐藏屏蔽词内容</div>
              <div class="setting-desc">过滤包含屏蔽词的推荐内容</div>
            </div>
          </div>
          <div class="toggle-switch" :class="{ on: hideBlockedWords }">
            <div class="toggle-thumb" />
          </div>
        </div>
      </section>
    </template>

  </div>
</template>

<style>
/* ==================== Popup 全局重置与变量 ==================== */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --popup-bg: #f8fafc;
  --popup-surface: #ffffff;
  --popup-surface-hover: #f1f5f9;
  --popup-surface-active: #e2e8f0;
  --popup-border: rgba(148, 163, 184, 0.2);
  --popup-text: #0f172a;
  --popup-text-secondary: #334155;
  --popup-text-dim: #64748b;
  --popup-accent: #3b82f6;
  --popup-accent-glow: rgba(59, 130, 246, 0.15);
  --popup-green: #10b981;
  --popup-green-glow: rgba(16, 185, 129, 0.15);
  --popup-amber: #f59e0b;
  --popup-radius: 12px;
  --popup-radius-sm: 8px;
}

body {
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: var(--popup-text);
  background: var(--popup-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ==================== 容器布局 ==================== */
.popup-container {
  width: 320px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ==================== 顶部标题 ==================== */
.popup-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0 8px;
}

.header-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb, #6366f1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

.header-text h1 {
  font-size: 15px;
  font-weight: 650;
  color: var(--popup-text);
  letter-spacing: 0.3px;
}

.header-text p {
  font-size: 11px;
  color: var(--popup-text-dim);
  margin-top: 1px;
}

/* ==================== 加载骨架 ==================== */
.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 0;
}

.skeleton-bar {
  height: 44px;
  border-radius: var(--popup-radius-sm);
  background: var(--popup-surface);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-bar.short {
  width: 70%;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ==================== 设置分组 ==================== */
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--popup-text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 4px 4px;
}

.group-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.group-dot.global {
  background: var(--popup-accent);
  box-shadow: 0 0 6px var(--popup-accent-glow);
}

.group-dot.home {
  background: var(--popup-green);
  box-shadow: 0 0 6px var(--popup-green-glow);
}

/* ==================== 设置项 ==================== */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--popup-radius);
  background: var(--popup-surface);
  border: 1px solid var(--popup-border);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.setting-item:hover {
  background: var(--popup-surface-hover);
  border-color: rgba(148, 163, 184, 0.15);
}

.setting-item:active {
  background: var(--popup-surface-active);
  transform: scale(0.99);
}

.setting-item.active {
  border-color: rgba(96, 165, 250, 0.2);
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.05), rgba(99, 102, 241, 0.03));
}

.setting-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.setting-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  line-height: 1;
}

.setting-title {
  font-size: 13px;
  font-weight: 550;
  color: var(--popup-text);
  white-space: nowrap;
}

.setting-desc {
  font-size: 11px;
  color: var(--popup-text-secondary);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ==================== 开关按钮 ==================== */
.toggle-switch {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--popup-surface-active);
  border: 1px solid rgba(148, 163, 184, 0.15);
  position: relative;
  flex-shrink: 0;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-switch.on {
  background: var(--popup-accent);
  border-color: var(--popup-accent);
  box-shadow: 0 0 10px var(--popup-accent-glow);
}

.toggle-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch.on .toggle-thumb {
  left: 18px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

/* ==================== 底部 ==================== */
.popup-footer {
  display: flex;
  justify-content: center;
  padding-top: 4px;
  font-size: 10px;
  color: var(--popup-text-dim);
  letter-spacing: 0.5px;
}
</style>
