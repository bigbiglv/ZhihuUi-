// src/inject.ts - 运行在 MAIN World 的 fetch/XHR 拦截器 + 主动翻页引擎
// 通过 manifest.json 的 "world": "MAIN" 直接注入，天然绕过页面 CSP 限制

import { ZHIHU_API } from '@/config/api'

const originalFetch = window.fetch
const originalXHR = window.XMLHttpRequest

// 存储下一页的完整 URL（从 API 响应的 paging.next 字段提取）
let nextPageUrl: string | null = null

console.log(
  '[Inject] 拦截器启动，正在重写 window.fetch 和 window.XMLHttpRequest...',
)

/**
 * 辅助函数：清洗 URL，将跨域的 Mock IP（如 110.80.204.186）或其它不一致域名重写为同源 URL，防止浏览器 CORS 拦截
 */
function sanitizeUrl(url: string): string {
  if (!url) return url

  let targetUrl = url

  // 如果包含特定跨域 Mock IP，或者包含外部域名且不是当前 host
  if (
    targetUrl.includes('110.80.204.186') ||
    (targetUrl.startsWith('http') && !targetUrl.includes(window.location.host))
  ) {
    try {
      const parsed = new URL(targetUrl, window.location.href)
      if (parsed.host !== window.location.host) {
        const original = targetUrl
        parsed.host = window.location.host
        parsed.protocol = window.location.protocol
        targetUrl = parsed.toString()
      }
    } catch (e) {
      console.error('[Inject URL 清洗] 转换失败:', e)
    }
  }

  return targetUrl
}

/**
 * 辅助函数：统一净化 paging.next URL 并保存
 */
function handleNextPageUrl(nextUrl: string | null | undefined, source: string) {
  if (!nextUrl) return

  const cleaned = sanitizeUrl(nextUrl)
  nextPageUrl = cleaned
}

/**
 * 辅助函数：判断是否是推荐接口
 */
function isRecommendUrl(url: string): boolean {
  return url.includes(ZHIHU_API.feed.recommend) || url.includes('/recommend')
}

/**
 * 辅助函数：分发被拦截的推荐数据给 Content Script
 */
function dispatchFeedData(data: any, source: string) {
  if (data && Array.isArray(data.data)) {
    // 提取并缓存下一页 URL
    if (data.paging && data.paging.next) {
      handleNextPageUrl(data.paging.next, source)
    } else {
      console.warn(`[Inject ${source}] 响应中没有 paging.next 字段`)
    }

    window.postMessage(
      {
        type: 'ZHIHU_FEED_INTERCEPTED',
        data: data,
      },
      '*',
    )
  }
}

// ==================== 1. 重写 window.fetch ====================
window.fetch = async function (
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  let url =
    typeof args[0] === 'string'
      ? args[0]
      : args[0] instanceof Request
        ? args[0].url
        : ''

  // 清洗 URL，防止 CORS 跨域问题
  const cleanedUrl = sanitizeUrl(url)
  if (cleanedUrl !== url) {
    if (typeof args[0] === 'string') {
      args[0] = cleanedUrl
    } else if (args[0] instanceof Request) {
      // 对 Request 对象的 URL 修改，通过重新构造 Request 实现
      try {
        args[0] = new Request(cleanedUrl, args[0])
      } catch (e) {
        console.error('[Inject Fetch] 重新构建 Request 失败，回退原生:', e)
      }
    }
    url = cleanedUrl
  }

  try {
    const response = await originalFetch.apply(this, args)

    // 拦截推荐流接口
    if (isRecommendUrl(url)) {
      const clone = response.clone()
      clone
        .json()
        .then((data) => {
          dispatchFeedData(data, 'Fetch')
        })
        .catch((err) => {
          console.error('[Inject Fetch] JSON 解析失败:', err)
        })
    }

    return response
  } catch (error) {
    throw error
  }
}

// ==================== 2. 重写 window.XMLHttpRequest ====================
;(window as any).XMLHttpRequest = function () {
  const xhr = new originalXHR()
  const originalOpen = xhr.open

  xhr.open = function (method: string, url: string | URL, ...rest: any[]) {
    let targetUrl = typeof url === 'string' ? url : url.toString()

    // 清洗 URL，防止 XMLHttpRequest CORS 跨域问题
    targetUrl = sanitizeUrl(targetUrl)

    // 缓存此 XHR 实例所请求的最终 URL，以便在后续事件中过滤
    ;(xhr as any)._url = targetUrl

    return originalOpen.apply(this, [method, targetUrl, ...rest] as any)
  }

  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      const responseUrl = (xhr as any)._url || ''
      if (isRecommendUrl(responseUrl)) {
        try {
          const data = JSON.parse(xhr.responseText)
          dispatchFeedData(data, 'XHR')
        } catch (e) {
          console.error('[Inject XHR] 解析响应失败:', e)
        }
      }
    }
  })

  return xhr
}

