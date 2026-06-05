<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { proxyFetch } from '@/utils/proxyFetch.ts'
import { ZHIHU_API } from '@/config/api.ts'
import {
  MessageSquare,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  Star,
  Ban,
  Heart,
  Eye,
  UserX,
} from 'lucide-vue-next'

import type { StandardCardData } from '@/utils/mapCardData.ts'
import { addSeenId } from '@/utils/seenTracker.ts'

interface Props {
  data: StandardCardData
  isCommentsExpanded: boolean
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:isCommentsExpanded', value: boolean): void
  (e: 'not-interested'): void
}
const emit = defineEmits<Emits>()

// 内部操作状态
const isMenuOpen = ref(false)
const menuContainer = ref<HTMLElement | null>(null)
const favlistId = ref<number | null>(null)

// 从目标数据读取初始交互状态
const targetInfo = props.data
const isUpvoted = ref(targetInfo.isUpvoted)
const isDownvoted = ref(targetInfo.isDownvoted)
const isFavorited = ref(targetInfo.isFavorited)
const isLiked = ref(targetInfo.isLiked)

const upvoteCount = ref(targetInfo.voteupCount)
const thanksCount = ref(targetInfo.thanksCount)

// 切换评论面板展开/收起
function handleToggleComments() {
  const newStatus = !props.isCommentsExpanded
  emit('update:isCommentsExpanded', newStatus)

  // 如果是展开评论操作，表明产生阅读兴趣，异步上报已读历史
  if (newStatus && props.data && props.data.id) {
    addSeenId(`${props.data.type || 'answer'}-${props.data.id}`)
    console.log('[Read History] 展开评论，正在上报已读历史:', props.data.id)
    proxyFetch(ZHIHU_API.action.readHistory, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        content_token: String(props.data.id),
        content_type: props.data.type || 'answer',
      },
    }).then(() => {
      console.log('[Read History] 展开评论成功上报已读历史:', props.data.id)
    }).catch((err) => {
      console.error('[Read History] 展开评论上报已读历史失败:', err)
    })
  }
}

// 赞同/取消赞同
async function handleUpvote() {
  const target = props.data
  const newStatus = !isUpvoted.value

  // 乐观更新 UI
  isUpvoted.value = newStatus
  if (newStatus) {
    if (upvoteCount.value !== undefined) upvoteCount.value++
    if (isDownvoted.value) isDownvoted.value = false
  } else {
    if (upvoteCount.value !== undefined) upvoteCount.value--
  }

  try {
    if (target.type === 'answer') {
      const type = newStatus ? 'up' : 'neutral'
      await proxyFetch(ZHIHU_API.action.voteAnswer(target.id), {
        method: 'POST',
        body: { type },
      })
    } else if (target.type === 'article') {
      if (newStatus) {
        await proxyFetch(ZHIHU_API.action.likeArticle(target.id), {
          method: 'POST',
        })
      } else {
        await proxyFetch(ZHIHU_API.action.likeArticle(target.id), {
          method: 'DELETE',
        })
      }
    }
  } catch (err) {
    console.error('[FeedActions] 赞同操作失败:', err)
    // 失败时回退
    isUpvoted.value = !newStatus
    if (newStatus) {
      if (upvoteCount.value !== undefined) upvoteCount.value--
    } else {
      if (upvoteCount.value !== undefined) upvoteCount.value++
    }
  }
}

// 反对（踩）/取消反对
async function handleDownvote() {
  const target = props.data
  const newStatus = !isDownvoted.value

  // 乐观更新 UI
  isDownvoted.value = newStatus
  if (newStatus && isUpvoted.value) {
    isUpvoted.value = false
    if (upvoteCount.value !== undefined) upvoteCount.value--
  }

  try {
    if (target.type === 'answer') {
      const type = newStatus ? 'down' : 'neutral'
      await proxyFetch(ZHIHU_API.action.voteAnswer(target.id), {
        method: 'POST',
        body: { type },
      })
    } else if (target.type === 'article') {
      // 文章暂不支持反对接口，直接通过反馈进行本地模拟
      if (newStatus) {
        await proxyFetch(ZHIHU_API.action.feedAction, {
          method: 'POST',
          body: {
            action_filter: 'not_interested',
            item_id: target.feedId || target.id,
            item_type: target.feedType || target.type,
          },
        })
      }
    }
  } catch (err) {
    console.error('[FeedActions] 反对操作失败:', err)
    isDownvoted.value = !newStatus
  }
}

// 获取收藏夹列表并缓存第一个 ID
async function getFavlistId() {
  if (favlistId.value) return favlistId.value
  try {
    const res = await proxyFetch(ZHIHU_API.favorite.list(5))
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      favlistId.value = res.data[0].id
      return favlistId.value
    }
  } catch (err) {
    console.error('[FeedActions] 获取收藏夹列表失败:', err)
  }
  return null
}

// 收藏/取消收藏
async function handleFavorite() {
  const target = props.data
  const newStatus = !isFavorited.value

  isFavorited.value = newStatus

  try {
    const fid = await getFavlistId()
    if (fid) {
      if (newStatus) {
        await proxyFetch(ZHIHU_API.favorite.addItem(fid), {
          method: 'POST',
          body: {
            content_id: target.id,
            content_type: target.type,
          },
        })
      } else {
        await proxyFetch(ZHIHU_API.favorite.removeItem(fid, target.id), {
          method: 'DELETE',
        })
      }
    }
  } catch (err) {
    console.error('[FeedActions] 收藏操作失败:', err)
  }
}

