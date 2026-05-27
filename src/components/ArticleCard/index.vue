<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import CardHeader from '@/components/ArticleCard/components/Header.vue'
import CardTitle from '@/components/ArticleCard/components/Title.vue'
import CardContent from '@/components/ArticleCard/components/Content.vue'
import CardActions from '@/components/ArticleCard/components/Actions.vue'
import CardComments from '@/components/ArticleCard/components/Comments.vue'
import { Ban } from 'lucide-vue-next'

import type { StandardCardData } from '@/utils/mapCardData.ts'

interface Props {
  data: StandardCardData
  showTitle?: boolean
}

const { data, showTitle = true } = defineProps<Props>()

// 卡片交互状态
const isHidden = ref(false)
const isCommentsExpanded = ref(false)
const commentsContainerRef = ref<HTMLElement | null>(null)

watch(isCommentsExpanded, async (newVal) => {
  if (newVal) {
    await nextTick()
    if (commentsContainerRef.value) {
      const rect = commentsContainerRef.value.getBoundingClientRect()
      // 顶栏高度为 64px (h-16)，留出 16px 的间距
      const headerHeight = 64
      const targetY = rect.top + window.scrollY - headerHeight - 16
      
      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      })
    }
  }
})
</script>

<template>
  <!-- 当被标记为"不感兴趣"时的极简提示卡片 -->
  <article
    v-if="isHidden"
    class="rounded-2xl bg-muted/40 p-6 border border-border-subtle flex flex-col items-center justify-center space-y-3 transition-all duration-300 min-h-[120px]"
  >
    <div class="text-muted-foreground text-xs flex items-center space-x-2">
      <Ban class="h-5 w-5 text-rose-500" />
      <span class="font-medium"
        >已将该内容标记为"不感兴趣"，我们将减少此类推荐</span
      >
    </div>
  </article>

  <!-- 正常内容卡片 (文章特殊样式: 蓝色左边框) -->
  <article
    v-else
    class="group rounded-2xl bg-card p-6 shadow-xs border border-border-subtle hover:shadow-md transition-all duration-300 border-l-4 border-l-blue-500/80"
  >
    <!-- 头部：作者信息与时间 -->
    <CardHeader :author="data.author" :data="data" />

    <!-- 标题（点击跳转） -->
    <CardTitle v-if="showTitle" :data="data" />

    <!-- 内容区：摘要与富文本折叠/展开 -->
    <CardContent :data="data" />

    <!-- 底部操作栏 -->
    <CardActions
      :data="data"
      v-model:is-comments-expanded="isCommentsExpanded"
      @not-interested="isHidden = true"
    />

    <!-- 评论面板区 -->
    <div ref="commentsContainerRef">
      <CardComments v-if="isCommentsExpanded" :data="data" />
    </div>
  </article>
</template>