// 保持 XMLHttpRequest 的原型继承关系，防止破坏某些框架依赖
;(window as any).XMLHttpRequest.prototype = originalXHR.prototype
// 复制 XHR 静态属性（如 UNSENT, OPENED, HEADERS_RECEIVED, LOADING, DONE 等）
for (const key in originalXHR) {
  if (Object.prototype.hasOwnProperty.call(originalXHR, key)) {
    ;(window as any).XMLHttpRequest[key] = (originalXHR as any)[key]
  }
}

// ==================== 3. 监听来自 Content Script 的指令 ====================
window.addEventListener('message', (event) => {
  if (!event.data) return

  // A. 加载下一页推荐
  if (event.data.type === 'ZHIHU_LOAD_MORE') {
    let urlToFetch: string

    if (nextPageUrl) {
      urlToFetch = nextPageUrl
      nextPageUrl = null // 清空防止重复请求
    } else {
      // 冷启动兜底：主动构造首页推荐接口初始 URL（解决原生 #root 被隐藏后无法被动拦截的问题）
      urlToFetch = `https://${window.location.host}/${ZHIHU_API.feed.recommend}?page_number=1&limit=10&action=down&after_id=0`
    }

    // 双重清洗以防万一
    urlToFetch = sanitizeUrl(urlToFetch)

    originalFetch(urlToFetch, {
      credentials: 'include',
      headers: {
        accept: 'application/json, text/plain, */*',
        'x-requested-with': 'fetch',
      },
    })
      .then((res) => res.json())
      .then((data) => {
        dispatchFeedData(data, '翻页引擎')
      })
      .catch((err) => {
        console.error('[Inject] 主动请求下一页失败:', err)
        nextPageUrl = urlToFetch // 还原链接允许重试
      })
  }

  // B. 代理网络请求（用于绕过跨域、安全策略并带上签名/Cookie）
  if (event.data.type === 'ZHIHU_PROXY_FETCH') {
    let { url, requestId, method, body, headers: customHeaders } = event.data

    url = sanitizeUrl(url)

    const headers: Record<string, string> = {
      accept: 'application/json, text/plain, */*',
      'x-requested-with': 'fetch',
    }

    if (customHeaders) {
      for (const [k, v] of Object.entries(customHeaders)) {
        headers[k.toLowerCase()] = v as string
      }
    }

    if (body && !headers['content-type']) {
      headers['content-type'] = 'application/json'
    }

    // 在 MAIN World 中发起 fetch，此时知乎底层的网络拦截器能够自动对该请求加上必要的安全签名（如 x-zse-96）
    window
      .fetch(url, {
        method: method || 'GET',
        headers,
        body: body
          ? typeof body === 'string'
            ? body
            : JSON.stringify(body)
          : undefined,
      })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP 状态码异常: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        window.postMessage(
          {
            type: 'ZHIHU_PROXY_FETCH_SUCCESS',
            requestId,
            data,
          },
          '*',
        )
      })
      .catch((err) => {
        console.error('[Inject] 代理请求失败:', err)
        window.postMessage(
          {
            type: 'ZHIHU_PROXY_FETCH_ERROR',
            requestId,
            error: err.message || '未知网络错误',
          },
          '*',
        )
      })
  }
})

console.log(
  '[Inject] window.fetch 与 window.XMLHttpRequest 重写完毕，主动翻页引擎已就绪',
)

// ==================== 4. 劫持 History API 并进行 SPA 路由跳转广播 ====================
const patchHistory = () => {
  const originalPushState = window.history.pushState
  const originalReplaceState = window.history.replaceState

  window.history.pushState = function (...args) {
    const result = originalPushState.apply(this, args)
    window.postMessage(
      { type: 'ZHIHU_SPA_URL_CHANGE', url: window.location.pathname },
      '*',
    )
    return result
  }

  window.history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args)
    window.postMessage(
      { type: 'ZHIHU_SPA_URL_CHANGE', url: window.location.pathname },
      '*',
    )
    return result
  }
}

try {
  patchHistory()
  console.log(
    '[Inject] History API (pushState/replaceState) 劫持成功，SPA 路由事件广播就绪',
  )
} catch (e) {
  console.error('[Inject] History API 劫持失败:', e)
}
