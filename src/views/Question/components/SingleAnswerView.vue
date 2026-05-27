<script setup lang="ts">
import { computed } from 'vue'
import AnswerCard from '@/components/AnswerCard/index.vue'
import { mapToStandardCardData } from '@/utils/mapCardData.ts'
import { Sparkles, ArrowRight } from 'lucide-vue-next'

interface Props {
  singleAnswer: any
  isSingleAnswerLoading: boolean
  questionInfo: any
}

interface Emits {
  (e: 'view-all'): void
}

const { singleAnswer, isSingleAnswerLoading, questionInfo } = defineProps<Props>()
const emit = defineEmits<Emits>()

// 将单回答数据包装为 AnswerCard 能渲染的标准化 FeedItem 格式
const singleAnswerItem = computed(() => {
  if (!singleAnswer) return null
  return {
    id: String(singleAnswer.id),
    type: 'answer_result',
    target: singleAnswer,
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- 精致的置顶头部条 -->
    <div
      class="flex items-center justify-between pb-3 border-b border-border select-none"
    >
      <div class="flex items-center space-x-2">
        <Sparkles class="h-5 w-5 text-amber-500 animate-pulse" />
        <span class="text-sm font-black tracking-wide text-foreground"
          >置顶回答</span
        >
      </div>

      <!-- 精致的“查看全部回答”按钮 -->
      <button
        v-if="!isSingleAnswerLoading && questionInfo"
        @click="emit('view-all')"
        class="group inline-flex items-center space-x-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary px-4 py-1.5 text-xs font-bold transition cursor-pointer select-none active:scale-95 border border-transparent hover:border-primary/20"
      >
        <span>查看全部回答</span>
        <ArrowRight
          class="h-3.5 w-3.5 group-hover:translate-x-0.5 transition duration-300"
        />
      </button>
    </div>

    <!-- 骨架屏 -->
    <div
      v-if="isSingleAnswerLoading"
      class="animate-pulse bg-card rounded-2xl border border-border-subtle p-6 space-y-4"
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

    <!-- 单回答 AnswerCard 卡片 -->
    <AnswerCard
      v-else-if="singleAnswer"
      :data="mapToStandardCardData(singleAnswerItem)"
      :show-title="false"
    />
  </div>
</template>
