<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import ArticleCard from '@/components/ArticleCard/index.vue'
import AnswerCard from '@/components/AnswerCard/index.vue'
import { useSearch } from '@/composables/useSearch'
import { mapToStandardCardData } from '@/utils/mapCardData'
import { Loader2, SearchX } from 'lucide-vue-next'

const { searchList, isLoading, currentQuery, doSearch, loadMore } = useSearch()
const isFirstLoad = ref(true)

// 监听滚动事件实现无限滚动
const handleWindowScroll = () => {
  const scrollHeight = document.documentElement.scrollHeight
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const clientHeight = window.innerHeight

  if (scrollHeight - scrollTop - clientHeight < 150) {
    loadMore()
  }
}

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

watch(isLoading, (newVal) => {
  if (!newVal) checkAndLoadMore()
})

watch(searchList, () => {
  checkAndLoadMore()
})

onMounted(() => {
  window.addEventListener('scroll', handleWindowScroll)

  // 解析 URL 参数
  const params = new URLSearchParams(window.location.search)
  const q = params.get('q')
  if (q) {
    doSearch(q)
  }

  setTimeout(() => {
    isFirstLoad.value = false
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll)
})
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <div class="space-y-6">
      <!-- 搜索结果标题 -->
      <div v-if="currentQuery" class="pb-4 border-b border-border">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          <span class="text-muted-foreground font-normal text-lg mr-2"
            >关于</span
          >
          "{{ currentQuery }}"
          <span class="text-muted-foreground font-normal text-lg ml-2"
            >的搜索结果</span
          >
        </h1>
      </div>

      <!-- 加载中：骨架屏 -->
      <div
        v-if="searchList.length === 0 && (isLoading || isFirstLoad)"
        class="space-y-6"
      >
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
      </div>

      <!-- 无结果提示 -->
      <div
        v-else-if="searchList.length === 0 && !isLoading && !isFirstLoad"
        class="py-20 text-center flex flex-col items-center space-y-4"
      >
        <div class="p-4 rounded-full bg-muted/50 text-muted-foreground">
          <SearchX class="h-10 w-10" />
        </div>
        <div class="text-muted-foreground text-sm">
          未能找到关于“{{ currentQuery }}”的相关内容
        </div>
      </div>

      <!-- 搜索结果列表 -->
      <div v-else class="space-y-6">
        <template v-for="item in searchList" :key="item.id">
          <template v-if="item.type === 'search_result'">
            <AnswerCard v-if="item.target.type === 'answer'" :data="mapToStandardCardData(item)" />
            <ArticleCard v-else :data="mapToStandardCardData(item)" />
          </template>
        </template>

        <!-- 底部加载指示器 -->
        <div v-if="isLoading" class="flex justify-center py-6">
          <Loader2 class="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    </div>
  </main>
</template>
