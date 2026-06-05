// src/inject.ts - 运行在 MAIN World 的 fetch/XHR 拦截器 + 主动翻页引擎
// 通过 manifest.json 的 "world": "MAIN" 直接注入，天然绕过页面 CSP 限制

import { ZHIHU_API } from '@/config/api'

const originalFetch = window.fetch
const originalXHR = window.XMLHttpRequest

// ==================== 0. 伪装 toString，防反爬指纹检测 ====================
const originalToString = Function.prototype.toString
const fakeToStringMap = new WeakMap<Function, string>()

Object.defineProperty(Function.prototype, 'toString', {
  value: function toString() {
    if (fakeToStringMap.has(this)) {
      return fakeToStringMap.get(this)
    }
    if (this === Function.prototype.toString) {
      return 'function toString() { [native code] }'
    }
    return originalToString.call(this)
  },
  writable: true,
  configurable: true,
  enumerable: false,
})

function mockToString(fn: Function, originalFnOrName: Function | string) {
  let name = ''
  if (typeof originalFnOrName === 'string') {
    name = originalFnOrName
  } else if (typeof originalFnOrName === 'function') {
    name = originalFnOrName.name
  }
  fakeToStringMap.set(fn, `function ${name}() { [native code] }`)
}

// 存储下一页的完整 URL（从 API 响应的 paging.next 字段提取）
let nextPageUrl: string | null = null

console.log(
  '[Inject] 拦截器启动，正在使用 Proxy 重写 window.fetch 和 window.XMLHttpRequest 并伪装 toString...',
)

/**
 * 辅助函数：清洗 URL。仅改写 api.zhihu.com 和 110.80.204.186 的 API，其他放行。
 */
function sanitizeUrl(url: string): string {
  if (!url) return url
  let targetUrl = url
  try {
    const parsed = new URL(targetUrl, window.location.href)
    // 仅当目标 Host 包含 api.zhihu.com 或 110.80.204.186 时，改写为同域访问
    if (
      parsed.host.includes('api.zhihu.com') ||
      parsed.host.includes('110.80.204.186')
    ) {
      if (parsed.host !== window.location.host) {
        parsed.host = window.location.host
        parsed.protocol = window.location.protocol
        targetUrl = parsed.toString()
      }
    }
  } catch (e) {
    // 相对路径解析失败或为非法 URL 时，不作处理
  }
  return targetUrl
}

function handleNextPageUrl(nextUrl: string | null | undefined) {
  if (!nextUrl) return
  const cleaned = sanitizeUrl(nextUrl)
  nextPageUrl = cleaned
}

function isRecommendUrl(url: string): boolean {
  return url.includes(ZHIHU_API.feed.recommend) || url.includes('/recommend')
}

function dispatchFeedData(data: any, source: string) {
  console.log(`[Inject Feed Data] 来自: ${source}, 数据项数:`, data?.data?.length)
  if (data && Array.isArray(data.data)) {
    if (data.paging && data.paging.next) {
      handleNextPageUrl(data.paging.next)
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

// ==================== 1. 使用 Proxy 重写 window.fetch ====================
// 使用 Proxy 是为了彻底绕过原站防篡改机制（如 Function.prototype.toString 检测）
window.fetch = new Proxy(originalFetch, {
  apply(target, thisArg, args: Parameters<typeof fetch>) {
    let url = typeof args[0] === 'string'
      ? args[0]
      : args[0] instanceof Request
        ? args[0].url
        : ''

    const cleanedUrl = sanitizeUrl(url)
    if (cleanedUrl !== url) {
      if (typeof args[0] === 'string') {
        args[0] = cleanedUrl
      } else if (args[0] instanceof Request) {
        try {
          args[0] = new Request(cleanedUrl, args[0])
        } catch (e) {}
      }
      url = cleanedUrl
    }

    const responsePromise = Reflect.apply(target, thisArg, args)

    if (isRecommendUrl(url)) {
      responsePromise
        .then((response: Response) => {
          const clone = response.clone()
          clone.json()
            .then(data => dispatchFeedData(data, 'Fetch'))
            .catch(err => console.error('[Inject Fetch] JSON 解析失败:', err))
        })
        .catch(() => {})
    }

    return responsePromise
  }
})
mockToString(window.fetch, 'fetch')

// ==================== 2. 使用 Proxy 重写 window.XMLHttpRequest ====================
window.XMLHttpRequest = new Proxy(originalXHR, {
  construct(target, args) {
    const xhr = Reflect.construct(target, args)
    const originalOpen = xhr.open

    xhr.open = new Proxy(originalOpen, {
      apply(openTarget, openThisArg, openArgs) {
        let url = openArgs[1]
        let targetUrl = typeof url === 'string' ? url : url.toString()
        targetUrl = sanitizeUrl(targetUrl)
        openArgs[1] = targetUrl
        ;(xhr as any)._url = targetUrl
        return Reflect.apply(openTarget, openThisArg, openArgs)
      }
    })
    mockToString(xhr.open, 'open')

    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        const responseUrl = (xhr as any)._url || ''
        if (isRecommendUrl(responseUrl)) {
          try {
            const data = JSON.parse(xhr.responseText)
            dispatchFeedData(data, 'XHR')
          } catch (e) {}
        }
      }
    })

    return xhr
  }
})
mockToString(window.XMLHttpRequest, 'XMLHttpRequest')

// ==================== 3. 监听来自 Content Script 的指令 ====================
window.addEventListener('message', (event) => {
  if (!event.data) return

  if (event.data.type === 'ZHIHU_LOAD_MORE') {
    let urlToFetch = nextPageUrl || `https://${window.location.host}/${ZHIHU_API.feed.recommend}?page_number=1&limit=10&action=down&after_id=0`
    nextPageUrl = null
    urlToFetch = sanitizeUrl(urlToFetch)

    originalFetch(urlToFetch, {
      credentials: 'include',
      headers: {
        accept: 'application/json, text/plain, */*',
        'x-requested-with': 'fetch',
      },
    })
      .then((res) => res.json())
      .then((data) => dispatchFeedData(data, '翻页引擎'))
      .catch(() => {
        nextPageUrl = urlToFetch
      })
  }

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

    window
      .fetch(url, {
        method: method || 'GET',
        headers,
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP 状态码异常: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        window.postMessage({ type: 'ZHIHU_PROXY_FETCH_SUCCESS', requestId, data }, '*')
      })
      .catch((err) => {
        window.postMessage({ type: 'ZHIHU_PROXY_FETCH_ERROR', requestId, error: err.message || '未知网络错误' }, '*')
      })
  }
})

// ==================== 4. 劫持 History API ====================
const patchHistory = () => {
  window.history.pushState = new Proxy(window.history.pushState, {
    apply(target, thisArg, args) {
      const result = Reflect.apply(target, thisArg, args)
      window.postMessage({ type: 'ZHIHU_SPA_URL_CHANGE', url: window.location.pathname }, '*')
      return result
    }
  })
  mockToString(window.history.pushState, 'pushState')

  window.history.replaceState = new Proxy(window.history.replaceState, {
    apply(target, thisArg, args) {
      const result = Reflect.apply(target, thisArg, args)
      window.postMessage({ type: 'ZHIHU_SPA_URL_CHANGE', url: window.location.pathname }, '*')
      return result
    }
  })
  mockToString(window.history.replaceState, 'replaceState')
}

try {
  patchHistory()
} catch (e) {}
