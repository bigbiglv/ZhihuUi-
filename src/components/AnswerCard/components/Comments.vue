<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { proxyFetch } from '@/utils/proxyFetch.ts'
import { replaceZhihuEmojis } from '@/utils/emoji.ts'
import { ZHIHU_API, ZHIHU_STATIC, ZHIHU_WEB_URL } from '@/config/api.ts'
import ImagePreview from '@/components/ImagePreview/index.vue'
import { Heart, ThumbsUp, ThumbsDown, ChevronDown, Loader2, Pin, Flame } from 'lucide-vue-next'

// 大图预览控制状态
const isPreviewVisible = ref(false)
const previewImageSrc = ref('')

// 转换并重构评论的富文本 HTML，实现小图预览和 @提及新标签页跳转
function formatCommentHtml(content: string) {
  if (!content) return ''
  content = replaceZhihuEmojis(content)
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')

    // 查找并替换图片超链接为缩略图预览
    const links = doc.querySelectorAll('a')
    links.forEach((link) => {
      const isCommentImg =
        link.classList.contains('comment_img') ||
        link.hasAttribute('data-comment-image') ||
        (link.getAttribute('href')?.includes('zhimg.com') &&
          (link.textContent?.includes('[图片]') ||
            link.textContent?.includes('图片')))

      if (isCommentImg) {
        const imgUrl =
          link.getAttribute('data-original') || link.getAttribute('href')
        if (imgUrl) {
          // 创建一个小图预览包裹容器
          const container = doc.createElement('div')
          container.className = 'comment-image-container my-2 inline-block'

          const img = doc.createElement('img')
          img.src = imgUrl
          img.alt = '评论图片'
          img.className =
            'comment-preview-thumb rounded-lg cursor-zoom-in border border-border transition hover:opacity-90'
          img.setAttribute('data-original', imgUrl)

          container.appendChild(img)
          link.parentNode?.replaceChild(container, link)
        }
      }
    })

    // 遍历评论中所有的 img 标签（包含普通插图和表情包图片）
    const imgs = doc.querySelectorAll('img')
    imgs.forEach((img) => {
      // 1. 如果已经被处理过（带有大图预览类名），则跳过
      if (img.classList.contains('comment-preview-thumb') && !img.src.startsWith('data:image')) return
      
      // 2. 如果当前图片是表情包（由 emoji.ts 映射生成或带有原生标志），则跳过，不追加边框和大图预览样式
      if (img.classList.contains('emotion') || img.getAttribute('height') === '1.4rem') return

      const realSrc = img.getAttribute('data-actualsrc') || img.getAttribute('data-original') || img.getAttribute('src')

      if (realSrc) {
        // 如果 src 是 base64 占位图或者根本没有 src，我们将其替换为真实的图片 src
        if (!img.getAttribute('src') || img.getAttribute('src')?.startsWith('data:image')) {
          img.setAttribute('src', realSrc)
        }

        // 增加类名以支持预览和样式
        img.classList.add('comment-preview-thumb', 'cursor-zoom-in', 'rounded-lg', 'border', 'border-border', 'transition', 'hover:opacity-90')
        if (!img.getAttribute('data-original')) {
          img.setAttribute('data-original', realSrc)
        }
      }
    })

    // 优化 @提及 链接与其他外部超链接，防止本页刷新
    const allLinks = doc.querySelectorAll('a')
    allLinks.forEach((link) => {
      if (link.closest('.comment-image-container')) return

      // 强制在新标签页中打开
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')

      // 判定是否是 @ 提及链接
      if (
        link.classList.contains('member_link') ||
        link.textContent?.trim().startsWith('@')
      ) {
        link.classList.add('comment-mention-link')
      }
    })

    return doc.body.innerHTML
  } catch (err) {
    console.error('[formatCommentHtml] 解析富文本失败:', err)
    return content
  }
}

// 劫持富文本内部的点击事件，实现小图点击预览大图
function handleCommentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (
    target &&
    target.tagName === 'IMG' &&
    target.classList.contains('comment-preview-thumb')
  ) {
    e.preventDefault()
    e.stopPropagation()

    const originalUrl =
      target.getAttribute('data-original') || target.getAttribute('src')
    if (originalUrl) {
      previewImageSrc.value = originalUrl
      isPreviewVisible.value = true
    }
  }
}

