<script setup lang="ts">
import { computed } from 'vue'
import { ZHIHU_STATIC, ZHIHU_WEB_URL } from '@/config/api.ts'
import { formatPublishTime } from '@/utils/timeFormat.ts'

import type { CardAuthor, StandardCardData } from '@/utils/mapCardData.ts'

interface Props {
  author: CardAuthor
  data?: StandardCardData
}

const props = defineProps<Props>()

// 辅助函数：安全地从 author 对象中解析名字
const authorName = computed(() => {
  const authorObj = props.author
  if (!authorObj) return '匿名用户'
  return authorObj.name || '匿名用户'
})

// 辅助函数：安全地从 author 对象中解析头像
const authorAvatar = computed(() => {
  const authorObj = props.author
  if (!authorObj) return ZHIHU_STATIC.defaultAvatar
  return authorObj.avatar_url || ZHIHU_STATIC.defaultAvatar
})

// 辅助函数：安全地从 author 对象中解析个性签名
const authorHeadline = computed(() => {
  const authorObj = props.author
  if (!authorObj) return ''
  return authorObj.headline || ''
})

// 提取作者 urlToken，支持不同数据结构
const authorUrlToken = computed(() => {
  const authorObj = props.author
  if (!authorObj) return ''
  return authorObj.url_token || authorObj.id || ''
})

// 判断作者是否可点击跳转（排除匿名用户，并确保有有效 token）
const isClickable = computed(() => {
  const name = authorName.value
  const authorObj = props.author
  if (!authorObj) return false

  const type = authorObj.type
  if (name === '匿名用户' || type === 'anonymous') {
    return false
  }

  const token = authorUrlToken.value
  return !!(token && token !== 'undefined' && token !== 'null' && token !== '0')
})

// 跳转到作者个人主页
function goToAuthorProfile() {
  if (!isClickable.value) return
  const token = authorUrlToken.value
  if (token) {
    window.open(ZHIHU_WEB_URL.profile(token), '_blank')
  }
}

// 时间显示逻辑
const publishTimeStr = computed(() => {
  if (!props.data?.createdTime) return ''
  return formatPublishTime(props.data.createdTime)
})

const editTimeStr = computed(() => {
  const d = props.data
  if (!d?.updatedTime || !d?.createdTime || d.updatedTime <= d.createdTime) return ''
  return formatPublishTime(d.updatedTime)
})
</script>

<template>
  <!-- 头部：作者信息区 -->
  <div class="flex items-center justify-between text-xs">
    <div class="flex items-center space-x-3">
      <img
        :src="authorAvatar"
        alt="Avatar"
        class="h-9 w-9 rounded-full border border-border object-cover transition-all duration-200"
        :class="{
          'cursor-pointer hover:opacity-85 hover:scale-102': isClickable,
        }"
        @click="goToAuthorProfile"
      />
      <div>
        <h4 class="font-bold text-foreground flex items-center space-x-1.5">
          <span
            class="transition-colors duration-200"
            :class="{ 'cursor-pointer hover:text-blue-500': isClickable }"
            @click="goToAuthorProfile"
            >{{ authorName }}</span
          >
          <span
            v-if="author.type === 'people'"
            class="rounded bg-badge px-1 py-0.5 text-[9px] text-badge-foreground font-normal"
          >
            作者
          </span>
        </h4>
        <p
          class="text-muted-foreground line-clamp-1 mt-0.5 max-w-[280px] sm:max-w-xs md:max-w-md"
        >
          {{ authorHeadline || '知乎认证创作者' }}
        </p>
      </div>
    </div>

    <!-- 右上角时间显示 -->
    <div class="text-[11px] text-muted-foreground/80 flex items-center">
      <template v-if="editTimeStr">
        <span :title="`发布于 ${publishTimeStr}`" class="cursor-help border-b border-dashed border-muted-foreground/30">{{ editTimeStr }}</span>
        <span class="ml-1.5 text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">已编辑</span>
      </template>
      <template v-else-if="publishTimeStr">
        <span>{{ publishTimeStr }}</span>
      </template>
    </div>
  </div>
</template>
