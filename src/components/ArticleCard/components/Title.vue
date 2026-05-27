<script setup lang="ts">
import { computed } from 'vue'
import { ZHIHU_WEB_URL } from '@/config/api.ts'

import type { StandardCardData } from '@/utils/mapCardData.ts'

interface Props {
  data: StandardCardData
}

const props = defineProps<Props>()

// 提取标题
const titleText = computed(() => {
  const d = props.data
  if (d.question?.title) {
    return d.question.title
  }
  return d.title || '无标题内容'
})

// 跳转到问题/文章详情页
function goToDetail() {
  const d = props.data

  if (d.question?.id && d.type === 'answer') {
    window.open(ZHIHU_WEB_URL.question(d.question.id), '_blank')
    return
  }

  if (d.type === 'article') {
    window.open(ZHIHU_WEB_URL.article(d.id), '_blank')
    return
  }

  window.open(ZHIHU_WEB_URL.fallback(d.type, d.id), '_blank')
}
</script>

<template>
  <h3
    @click="goToDetail"
    class="zhihu-feed-card-title mt-4 text-lg font-extrabold leading-snug text-foreground hover:text-primary transition cursor-pointer"
    v-html="titleText"
  ></h3>
</template>

<style>
/* 针对知乎高亮搜索词 <em> 标签进行美化，使其显示为非倾斜的知乎红色高亮 */
.zhihu-feed-card-title em {
  font-style: normal;
  color: #ec5b56; /* 知乎高亮红 */
  font-weight: bold;
}
</style>