import type { RootComment } from '@/components/AnswerCard/types'
import type { StandardCardData } from '@/utils/mapCardData.ts'

interface Props {
  data: StandardCardData
}

const props = defineProps<Props>()

// 评论列表与加载状态
const commentsList = ref<RootComment[]>([])
const isCommentsLoading = ref(false)

// 一级评论分页状态
const commentsNextUrl = ref<string | null>(null)
const isCommentsEnd = ref(false)
const isLoadingMoreComments = ref(false)

// 用于存储所有的评论 DOM 引用，以便精确滚动 (Vue 推荐的 template ref 方案)
const commentDOMRefs = ref<Record<string, HTMLElement>>({})

const setCommentRef = (el: any, id: string | number) => {
  if (el) {
    commentDOMRefs.value[String(id)] = el as HTMLElement
  }
}

// 排序状态
const sortType = ref<'score' | 'ts'>('score')

// 评论区筛选提示
const filterNotice = ref<string | null>(null)

function setSortType(type: 'score' | 'ts') {
  if (sortType.value === type) return
  sortType.value = type
  loadInitialComments()
}

// 辅助函数：安全地从 author 对象中解析名字
function getAuthorName(authorObj: any) {
  if (!authorObj) return '匿名用户'
  return authorObj.member?.name || authorObj.name || '匿名用户'
}

// 辅助函数：安全地从 author 对象中解析头像
function getAuthorAvatar(authorObj: any) {
  if (!authorObj) return ZHIHU_STATIC.defaultAvatar
  return (
    authorObj.member?.avatar_url ||
    authorObj.avatar_url ||
    ZHIHU_STATIC.defaultAvatar
  )
}

// 提取作者的 urlToken，支持多级兼容解析
function getAuthorUrlToken(authorObj: any) {
  if (!authorObj) return ''
  return (
    authorObj.member?.url_token ||
    authorObj.member?.urlToken ||
    authorObj.url_token ||
    authorObj.urlToken ||
    authorObj.id ||
    ''
  )
}

// 判断评论作者/回复对象是否可以点击跳转主页（排除匿名用户且需要有有效 token）
function isAuthorClickable(authorObj: any) {
  if (!authorObj) return false
  const name = getAuthorName(authorObj)
  const type = authorObj.member?.type || authorObj.type
  if (name === '匿名用户' || type === 'anonymous') {
    return false
  }
  const token = getAuthorUrlToken(authorObj)
  return !!(token && token !== 'undefined' && token !== 'null' && token !== '0')
}

// 跳转至对应的主页
function goToAuthorProfile(authorObj: any) {
  if (!isAuthorClickable(authorObj)) return
  const token = getAuthorUrlToken(authorObj)
  if (token) {
    window.open(ZHIHU_WEB_URL.profile(token), '_blank')
  }
}

