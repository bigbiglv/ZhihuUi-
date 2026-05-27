<script setup lang="ts">
import { onMounted, onUnmounted, watch, nextTick } from 'vue'
import ArticleCard from '@/components/ArticleCard/index.vue'
import AnswerCard from '@/components/AnswerCard/index.vue'
import { useFeed } from '@/composables/useFeed'
import { Loader2 } from 'lucide-vue-next'
import { mapToStandardCardData } from '@/utils/mapCardData'

// 引入高度内聚的 Feed 业务模型
const { recommendList, isLoading, loadMore } = useFeed()

// 监听滚动事件实现 Vue UI 的无限滚动
const handleWindowScroll = () => {
  const scrollHeight = document.documentElement.scrollHeight
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const clientHeight = window.innerHeight

  // 距离底部小于 150px 时触发触底加载
  if (scrollHeight - scrollTop - clientHeight < 150) {
    loadMore()
  }
}

// 自动检测并加载更多：防止屏蔽过多数据导致没有滚动条，从而永远无法触发加载
const checkAndLoadMore = async () => {
  await nextTick()
  if (isLoading.value) return

  const scrollHeight = document.documentElement.scrollHeight
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const clientHeight = window.innerHeight

  if (scrollHeight - scrollTop - clientHeight < 150) {
    loadMore()
  }
}

// 当 isLoading 从 true 变 false（加载完成），或者列表数量因屏蔽突然减少时，自动检测
watch(isLoading, (newVal) => {
  if (!newVal) checkAndLoadMore()
})

watch(recommendList, () => {
  checkAndLoadMore()
})

onMounted(() => {
  // 绑定滚动事件
  window.addEventListener('scroll', handleWindowScroll)

  // 终极 SSR 数据嗅探（作为首屏冷启动刷新时的最后保底）
  setTimeout(() => {
    if (recommendList.value.length === 0) {
      console.log('[HomeView] SSR 嗅探启动...')
      try {
        const initialDataEl = document.getElementById('js-initialData')
        if (initialDataEl && initialDataEl.textContent) {
          const initialData = JSON.parse(initialDataEl.textContent)
          const topstoryData =
            initialData?.initialState?.topstory?.recommend?.data
          if (Array.isArray(topstoryData) && topstoryData.length > 0) {
            console.log(
              `[HomeView] 从 SSR 提取到 ${topstoryData.length} 条首屏数据`,
            )
            // 使用与 inject.ts 相同的 postMessage 通道投递给 useFeed
            window.postMessage(
              {
                type: 'ZHIHU_FEED_INTERCEPTED',
                data: { data: topstoryData },
              },
              '*',
            )
          } else {
            console.log('[HomeView] SSR 中未找到推荐数据')
          }
        } else {
          console.log('[HomeView] 未找到 #js-initialData 节点')
        }
      } catch (err) {
        console.error('[HomeView] SSR 提取失败:', err)
      }
    }
  }, 400)
})

onUnmounted(() => {
  // 移除滚动事件
  window.removeEventListener('scroll', handleWindowScroll)
})
</script>

<template>
  <!-- 中间：单栏布局主界面 -->
  <main class="flex justify-center items-center w-full">
    <!-- 主体：推荐列表 -->
    <section class="w-188 mr-75 pt-4">
        <!-- 无数据时的骨架加载屏 -->
        <div v-if="recommendList.length === 0" class="space-y-6">
          <div
            v-for="i in 3"
            :key="i"
            class="animate-pulse rounded-2xl bg-card p-6 shadow-sm border border-border-subtle"
          >
            <div class="flex items-center space-x-3">
              <div class="h-9 w-9 rounded-full bg-skeleton"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-24 rounded bg-skeleton"></div>
                <div class="h-3 w-40 rounded bg-skeleton"></div>
              </div>
            </div>
            <div class="mt-4 space-y-2.5">
              <div class="h-5 w-3/4 rounded bg-skeleton"></div>
              <div class="h-3.5 w-full rounded bg-skeleton"></div>
              <div class="h-3.5 w-5/6 rounded bg-skeleton"></div>
            </div>
          </div>
          <div class="py-12 text-center text-xs text-muted-foreground">
            正在劫持底层推荐接口数据，请稍候...
            (若长时间未响应，可滚动页面以触发加载)
          </div>
        </div>

        <!-- 推荐文章/回答卡片容器 (已拆分为 ArticleCard 和 AnswerCard 组件) -->
        <div v-else class="space-y-6">
          <template v-for="item in recommendList" :key="item.id">
            <AnswerCard v-if="item.target.type === 'answer'" :data="mapToStandardCardData(item)" />
            <ArticleCard v-else-if="item.target.type === 'article'" :data="mapToStandardCardData(item)" />
          </template>

          <!-- 加载状态指示器 -->
          <div v-if="isLoading" class="flex justify-center py-6">
            <Loader2 class="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
    </section>
  </main>
</template>

<style scoped>
/* 组件样式已全部迁移并合并至 src/style.css 入口中，以确保能够被正常打包并注入至 Shadow DOM 内部生效。 */
</style>