// 不感兴趣
async function handleNotInterested() {
  const target = props.data
  emit('not-interested')
  closeMenu()

  try {
    const reqBody = new URLSearchParams()
    reqBody.append('scene_code', 'RECOMMEND')
    reqBody.append('content_type', '1')
    reqBody.append('content_token', String(target.id))
    reqBody.append('uninterested_type', 'less_similar')
    reqBody.append('desktop', 'true')

    await proxyFetch(ZHIHU_API.action.feedAction, {
      method: 'POST',
      body: reqBody.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    })
  } catch (err) {
    console.error('[FeedActions] 发送不感兴趣请求失败:', err)
  }
}

// 不再推荐该作者
async function handleNotInterestedAuthor() {
  const target = props.data
  emit('not-interested')
  closeMenu()

  try {
    const reqBody = new URLSearchParams()
    reqBody.append('scene_code', 'RECOMMEND')
    reqBody.append('content_type', '1')
    reqBody.append('content_token', String(target.id))
    reqBody.append('uninterested_type', 'author')
    reqBody.append('desktop', 'true')

    await proxyFetch(ZHIHU_API.action.feedAction, {
      method: 'POST',
      body: reqBody.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    })
  } catch (err) {
    console.error('[FeedActions] 发送不再推荐该作者请求失败:', err)
  }
}

// 更多菜单交互
function handleToggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function closeMenu(event?: Event) {
  if (event && menuContainer.value) {
    const path = event.composedPath()
    if (path.includes(menuContainer.value)) {
      return
    }
  }
  isMenuOpen.value = false
}

// 监听全局点击以关闭菜单
if (typeof window !== 'undefined') {
  window.addEventListener('click', closeMenu)
}
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', closeMenu)
  }
})
</script>

<template>
  <div
    class="flex items-center justify-between text-xs pt-4 border-t border-border"
  >
    <!-- 左侧平铺操作按钮 -->
    <div class="flex items-center gap-4 text-muted-foreground">
      <!-- 顶 -->
      <button
        @click="handleUpvote"
        :class="isUpvoted ? 'text-upvoted' : 'hover:text-foreground'"
        class="flex items-center space-x-1.5 py-1.5 transition cursor-pointer"
      >
        <ThumbsUp class="h-4.5 w-4.5" :fill="isUpvoted ? 'currentColor' : 'none'" />
        <span class="font-medium">{{ upvoteCount }}</span>
      </button>

      <!-- 踩 -->
      <button
        @click="handleDownvote"
        :class="isDownvoted ? 'text-downvoted' : 'hover:text-foreground'"
        class="flex items-center space-x-1.5 py-1.5 transition cursor-pointer"
        title="踩"
      >
        <ThumbsDown class="h-4.5 w-4.5" :fill="isDownvoted ? 'currentColor' : 'none'" />
      </button>

      <!-- 收藏 -->
      <button
        v-if="data.favoriteCount !== undefined"
        @click="handleFavorite"
        :class="isFavorited ? 'text-favorited' : 'hover:text-foreground'"
        class="flex items-center space-x-1.5 py-1.5 transition cursor-pointer"
      >
        <Star class="h-4.5 w-4.5" :fill="isFavorited ? 'currentColor' : 'none'" />
        <span class="font-medium">{{ data.favoriteCount }}</span>
      </button>

      <!-- 喜欢 -->
      <button
        v-if="data.thanksCount !== undefined"
        :class="isLiked ? 'text-rose-500' : 'hover:text-foreground'"
        class="flex items-center space-x-1.5 py-1.5 transition cursor-pointer"
      >
        <Heart class="h-4.5 w-4.5" :fill="isLiked ? 'currentColor' : 'none'" />
        <span class="font-medium">{{ thanksCount }}</span>
      </button>

      <!-- 访问量 (不可点击) -->
      <div v-if="data.visitCount !== undefined" class="flex items-center space-x-1.5 py-1.5 select-none opacity-80">
        <Eye class="h-4.5 w-4.5" />
        <span class="font-medium">{{ data.visitCount }}</span>
      </div>
    </div>

    <!-- 右侧: 评论和更多菜单 -->
    <div class="flex items-center gap-4">
      <!-- 评论按钮 -->
      <button
        @click="handleToggleComments"
        :class="
          isCommentsExpanded
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        "
        class="flex items-center space-x-1.5 py-1.5 transition cursor-pointer"
      >
        <MessageSquare class="h-4.5 w-4.5" />
        <span class="font-medium">{{ data.commentCount || '添加评论' }}</span>
      </button>

      <!-- 更多操作按钮 -->
      <div class="relative" ref="menuContainer">
        <button
          @click="handleToggleMenu"
          class="flex items-center justify-center p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition cursor-pointer"
          title="更多操作"
        >
          <MoreHorizontal class="h-4.5 w-4.5" />
        </button>

        <!-- 更多操作下拉浮层 -->
        <transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
        <!-- 弹出菜单 -->
        <div
          v-if="isMenuOpen"
          class="absolute bottom-full right-0 mb-2 w-max min-w-[130px] rounded-lg bg-popover py-1.5 shadow-lg border border-border-subtle z-50 animate-in fade-in zoom-in-95 duration-200"
        >
          <button
            @click="handleNotInterested"
            class="w-full flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
          >
            <Ban class="h-4 w-4 shrink-0" />
            <span class="whitespace-nowrap">不感兴趣</span>
          </button>
          <button
            @click="handleNotInterestedAuthor"
            class="w-full flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
          >
            <UserX class="h-4 w-4 shrink-0" />
            <span class="whitespace-nowrap">不再推荐该作者</span>
          </button>
        </div>
        </transition>
      </div>
    </div>
  </div>
</template>