// 格式化评论发布时间
function formatCommentTime(timestamp: number) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const isCurrentYear = date.getFullYear() === now.getFullYear()

  const YYYY = date.getFullYear()
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const DD = String(date.getDate()).padStart(2, '0')
  const HH = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')

  if (isCurrentYear) {
    return `${MM}-${DD} ${HH}:${mm}:${ss}`
  }
  return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`
}

// 格式化评论对象状态映射
function mapCommentState(c: any) {
  const isLiked = c.liked ?? c.voting ?? c.is_liked ?? c.is_voted ?? (c.reaction_type === 1)
  const isDownvoted = c.isDownvoted ?? c.disliked ?? c.is_disliked ?? (c.reaction_type === 2)
  return {
    ...c,
    voting: isLiked,
    isDownvoted,
  }
}

// 首次拉取一级评论列表
async function loadInitialComments() {
  isCommentsLoading.value = true
  commentsList.value = []

  const targetId = props.data.id
  const targetType = props.data.type

  // 自动判定接口资源类型
  let commentType = 'answers'
  if (targetType === 'article') {
    commentType = 'articles'
  } else if (targetType === 'pin') {
    commentType = 'pins'
  }

  try {
    const res = await proxyFetch(
      ZHIHU_API.comment.rootComments(
        commentType as 'answers' | 'articles' | 'pins',
        targetId,
        20,
        sortType.value
      ),
    )
    if (res && Array.isArray(res.data)) {
      if (res.review_info && typeof res.review_info === 'object' && res.review_info.review_text) {
        filterNotice.value = res.review_info.review_text
      } else if (res.review_info && typeof res.review_info === 'string') {
        filterNotice.value = res.review_info
      } else if (res.filtered || res.reviewing) {
        filterNotice.value = '评论已被作者筛选'
      } else {
        filterNotice.value = null
      }

      commentsList.value = res.data.map((c: any) => ({
        ...mapCommentState(c),
        childComments: [],
        isChildLoading: false,
        isChildExpanded: false,
        childCommentsNextUrl: null,
        isChildLoadingMore: false,
        isChildEnd: false,
      }))
      commentsNextUrl.value = res.paging?.next || null
      isCommentsEnd.value = res.paging?.is_end ?? true
    }
  } catch (err) {
    console.error('[FeedComments] 获取评论列表失败:', err)
  } finally {
    isCommentsLoading.value = false
  }
}

// 分页加载更多一级评论
async function loadMoreComments() {
  if (
    isLoadingMoreComments.value ||
    !commentsNextUrl.value ||
    isCommentsEnd.value
  )
    return
  isLoadingMoreComments.value = true
  try {
    const res = await proxyFetch(commentsNextUrl.value)
    if (res && Array.isArray(res.data)) {
      const newComments = res.data.map((c: any) => ({
        ...mapCommentState(c),
        childComments: [],
        isChildLoading: false,
        isChildExpanded: false,
        childCommentsNextUrl: null,
        isChildLoadingMore: false,
        isChildEnd: false,
      }))
      commentsList.value.push(...newComments)
      commentsNextUrl.value = res.paging?.next || null
      isCommentsEnd.value = res.paging?.is_end ?? true
    }
  } catch (err) {
    console.error('[FeedComments] 加载更多一级评论失败:', err)
  } finally {
    isLoadingMoreComments.value = false
  }
}

// 展开/折叠二级评论列表（子回复）
async function toggleChildComments(comment: RootComment) {
  // 如果当前是展开状态，则直接收起折叠
  if (comment.isChildExpanded) {
    comment.isChildExpanded = false
    return
  }

  // 如果已经加载过子评论数据，直接展开
  if (comment.childComments && comment.childComments.length > 0) {
    comment.isChildExpanded = true
    return
  }

  // 发起代理请求加载二级评论
  comment.isChildLoading = true

  try {
    const res = await proxyFetch(ZHIHU_API.comment.childComments(comment.id))
    if (res && Array.isArray(res.data)) {
      comment.childComments = res.data.map(mapCommentState)
      comment.childCommentsNextUrl = res.paging?.next || null
      comment.isChildEnd = res.paging?.is_end ?? true
      comment.isChildExpanded = true
    }
  } catch (err) {
    console.error(`[FeedComments] 加载二级评论失败 (id: ${comment.id}):`, err)
  } finally {
    comment.isChildLoading = false
  }
}

// 分页加载更多二级回复
async function loadMoreChildComments(comment: RootComment) {
  if (
    comment.isChildLoadingMore ||
    !comment.childCommentsNextUrl ||
    comment.isChildEnd
  )
    return
  comment.isChildLoadingMore = true
  try {
    const res = await proxyFetch(comment.childCommentsNextUrl)
    if (res && Array.isArray(res.data)) {
      if (!comment.childComments) comment.childComments = []
      comment.childComments.push(...res.data.map(mapCommentState))
      comment.childCommentsNextUrl = res.paging?.next || null
      comment.isChildEnd = res.paging?.is_end ?? true
    }
  } catch (err) {
    console.error(
      `[FeedComments] 加载更多二级评论失败 (id: ${comment.id}):`,
      err,
    )
  } finally {
    comment.isChildLoadingMore = false
  }
}

// 切换评论点赞状态
async function handleToggleVote(comment: any) {
  const newStatus = !comment.voting
  comment.voting = newStatus
  if (newStatus) {
    comment.vote_count = (comment.vote_count ?? comment.like_count ?? 0) + 1
    if (comment.isDownvoted) comment.isDownvoted = false
  } else {
    comment.vote_count = Math.max(0, (comment.vote_count ?? comment.like_count ?? 1) - 1)
  }

  try {
    await proxyFetch(ZHIHU_API.comment.like(comment.id), {
      method: newStatus ? 'POST' : 'DELETE'
    })
  } catch (err) {
    console.error('点赞失败:', err)
    comment.voting = !newStatus
    if (newStatus) {
      comment.vote_count = Math.max(0, (comment.vote_count ?? comment.like_count ?? 1) - 1)
    } else {
      comment.vote_count = (comment.vote_count ?? comment.like_count ?? 0) + 1
    }
  }
}

// 切换评论踩状态
async function handleToggleDownvote(comment: any) {
  const newStatus = !comment.isDownvoted
  comment.isDownvoted = newStatus

  if (newStatus && comment.voting) {
    comment.voting = false
    comment.vote_count = Math.max(0, (comment.vote_count ?? comment.like_count ?? 1) - 1)
  }

  try {
    await proxyFetch(ZHIHU_API.comment.downvote(comment.id), {
      method: newStatus ? 'PUT' : 'DELETE'
    })
  } catch (err) {
    console.error('踩失败:', err)
    comment.isDownvoted = !newStatus
  }
}

// 点击回复@时，尝试滚动到目标评论
function handleReplyToClick(e: MouseEvent, child: any, rootComment: any) {
  let targetId = child.reply_comment_id || child.reply_to_comment_id || child.reply_to_id || child.reply_to_comment?.id

  if (!targetId && child.reply_to_author && rootComment && rootComment.childComments) {
    const replyToId = child.reply_to_author.id || child.reply_to_author.url_token || child.reply_to_author.member?.id || child.reply_to_author.member?.url_token;
    if (replyToId) {
      const candidateComments = rootComment.childComments.filter(
        (c: any) => {
          const cAuthorId = c.author?.id || c.author?.url_token || c.author?.member?.id || c.author?.member?.url_token;
          const isMatchAuthor = cAuthorId === replyToId;
          const isTimeBefore = c.created_time <= child.created_time;
          const isNotSelf = c.id !== child.id;
          return isMatchAuthor && isTimeBefore && isNotSelf;
        }
      );
      if (candidateComments.length > 0) {
        candidateComments.sort((a: any, b: any) => b.created_time - a.created_time);
        targetId = candidateComments[0].id;
      }
    }
  }

  if (targetId) {
    // 优先使用 Vue 的 template ref 引用查找 DOM
    let targetElement = commentDOMRefs.value[String(targetId)]

    // 如果 ref 中没找到，再降级去全量 DOM 树里捞一下（防止遗漏）
    if (!targetElement) {
      targetElement = document.getElementById(`comment-${targetId}`) as HTMLElement
      if (!targetElement) {
        targetElement = document.querySelector(`[data-comment-id="${targetId}"]`) as HTMLElement
      }
    }

    if (targetElement) {
      e.preventDefault()
      e.stopPropagation()

      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })

      targetElement.classList.add('bg-primary/10', 'ring-2', 'ring-primary/20')
      setTimeout(() => {
        targetElement.classList.remove('bg-primary/10', 'ring-2', 'ring-primary/20')
      }, 2000)
      return
    }
  }

  e.preventDefault()
  e.stopPropagation()
  alert('该评论可能已被删除或尚未加载')
}

// 组件加载时自动拉取首屏评论
onMounted(() => {
  loadInitialComments()
})
</script>

<template>
  <div
    class="mt-4 rounded-xl bg-comment-bg py-4 border border-border transition duration-300"
  >
    <div class="flex items-center justify-between border-b border-border pb-2 px-4">
      <div class="flex items-center space-x-2">
        <h4 class="text-sm font-bold text-secondary-foreground">
          全部评论 ({{ data.commentCount || 0 }})
        </h4>
        <span v-if="filterNotice" class="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md flex-shrink-0">
          {{ filterNotice }}
        </span>
      </div>
      <div class="flex items-center bg-secondary/50 rounded-full p-0.5 text-xs select-none">
        <button
          @click="setSortType('score')"
          class="px-3 py-1 rounded-full transition-all duration-200 cursor-pointer"
          :class="sortType === 'score' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'"
        >
          综合
        </button>
        <button
          @click="setSortType('ts')"
          class="px-3 py-1 rounded-full transition-all duration-200 cursor-pointer"
          :class="sortType === 'ts' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'"
        >
          最新
        </button>
      </div>
    </div>

    <!-- 评论加载中骨架屏 -->
    <div v-if="isCommentsLoading" class="space-y-4 animate-pulse py-2">
      <div v-for="c in 3" :key="c" class="flex space-x-3">
        <div class="h-8 w-8 rounded-full bg-skeleton"></div>
        <div class="flex-1 space-y-2">
          <div class="h-3 w-16 bg-skeleton rounded"></div>
          <div class="h-3.5 w-5/6 bg-skeleton rounded"></div>
        </div>
      </div>
    </div>

    <!-- 评论列表显示 -->
    <div v-else class="space-y-5 overflow-y-auto p-4" style="max-height: calc(100vh - 180px)">
      <div
        v-for="comment in commentsList"
        :key="comment.id"
        :ref="(el) => setCommentRef(el, comment.id)"
        :id="`comment-${comment.id}`"
        :data-comment-id="comment.id"
        class="flex flex-col text-sm border-b border-border-subtle pb-4 last:border-0 last:pb-0 transition-colors duration-500 rounded-md"
      >
        <!-- 一级评论主体 -->
        <div class="flex items-start space-x-3">
          <img
            :src="getAuthorAvatar(comment.author)"
            alt="Avatar"
            class="h-9 w-9 rounded-full object-cover border border-border flex-shrink-0 transition-opacity duration-200"
            :class="{
              'cursor-pointer hover:opacity-85': isAuthorClickable(
                comment.author,
              ),
            }"
            @click="goToAuthorProfile(comment.author)"
          />
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-center">
              <div class="flex items-center space-x-2 min-w-0">
                <span
                  class="font-bold text-foreground truncate text-sm transition-colors duration-200"
                  :class="{
                    'cursor-pointer hover:text-blue-500': isAuthorClickable(
                      comment.author,
                    ),
                  }"
                  @click="goToAuthorProfile(comment.author)"
                  >{{ getAuthorName(comment.author) }}</span
                >

                <!-- 标签 (置顶/热评/等) -->
                <template v-if="Array.isArray(comment.comment_tag) && comment.comment_tag.length">
                  <div v-for="tag in comment.comment_tag.filter((t: any) => t.type !== 'ip_info' && !t.text.includes('IP'))" :key="tag.type || tag.text" class="flex items-center text-[10px] px-1.5 py-0.5 rounded"
                       :class="{
                         'text-primary bg-primary/10': tag.type === 'featured' || tag.type === 'author_top' || tag.text.includes('置顶'),
                         'text-red-500 bg-red-50': tag.type === 'hot' || tag.text.includes('热评') || tag.text.includes('赞过'),
                         'text-blue-500 bg-blue-50': tag.type !== 'featured' && tag.type !== 'author_top' && tag.type !== 'hot' && !tag.text.includes('置顶') && !tag.text.includes('热评') && !tag.text.includes('赞过')
                       }">
                    <Pin v-if="tag.type === 'featured' || tag.type === 'author_top' || tag.text.includes('置顶')" class="w-3 h-3 mr-0.5" />
                    <Flame v-else-if="tag.type === 'hot' || tag.text.includes('热评')" class="w-3 h-3 mr-0.5" />
                    <Heart v-else-if="tag.text.includes('赞过')" class="w-3 h-3 mr-0.5" />
                    <span>{{ tag.text }}</span>
                  </div>
                </template>
                <template v-else>
                  <div v-if="comment.featured || comment.is_featured" class="flex items-center text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    <Pin class="w-3 h-3 mr-0.5" />
                    <span>置顶</span>
                  </div>
                  <div v-if="comment.hot || comment.is_hot" class="flex items-center text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                    <Flame class="w-3 h-3 mr-0.5" />
                    <span>热评</span>
                  </div>
                </template>
              </div>
              <span class="text-xs text-placeholder flex-shrink-0 ml-2">
                {{ formatCommentTime(comment.created_time) }}
                <template v-if="comment.address_text || (Array.isArray(comment.comment_tag) && comment.comment_tag.find((t: any) => t.type === 'ip_info'))">
                  · {{ comment.address_text || (comment.comment_tag?.find((t: any) => t.type === 'ip_info')?.text?.includes('IP') ? comment.comment_tag.find((t: any) => t.type === 'ip_info')?.text : comment.comment_tag?.find((t: any) => t.type === 'ip_info')?.text) }}
                </template>
              </span>
            </div>

            <!-- 评论 HTML 富文本渲染 -->
            <div
              v-html="formatCommentHtml(comment.content)"
              class="zhihu-comment-content text-rich-text mt-1.5 leading-relaxed font-normal"
              @click="handleCommentClick"
            ></div>

            <div
              class="mt-2.5 flex items-center justify-between select-none text-placeholder text-xs"
            >
              <div class="flex items-center space-x-4 text-muted-foreground">
                <!-- 点赞/踩 按钮组 -->
                <div class="flex items-center space-x-3">
                  <!-- 赞 -->
                  <button
                    class="flex items-center space-x-1 hover:text-red-500 transition cursor-pointer"
                    :class="{ 'text-red-500': comment.voting }"
                    @click="handleToggleVote(comment)"
                  >
                    <ThumbsUp class="h-4 w-4" :class="{ 'fill-current': comment.voting }" />
                    <span class="font-medium">{{ comment.vote_count ?? comment.like_count ?? 0 }}</span>
                  </button>

                  <!-- 踩 -->
                  <button
                    class="flex items-center space-x-1 hover:text-primary transition cursor-pointer"
                    :class="{ 'text-primary': comment.isDownvoted }"
                    @click="handleToggleDownvote(comment)"
                  >
                    <ThumbsDown class="h-4 w-4" :class="{ 'fill-current': comment.isDownvoted }" />
                  </button>
                </div>

                <!-- 展开子回复按钮 (二级评论) -->
                <button
                  v-if="comment.child_comment_count > 0"
                  @click="toggleChildComments(comment)"
                  class="flex items-center space-x-1 text-primary hover:text-primary-hover font-semibold cursor-pointer select-none transition text-xs"
                >
                  <ChevronDown
                    :class="{ 'rotate-180': comment.isChildExpanded }"
                    class="h-3.5 w-3.5 transform transition-transform duration-300"
                  />
                  <span>
                    {{
                      comment.isChildExpanded
                        ? '收起回复'
                        : `展开 ${comment.child_comment_count} 条回复`
                    }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 二级子评论容器 -->
        <div
          v-if="
            comment.isChildLoading ||
            (comment.isChildExpanded && comment.childComments?.length)
          "
          class="ml-12 mt-3 p-3.5 rounded-lg bg-comment-child-bg border border-border-subtle overflow-hidden"
        >
          <!-- 子评论加载状态 -->
          <div
            v-if="comment.isChildLoading"
            class="space-y-3 animate-pulse py-1"
          >
            <div v-for="i in 2" :key="i" class="flex space-x-2.5">
              <div class="h-7 w-7 rounded-full bg-skeleton"></div>
              <div class="flex-1 space-y-1.5">
                <div class="h-2.5 w-12 bg-skeleton rounded"></div>
                <div class="h-3.5 w-5/6 bg-skeleton rounded"></div>
              </div>
            </div>
          </div>

          <!-- 子评论列表 -->
          <div v-else class="space-y-3.5">
            <div
              v-for="child in comment.childComments"
              :key="child.id"
              :ref="(el) => setCommentRef(el, child.id)"
              :id="`comment-${child.id}`"
              :data-comment-id="child.id"
              class="flex items-start space-x-2.5 pb-3 border-b border-border-subtle last:border-0 last:pb-0 transition-colors duration-500 rounded-md"
            >
              <img
                :src="getAuthorAvatar(child.author)"
                alt="Avatar"
                class="h-7.5 w-7.5 rounded-full object-cover border border-border flex-shrink-0 transition-opacity duration-200"
                :class="{
                  'cursor-pointer hover:opacity-85': isAuthorClickable(
                    child.author,
                  ),
                }"
                @click="goToAuthorProfile(child.author)"
              />
              <div class="flex-1 min-w-0 text-xs">
                <div class="flex justify-between items-start">
                  <div class="min-w-0 flex-1 flex items-center flex-wrap gap-y-1">
                    <!-- 回复谁的优雅判定 -->
                    <div
                      v-if="
                        child.reply_to_author &&
                        getAuthorName(child.reply_to_author) !==
                          getAuthorName(comment.author)
                      "
                      class="flex items-center space-x-1 flex-wrap min-w-0"
                    >
                      <span
                        class="font-bold text-foreground truncate max-w-[100px] transition-colors duration-200"
                        :class="{
                          'cursor-pointer hover:text-blue-500':
                            isAuthorClickable(child.author),
                        }"
                        @click="goToAuthorProfile(child.author)"
                        >{{ getAuthorName(child.author) }}</span
                      >
                      <span class="text-placeholder font-normal">回复</span>
                      <span
                        class="font-bold text-secondary-foreground truncate max-w-[100px] transition-colors duration-200 cursor-pointer hover:text-blue-500"
                        @click="handleReplyToClick($event, child, comment)"
                        >@{{ getAuthorName(child.reply_to_author) }}</span
                      >
                    </div>
                    <span
                      class="else-part font-bold text-foreground truncate block transition-colors duration-200"
                      :class="{
                        'cursor-pointer hover:text-blue-500': isAuthorClickable(
                          child.author,
                        ),
                      }"
                      @click="goToAuthorProfile(child.author)"
                      v-else
                      >{{ getAuthorName(child.author) }}</span
                    >

                    <!-- 标签 (置顶/热评) -->
                    <template v-if="Array.isArray(child.comment_tag) && child.comment_tag.length">
                      <div v-for="tag in child.comment_tag.filter((t: any) => t.type !== 'ip_info' && !t.text.includes('IP'))" :key="tag.type || tag.text" class="flex items-center text-[10px] px-1 py-0.5 rounded ml-1.5"
                           :class="{
                             'text-primary bg-primary/10': tag.type === 'featured' || tag.type === 'author_top' || tag.text.includes('置顶'),
                             'text-red-500 bg-red-50': tag.type === 'hot' || tag.text.includes('热评') || tag.text.includes('赞过'),
                             'text-blue-500 bg-blue-50': tag.type !== 'featured' && tag.type !== 'author_top' && tag.type !== 'hot' && !tag.text.includes('置顶') && !tag.text.includes('热评') && !tag.text.includes('赞过')
                           }">
                        <Pin v-if="tag.type === 'featured' || tag.type === 'author_top' || tag.text.includes('置顶')" class="w-2.5 h-2.5 mr-0.5" />
                        <Flame v-else-if="tag.type === 'hot' || tag.text.includes('热评')" class="w-2.5 h-2.5 mr-0.5" />
                        <Heart v-else-if="tag.text.includes('赞过')" class="w-2.5 h-2.5 mr-0.5" />
                        <span>{{ tag.text }}</span>
                      </div>
                    </template>
                    <template v-else>
                      <div v-if="child.featured || child.is_featured" class="flex items-center text-[10px] text-primary bg-primary/10 px-1 py-0.5 rounded ml-1.5">
                        <Pin class="w-2.5 h-2.5 mr-0.5" />
                        <span>置顶</span>
                      </div>
                      <div v-if="child.hot || child.is_hot" class="flex items-center text-[10px] text-red-500 bg-red-50 px-1 py-0.5 rounded ml-1.5">
                        <Flame class="w-2.5 h-2.5 mr-0.5" />
                        <span>热评</span>
                      </div>
                    </template>
                  </div>
                  <span
                    class="text-[11px] text-placeholder flex-shrink-0 ml-2 mt-0.5"
                  >
                    {{ formatCommentTime(child.created_time) }}
                    <template v-if="child.address_text || (Array.isArray(child.comment_tag) && child.comment_tag.find((t: any) => t.type === 'ip_info'))">
                      · {{ child.address_text || (child.comment_tag?.find((t: any) => t.type === 'ip_info')?.text?.includes('IP') ? child.comment_tag.find((t: any) => t.type === 'ip_info')?.text : child.comment_tag?.find((t: any) => t.type === 'ip_info')?.text) }}
                    </template>
                  </span>
                </div>

                <!-- 二级评论富文本 -->
                <div
                  v-html="formatCommentHtml(child.content)"
                  class="zhihu-comment-content text-rich-text mt-1 leading-relaxed"
                  @click="handleCommentClick"
                ></div>

                <!-- 二级评论底部点赞 -->
                <div
                  class="mt-1.5 flex items-center justify-between select-none text-placeholder text-[10px]"
                >
                  <div class="flex items-center space-x-3 text-muted-foreground">
                    <!-- 赞 -->
                    <button
                      class="flex items-center space-x-1 hover:text-red-500 transition cursor-pointer"
                      :class="{ 'text-red-500': child.voting }"
                      @click="handleToggleVote(child)"
                    >
                      <ThumbsUp
                        class="h-3.5 w-3.5"
                        :class="{ 'fill-current': child.voting }"
                      />
                      <span class="font-medium">{{ child.vote_count ?? child.like_count ?? 0 }}</span>
                    </button>

                    <!-- 踩 -->
                    <button
                      class="flex items-center space-x-1 hover:text-primary transition cursor-pointer"
                      :class="{ 'text-primary': child.isDownvoted }"
                      @click="handleToggleDownvote(child)"
                    >
                      <ThumbsDown
                        class="h-3.5 w-3.5"
                        :class="{ 'fill-current': child.isDownvoted }"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 加载更多二级回复 -->
            <div
              v-if="comment.childCommentsNextUrl && !comment.isChildEnd"
              class="pt-2 pb-0.5 text-left"
            >
              <button
                @click="loadMoreChildComments(comment)"
                :disabled="comment.isChildLoadingMore"
                class="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg hover:bg-accent text-xs font-bold text-primary hover:text-primary-hover transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <Loader2
                  v-if="comment.isChildLoadingMore"
                  class="animate-spin h-3.5 w-3.5 text-primary"
                />
                <span>{{
                  comment.isChildLoadingMore
                    ? '正在加载回复...'
                    : '查看更多回复'
                }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多一级根评论 -->
      <div
        v-if="commentsNextUrl && !isCommentsEnd"
        class="pt-4 pb-2 text-center border-t border-border-subtle"
      >
        <button
          @click="loadMoreComments"
          :disabled="isLoadingMoreComments"
          class="inline-flex items-center justify-center space-x-2 px-6 py-2 rounded-full border border-border hover:border-primary bg-card text-sm font-semibold text-secondary-foreground hover:text-primary hover:shadow-xs active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loader2
            v-if="isLoadingMoreComments"
            class="animate-spin h-4 w-4 text-primary"
          />
          <span>{{
            isLoadingMoreComments ? '正在加载评论...' : '加载更多评论'
          }}</span>
        </button>
      </div>

      <div
        v-if="commentsList.length === 0"
        class="text-center py-8 text-sm text-muted-foreground"
      >
        该内容暂无评论或评论区已关闭
      </div>
    </div>

    <!-- 大图无缝预览遮罩层 -->
    <ImagePreview v-model:visible="isPreviewVisible" :src="previewImageSrc" />
  </div>
</template>

<style>
/* 评论内置富文本样式精调（深度穿透） */
.zhihu-comment-content {
  word-break: break-all;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.zhihu-comment-content a {
  color: var(--rich-text-link);
  text-decoration: none;
  font-weight: 500;
  word-break: break-all;
}

.zhihu-comment-content a:hover {
  text-decoration: underline;
}

/* 限制表情包或行内图片的超限展示，排除缩略大图 */
.zhihu-comment-content img:not(.comment-preview-thumb) {
  display: inline-block;
  vertical-align: text-bottom;
  height: 1.4rem;
  width: auto;
  margin: 0 0.125rem;
  border-radius: 0;
  box-shadow: none;
  max-width: 100%;
}

/* 评论区图片缩略小图排版与样式 */
.zhihu-comment-content .comment-image-container {
  display: block;
  width: fit-content;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.zhihu-comment-content img.comment-preview-thumb {
  display: block;
  max-width: 150px !important;
  max-height: 150px !important;
  width: auto !important;
  height: auto !important;
  object-fit: cover;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: zoom-in;
  transition: all 0.2s ease;
}

.zhihu-comment-content img.comment-preview-thumb:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

/* @ 提及链接的专属高亮与加粗样式 */
.zhihu-comment-content a.comment-mention-link {
  color: var(--primary) !important;
  font-weight: 600 !important;
  transition: all 0.2s ease;
}

.zhihu-comment-content a.comment-mention-link:hover {
  color: var(--primary-hover) !important;
  text-decoration: underline !important;
  opacity: 0.95;
}
</style>
