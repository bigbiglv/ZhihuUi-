export const ZhihuPageType = {
  HOME: 'HOME',
  SIGNIN: 'SIGNIN',
  SIGNUP: 'SIGNUP',
  SEARCH: 'SEARCH',
  QUESTION_DETAIL: 'QUESTION_DETAIL',
  QUESTION_ANSWER: 'QUESTION_ANSWER',
  QUESTION_LOG: 'QUESTION_LOG',
  QUESTION_WRITE: 'QUESTION_WRITE',
  UNKNOWN: 'UNKNOWN',
} as const

export type ZhihuPageType = (typeof ZhihuPageType)[keyof typeof ZhihuPageType]

export interface RouteMatchResult {
  pageType: ZhihuPageType
  reshape: boolean
  params: Record<string, string>
}

interface RouteConfig {
  pattern: RegExp
  pageType: ZhihuPageType
  reshape: boolean
  paramNames?: string[]
}

const routes: RouteConfig[] = [
  // 首页与登录/注册相关
  { pattern: /^\/?$/, pageType: ZhihuPageType.HOME, reshape: true },
  { pattern: /^\/hot\/?$/, pageType: ZhihuPageType.HOME, reshape: true },
  { pattern: /^\/signin\/?$/, pageType: ZhihuPageType.SIGNIN, reshape: true },
  {
    pattern: /^\/signup(\/.*)?$/,
    pageType: ZhihuPageType.SIGNUP,
    reshape: true,
  },

  // 搜索页
  {
    pattern: /^\/search(\/.*)?$/,
    pageType: ZhihuPageType.SEARCH,
    reshape: true,
  },

  // 问题与回答相关
  {
    pattern: /^\/question\/(\d+)\/?$/,
    pageType: ZhihuPageType.QUESTION_DETAIL,
    reshape: true,
    paramNames: ['id'],
  },
  {
    pattern: /^\/question\/(\d+)\/answer\/(\d+)\/?$/,
    pageType: ZhihuPageType.QUESTION_ANSWER,
    reshape: true,
    paramNames: ['id', 'answerId'],
  },

  // 问题页面不需要重塑的子页面
  {
    pattern: /^\/question\/(\d+)\/log\/?$/,
    pageType: ZhihuPageType.QUESTION_LOG,
    reshape: false,
    paramNames: ['id'],
  },
  {
    pattern: /^\/question\/(\d+)\/write\/?$/,
    pageType: ZhihuPageType.QUESTION_WRITE,
    reshape: false,
    paramNames: ['id'],
  },
]

/**
 * 统一路由匹配器
 * 输入 pathname，输出匹配的页面类型、是否重塑标志以及提取的路由参数
 */
export function matchRoute(pathname: string): RouteMatchResult {
  for (const route of routes) {
    const match = pathname.match(route.pattern)
    if (match) {
      const params: Record<string, string> = {}
      if (route.paramNames) {
        route.paramNames.forEach((name, index) => {
          // match[1] 开始是正则的分组捕获结果
          params[name] = match[index + 1]
        })
      }
      return {
        pageType: route.pageType,
        reshape: route.reshape,
        params,
      }
    }
  }

  // 默认兜底：未知页面，不触发重塑
  return {
    pageType: ZhihuPageType.UNKNOWN,
    reshape: false,
    params: {},
  }
}
