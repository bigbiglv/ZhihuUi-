<script setup lang="ts">
import { ref } from 'vue'
import {
  Users,
  Eye,
  MessageSquare,
  Plus,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-vue-next'
import {
  siGithub,
  siBilibili,
  siYoutube,
  siSinaweibo,
  siZhihu,
  siTaobao,
  siJuejin,
  siCsdn,
  siXiaohongshu,
} from 'simple-icons'

interface Props {
  questionInfo: any
  isQuestionLoading: boolean
}
defineProps<Props>()

interface Emits {
  (e: 'preview-image', url: string): void
}
const emit = defineEmits<Emits>()

const isDetailExpanded = ref(false)

// 建立域名到站点信息与图标的映射
const SITE_ICONS: Record<string, { name: string; path: string }> = {
  'github.com': { name: 'GitHub', path: siGithub.path },
  'bilibili.com': { name: '哔哩哔哩', path: siBilibili.path },
  'youtube.com': { name: 'YouTube', path: siYoutube.path },
  'youtu.be': { name: 'YouTube', path: siYoutube.path },
  'weibo.com': { name: '微博', path: siSinaweibo.path },
  'zhihu.com': { name: '知乎', path: siZhihu.path },
  'taobao.com': { name: '淘宝', path: siTaobao.path },
  'tmall.com': { name: '天猫', path: siTaobao.path },
  'jd.com': { name: '京东', path: siTaobao.path },
  'juejin.cn': { name: '掘金', path: siJuejin.path },
  'csdn.net': { name: 'CSDN', path: siCsdn.path },
  'xiaohongshu.com': { name: '小红书', path: siXiaohongshu.path },
}

const getBadgeContent = (domain: string) => {
  const matchedKey = Object.keys(SITE_ICONS).find((key) => domain.includes(key))
  if (matchedKey) {
    const site = SITE_ICONS[matchedKey]
    const svgIcon = `<svg class="h-3.5 w-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle; width: 14px; height: 14px;"><path d="${site.path}"/></svg>`
    return { name: site.name, svg: svgIcon }
  }
  const defaultSvg = `<svg class="h-3.5 w-3.5 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="display:inline-block; vertical-align:middle; width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>`
  return { name: domain || '网页链接', svg: defaultSvg }
}

// 格式化富文本详情
const formatRichContentHtml = (content: string) => {
  if (!content) return ''
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')

    // 优化图片预览
    const images = doc.querySelectorAll('img')
    images.forEach((img) => {
      const isEmotion =
        img.classList.contains('emotion') ||
        img.getAttribute('height') === '1.4rem'
      if (!isEmotion) {
        img.classList.add('comment-preview-thumb', 'cursor-zoom-in')
        if (!img.hasAttribute('data-original')) {
          const original =
            img.getAttribute('data-actualsrc') || img.getAttribute('src') || ''
          img.setAttribute('data-original', original)
        }
      }
    })

    // 优化超链接和视频
    const links = doc.querySelectorAll('a')
    links.forEach((link) => {
      const href = link.getAttribute('href') || ''
      const videoMatch = href.match(/\/video\/(\d+)/)
      const videoId = videoMatch ? videoMatch[1] : null
      const isVideoLink = link.classList.contains('video-box') || !!videoId

      if (isVideoLink && videoId) {
        const wrapper = doc.createElement('div')
        wrapper.className =
          'custom-video-wrapper my-4 overflow-hidden rounded-xl border border-border shadow-md bg-black w-full max-w-[640px] mx-auto aspect-video'

        const iframe = doc.createElement('iframe')
        iframe.src = `https://www.zhihu.com/video/${videoId}?autoplay=false`
        iframe.className = 'w-full h-full block'
        iframe.setAttribute('frameborder', '0')
        iframe.setAttribute('allowfullscreen', 'true')

        wrapper.appendChild(iframe)
        link.parentNode?.replaceChild(wrapper, link)
        return
      }

      const isMention =
        link.classList.contains('member_link') ||
        link.textContent?.trim().startsWith('@')
      if (!isMention) {
        let targetUrl = href
        try {
          const urlObj = new URL(href)
          if (urlObj.hostname === 'link.zhihu.com') {
            const actualTarget = urlObj.searchParams.get('target')
            if (actualTarget) targetUrl = decodeURIComponent(actualTarget)
          }
        } catch (e) {}

        link.setAttribute('href', targetUrl)
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')

        const textContent = link.textContent?.trim() || ''
        const isLongUrlText =
          /^(https?:\/\/|www\.)\S+$/.test(textContent) ||
          textContent.length > 15

        if (isLongUrlText) {
          let domain = ''
          try {
            domain = new URL(targetUrl).hostname.replace(/^www\./, '')
          } catch (e) {}

          const { name: siteName, svg: svgIcon } = getBadgeContent(domain)

          const badge = doc.createElement('a')
          badge.href = targetUrl
          badge.target = '_blank'
          badge.rel = 'noopener noreferrer'
          badge.className =
            'inline-link-badge inline-flex items-center px-2 py-0.5 rounded-[4px] bg-primary/10 hover:bg-primary/20 text-primary font-medium text-[13px] select-none transition decoration-none mx-1 align-middle max-w-[200px] border border-transparent hover:border-primary/20'

          badge.innerHTML = `
            ${svgIcon}
            <span class="truncate" style="vertical-align:middle;">${siteName}</span>
          `

          link.parentNode?.replaceChild(badge, link)
        }
      }
    })

    return doc.body.innerHTML
  } catch (err) {
    console.error('[formatRichContentHtml] 解析富文本失败:', err)
    return content
  }
}

