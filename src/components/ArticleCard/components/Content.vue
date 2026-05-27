<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import ImagePreview from '@/components/ImagePreview/index.vue'
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
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import { proxyFetch } from '@/utils/proxyFetch.ts'
import { ZHIHU_API } from '@/config/api.ts'

// 建立域名到站点信息与图标的映射，避免冗长的 if-else
const SITE_ICONS: Record<string, { name: string; path: string }> = {
  'github.com': { name: 'GitHub', path: siGithub.path },
  'bilibili.com': { name: '哔哩哔哩', path: siBilibili.path },
  'youtube.com': { name: 'YouTube', path: siYoutube.path },
  'youtu.be': { name: 'YouTube', path: siYoutube.path },
  'weibo.com': { name: '微博', path: siSinaweibo.path },
  'zhihu.com': { name: '知乎', path: siZhihu.path },
  'taobao.com': { name: '淘宝', path: siTaobao.path },
  'tmall.com': { name: '天猫', path: siTaobao.path },
  'jd.com': { name: '京东', path: siTaobao.path }, // 没有 JD 专门图标，复用电商或降级
  'juejin.cn': { name: '掘金', path: siJuejin.path },
  'csdn.net': { name: 'CSDN', path: siCsdn.path },
  'xiaohongshu.com': { name: '小红书', path: siXiaohongshu.path },
}

function getBadgeContent(domain: string) {
  const matchedKey = Object.keys(SITE_ICONS).find((key) => domain.includes(key))
  if (matchedKey) {
    const site = SITE_ICONS[matchedKey]
    const svgIcon = `<svg class="h-3.5 w-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle; width: 14px; height: 14px;"><path d="${site.path}"/></svg>`
    return { name: site.name, svg: svgIcon }
  }
  // Default link icon
  const defaultSvg = `<svg class="h-3.5 w-3.5 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="display:inline-block; vertical-align:middle; width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>`
  return { name: domain || '网页链接', svg: defaultSvg }
}

// 大图预览控制状态
const isPreviewVisible = ref(false)
const previewImageSrc = ref('')

// 转换并重构展开的长文富文本 HTML，优化图片预览、嵌入视频和防止超长超链接溢出
function formatRichContentHtml(content: string) {
  if (!content) return ''
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')

    // 优化所有长文中的 <img> 标签，加上放大手势
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

    // 识别超链接，重构视频播放器与长链接溢出
    const links = doc.querySelectorAll('a')
    links.forEach((link) => {
      const href = link.getAttribute('href') || ''

      // 识别视频：指向知乎视频页面
      const videoMatch = href.match(/\/video\/(\d+)/)
      const videoId = videoMatch ? videoMatch[1] : null
      const isVideoLink = link.classList.contains('video-box') || !!videoId

      if (isVideoLink && videoId) {
        // 创建一个极其高颜值的原地嵌入式 iframe 视频播放容器
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

      // 解析普通超链接，拦截知乎外链跳转，并在条件允许时将其转换为带站点图标的徽章按钮
      const isMention =
        link.classList.contains('member_link') ||
        link.textContent?.trim().startsWith('@')
      if (!isMention) {
        // 提取真实的 target URL，跳过知乎的安全提示页面
        let targetUrl = href
        try {
          const urlObj = new URL(href)
          if (urlObj.hostname === 'link.zhihu.com') {
            const actualTarget = urlObj.searchParams.get('target')
            if (actualTarget) {
              targetUrl = decodeURIComponent(actualTarget)
            }
          }
        } catch (e) {}

        link.setAttribute('href', targetUrl)
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')

        const textContent = link.textContent?.trim() || ''
        // 放宽识别条件：所有带 http 前缀的纯链接文本，或较长的普通文本链接，都会统一转化为徽章按钮
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
          // 使用 inline-flex 布局，设置 hover 动效，使用 truncate 处理超长文字
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
    console.error('[formatRichContentHtml] 解析长文富文本失败:', err)
    return content
  }
}

// 劫持富文本内部的点击事件，实现长文图片点击预览大图
function handleContentClick(e: MouseEvent) {
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

import type { StandardCardData } from '@/utils/mapCardData.ts'

interface Props {
  data: StandardCardData
}

const props = defineProps<Props>()

const contentRef = ref<HTMLElement | null>(null)
const isContentExpanded = ref(false)

// 提取摘要文本（过滤掉 HTML 标签以展示纯文本）
const summaryText = computed(() => {
  const text = props.data.excerpt || props.data.content || '暂无内容摘要'
  return text.replace(/<[^>]+>/g, '').trim()
})

// 展开/折叠全文
function toggleContent() {
  if (isContentExpanded.value) {
    isContentExpanded.value = false
    nextTick(() => {
      if (contentRef.value) {
        // 向上寻找最近的 article 卡片容器，实现平滑滚动定位
        const cardEl = contentRef.value.closest('article')
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect()
          // 如果卡片头部超出了视口上方（加上 Header 的高度），则平滑滚动回合适的位置
          if (rect.top < 80) {
            window.scrollBy({
              top: rect.top - 80,
              behavior: 'smooth',
            })
          }
        }
      }
    })
  } else {
    isContentExpanded.value = true
    
    // 展开全文时，调用接口上报阅读历史
    if (props.data && props.data.id) {
      proxyFetch(ZHIHU_API.action.readHistory, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          content_token: String(props.data.id),
          content_type: props.data.type || 'article',
        },
      }).catch((err) => {
        console.error('[Read History] 上报历史记录失败:', err)
      })
    }
  }
}
</script>

<template>
  <!-- 内容区：折叠与展开 -->
  <div ref="contentRef" class="mt-3">
    <!-- 折叠模式下 -->
    <div v-if="!isContentExpanded" class="relative">
      <p class="text-[14px] text-rich-text leading-relaxed line-clamp-3">
        {{ summaryText }}
      </p>
      <!-- 渐变模糊背景遮罩 -->
      <div
        class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-gradient-mask-from to-transparent pointer-events-none"
      ></div>

      <!-- 展开全文按钮 -->
      <div
        @click="toggleContent"
        class="mt-2 text-primary hover:text-primary-hover text-xs font-bold cursor-pointer flex items-center justify-end space-x-1 select-none transition ml-auto w-fit"
      >
        <span>展开阅读全文</span>
        <ChevronDown class="h-3.5 w-3.5" />
      </div>
    </div>

    <!-- 展开全文模式下 -->
    <div v-else class="space-y-4">
      <!-- 渲染原生 HTML 内容 -->
      <div
        v-html="
          formatRichContentHtml(data.content || data.excerpt)
        "
        class="zhihu-rich-content text-[14px] text-rich-text leading-relaxed font-normal"
        @click="handleContentClick"
      ></div>

      <!-- 收起全文按钮（悬浮在视口右下方） -->
      <div
        @click="toggleContent"
        class="sticky bottom-6 z-20 text-primary hover:text-primary-hover text-xs font-bold cursor-pointer flex items-center justify-center space-x-1.5 select-none py-2 px-4 bg-collapse-btn-bg backdrop-blur-md rounded-full shadow-lg border border-collapse-btn-border hover:border-[var(--collapse-btn-hover-border)] hover:bg-[var(--collapse-btn-hover-bg)] transition-all duration-300 ml-auto w-fit active:scale-95"
      >
        <span>收起全文</span>
        <ChevronUp class="h-3.5 w-3.5" />
      </div>
    </div>

    <!-- 复用大图无缝预览遮罩层 -->
    <ImagePreview v-model:visible="isPreviewVisible" :src="previewImageSrc" />
  </div>
</template>
