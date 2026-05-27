<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AnswerCard from '@/components/AnswerCard/index.vue'
import { mapToStandardCardData } from '@/utils/mapCardData.ts'
import { MessageSquare, Loader2 } from 'lucide-vue-next'

interface Props {
  answersList: any[]
  isAnswersLoading: boolean
  questionInfo: any
  sortBy?: 'default' | 'updated'
}
defineProps<Props>()

interface Emits {
  (e: 'load-more'): void
  (e: 'sort-change', type: 'default' | 'updated'): void
}
const emit = defineEmits<Emits>()

// 监听滚动以进行无限滚动翻页
function handleWindowScroll() {
  const scrollHeight = document.documentElement.scrollHeight
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const clientHeight = window.innerHeight

  // 距离底部小于 150 像素时，触发加载更多
  if (scrollHeight - scrollTop - clientHeight < 150) {
    emit('load-more')
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleWindowScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll)
})
</script>

<template>
  <div class="space-y-6">
    <!-- 回答列表排序顶栏 -->
    <div
      class="flex items-center justify-between pb-3 border-b border-border select-none"
    >
      <h2
        class="text-md font-extrabold text-foreground flex items-center space-x-2"
      >
        <span>全部回答</span>
        <span
          class="rounded bg-accent px-2 py-0.5 text-xs text-muted-foreground font-mono"
          v-if="questionInfo"
        >
          {{ questionInfo.answer_count }}
        </span>
      </h2>
      <div class="flex items-center space-x-4 text-xs">
        <span 
          class="cursor-pointer transition"
          :class="sortBy === 'default' ? 'text-primary font-extrabold' : 'text-muted-foreground hover:text-foreground'"
          @click="emit('sort-change', 'default')"
        >
          按默认排序
        </span>
        <span
          class="cursor-pointer transition"
          :class="sortBy === 'updated' ? 'text-primary font-extrabold' : 'text-muted-foreground hover:text-foreground'"
          @click="emit('sort-change', 'updated')"
        >
          按时间排序
        </span>
      </div>
    </div>

    <!-- 首屏空回答骨架屏 -->
    <div v-if="answersList.length === 0 && isAnswersLoading" class="space-y-6">
      <div
        v-for="i in 3"
        :key="i"
        class="animate-pulse rounded-2xl bg-card p-6 shadow-xs border border-border-subtle space-y-4"
      >
        <div class="flex items-center space-x-3">
          <div class="h-9 w-9 rounded-full bg-skeleton"></div>
          <div class="space-y-2 flex-1">
            <div class="h-4 w-24 rounded bg-skeleton"></div>
            <div class="h-3 w-40 rounded bg-skeleton"></div>
          </div>
        </div>
        <div class="space-y-2">
          <div class="h-4 w-full rounded bg-skeleton"></div>
          <div class="h-4 w-5/6 rounded bg-skeleton"></div>
        </div>
      </div>
    </div>

    <!-- 暂无任何回答的空状态占位图 -->
    <div
      v-else-if="answersList.length === 0 && !isAnswersLoading"
      class="py-20 text-center flex flex-col items-center justify-center space-y-3 select-none"
    >
      <div class="p-4 rounded-full bg-accent text-muted-foreground">
        <MessageSquare class="h-8 w-8" />
      </div>
      <div class="text-sm text-muted-foreground">
        该问题目前暂无任何回答，快去写一个吧！
      </div>
    </div>

    <!-- 回答列表渲染流 -->
    <div v-else class="space-y-6">
      <AnswerCard
        v-for="item in answersList"
        :key="item.id"
        :data="mapToStandardCardData(item)"
        :show-title="false"
      />

      <!-- 下拉无限加载中骨架 -->
      <div v-if="isAnswersLoading" class="flex justify-center py-6">
        <Loader2 class="h-6 w-6 animate-spin text-primary" />
      </div>
    </div>
  </div>
</template>