// 劫持图片点击预览大图
const handleContentClick = (e: MouseEvent) => {
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
      emit('preview-image', originalUrl)
    }
  }
}

const formatNumber = (num: number) => {
  if (!num) return '0'
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}
</script>

<template>
  <div>
    <!-- 问题头部骨架屏加载 -->
    <section
      v-if="isQuestionLoading && !questionInfo"
      class="animate-pulse bg-card rounded-2xl p-6 border border-border-subtle shadow-xs space-y-4"
    >
      <div class="h-8 w-3/4 rounded bg-skeleton"></div>
      <div class="space-y-2">
        <div class="h-4 w-full rounded bg-skeleton"></div>
        <div class="h-4 w-5/6 rounded bg-skeleton"></div>
      </div>
      <div class="flex space-x-4 pt-2">
        <div class="h-9 w-24 rounded-full bg-skeleton"></div>
      </div>
    </section>

    <!-- 问题主体展示 -->
    <section
      v-else-if="questionInfo"
      class="bg-card rounded-2xl border border-border-subtle p-6 md:p-8 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden"
    >
      <!-- 磨砂渐变背景装饰 -->
      <div
        class="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none select-none"
      ></div>

      <!-- 标题 -->
      <h1
        class="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-snug"
      >
        {{ questionInfo.title }}
      </h1>

      <!-- 折叠/展开的问题富文本描述 -->
      <div
        v-if="questionInfo.detail && questionInfo.detail !== '<p></p>'"
        class="mt-4 border-t border-border-subtle pt-4"
      >
        <!-- 截断展示 -->
        <div v-if="!isDetailExpanded" class="relative">
          <div
            v-html="
              formatRichContentHtml(questionInfo.excerpt || questionInfo.detail)
            "
            class="text-sm text-rich-text leading-relaxed line-clamp-2 select-none"
          ></div>
          <div
            @click="isDetailExpanded = true"
            class="text-primary hover:text-primary-hover text-xs font-bold mt-2 cursor-pointer flex items-center justify-end space-x-0.5 w-fit ml-auto transition"
          >
            <span>展开问题描述</span>
            <ChevronDown class="h-3.5 w-3.5" />
          </div>
        </div>

        <!-- 全文展示 -->
        <div v-else class="space-y-3">
          <div
            v-html="formatRichContentHtml(questionInfo.detail)"
            class="zhihu-rich-content text-sm text-rich-text leading-relaxed font-normal"
            @click="handleContentClick"
          ></div>
          <div
            @click="isDetailExpanded = false"
            class="text-primary hover:text-primary-hover text-xs font-bold mt-2 cursor-pointer flex items-center justify-end space-x-0.5 w-fit ml-auto transition"
          >
            <span>收起描述</span>
            <ChevronUp class="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      <!-- 数据与极简操作栏 -->
      <div
        class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-6"
      >
        <!-- 统计面板 -->
        <div
          class="flex items-center space-x-6 text-xs text-muted-foreground select-none"
        >
          <div class="flex items-center space-x-1.5" title="关注者数量">
            <Users class="h-4 w-4 text-primary/70" />
            <span class="font-bold font-mono text-foreground">{{
              formatNumber(questionInfo.follower_count)
            }}</span>
            <span>关注</span>
          </div>
          <div class="flex items-center space-x-1.5" title="问题浏览量">
            <Eye class="h-4 w-4 text-muted-foreground/70" />
            <span class="font-bold font-mono text-foreground">{{
              formatNumber(questionInfo.visit_count)
            }}</span>
            <span>浏览</span>
          </div>
          <div class="flex items-center space-x-1.5" title="总回答数">
            <MessageSquare class="h-4 w-4 text-muted-foreground/70" />
            <span class="font-bold font-mono text-foreground">{{
              formatNumber(questionInfo.answer_count)
            }}</span>
            <span>回答</span>
          </div>
        </div>

        <!-- 交互按钮（调小关注问题，并追加查看问题日志按钮） -->
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center space-x-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary-hover transition cursor-pointer select-none active:scale-95"
          >
            <Plus class="h-3.5 w-3.5" />
            <span>关注问题</span>
          </button>
          <a
            :href="`https://www.zhihu.com/question/${questionInfo.id}/log`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center space-x-1 rounded-full bg-accent hover:bg-accent/80 text-muted-foreground hover:text-foreground px-4 py-1.5 text-xs font-bold transition cursor-pointer select-none border border-border-subtle decoration-none"
          >
            <History class="h-3.5 w-3.5" />
            <span>查看问题日志</span>
          </a>
        </div>
      </div>
    </section>
  </div>
</template>
