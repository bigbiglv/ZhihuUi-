// src/utils/proxyFetch.ts - 用于 Content Script (Vue) 与 MAIN World (inject.ts) 通信的通用请求代理

interface ProxyResponse {
  type: string
  requestId: string
  data?: any
  error?: string
}

// 暂存挂起的请求 Promise 控制器
const pendingRequests = new Map<
  string,
  {
    resolve: (value: any) => void
    reject: (reason?: any) => void
  }
>()

// 全局监听来自 MAIN World 的响应消息
window.addEventListener('message', (event) => {
  if (!event.data) return
  const { type, requestId, data, error } = event.data as ProxyResponse

  if (type === 'ZHIHU_PROXY_FETCH_SUCCESS' && pendingRequests.has(requestId)) {
    const request = pendingRequests.get(requestId)
    if (request) {
      pendingRequests.delete(requestId)
      request.resolve(data)
    }
  } else if (
    type === 'ZHIHU_PROXY_FETCH_ERROR' &&
    pendingRequests.has(requestId)
  ) {
    const request = pendingRequests.get(requestId)
    if (request) {
      pendingRequests.delete(requestId)
      request.reject(new Error(error || '未知代理网络错误'))
    }
  }
})

/**
 * 代理获取知乎 API 数据（在 MAIN World 上下文中发起请求，自动带上所有校验头和登录态 Cookie）
 * @param url 完整的知乎 API 地址或相对路径
 * @param options 请求配置项，如 method 和 body
 * @returns 解析后的 JSON 数据 Promise
 */
export function proxyFetch(
  url: string,
  options: { method?: string; body?: any; headers?: Record<string, string> } = {},
): Promise<any> {
  return new Promise((resolve, reject) => {
    // 生成唯一请求 ID
    const requestId = `req_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`

    // 注册 Promise 控制器
    pendingRequests.set(requestId, { resolve, reject })

    // 补全相对路径
    const targetUrl = url.startsWith('/')
      ? `${window.location.origin}${url}`
      : url

    // 向 MAIN World 发送代理请求指令
    window.postMessage(
      {
        type: 'ZHIHU_PROXY_FETCH',
        requestId,
        url: targetUrl,
        method: options.method || 'GET',
        body: options.body,
        headers: options.headers,
      },
      '*',
    )

    // 15 秒超时保护
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        const request = pendingRequests.get(requestId)
        if (request) {
          pendingRequests.delete(requestId)
          request.reject(new Error(`请求知乎接口超时 (${url})`))
        }
      }
    }, 15000)
  })
}
