<script setup lang="ts">
import { Beaker, ArrowRight } from 'lucide-vue-next'

interface Props {
  viewName: string
}

defineProps<Props>()
</script>

<template>
  <main
    class="mx-auto max-w-4xl px-4 py-16 sm:px-6 flex flex-col items-center justify-center min-h-[70vh]"
  >
    <div
      class="relative w-full max-w-md rounded-3xl bg-card p-8 md:p-10 shadow-xl border border-border-subtle text-center overflow-hidden transition-all duration-300"
    >
      <!-- 精美的背景渐变微粒 -->
      <div
        class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"
      ></div>

      <!-- CSS/SVG 组成的高级极客科技风徽标 -->
      <div
        class="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-tr from-blue-500 to-indigo-600 shadow-lg text-white mb-6"
      >
        <Beaker class="h-10 w-10 animate-pulse" />
      </div>

      <!-- 文字介绍 -->
      <h2 class="text-xl font-extrabold text-foreground tracking-wide">
        「{{ viewName }}」重塑中
      </h2>
      <p
        class="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto"
      >
        知乎 UI 重塑工程正在全速前进！
        本页面的数据劫持及视觉渲染模块正在紧锣密鼓地开发中，敬请期待下一版本的震撼发布。
      </p>

      <!-- 快捷卡片展示进度 -->
      <div
        class="mt-6 rounded-2xl bg-muted/40 p-4 border border-border text-left"
      >
        <div
          class="flex items-center justify-between text-xs font-bold text-secondary-foreground"
        >
          <span>模块重构进度</span>
          <span class="text-primary">65%</span>
        </div>
        <!-- 进度条 -->
        <div class="mt-2 h-2 w-full rounded-full bg-skeleton overflow-hidden">
          <div
            class="h-full w-[65%] rounded-full bg-linear-to-r from-blue-500 to-indigo-500 animate-pulse"
          ></div>
        </div>
        <ul class="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
          <li class="flex items-center space-x-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
            <span>页面底层 XHR/Fetch 拦截通道已打通</span>
          </li>
          <li class="flex items-center space-x-1.5">
            <span
              class="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"
            ></span>
            <span>Vue 3 数据层结构设计与状态绑定中</span>
          </li>
        </ul>
      </div>

      <!-- 返回首页按钮 -->
      <div class="mt-8">
        <a
          href="/"
          class="inline-flex items-center space-x-2 rounded-full bg-linear-to-r from-blue-600 to-indigo-500 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:scale-[1.02] transition duration-300 select-none cursor-pointer"
        >
          <span>回到推荐首页</span>
          <ArrowRight class="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* 占位页面专有样式 */
</style>
