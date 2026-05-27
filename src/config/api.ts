/**
 * 知乎 API 配置文件
 * 集中管理项目中用到的所有知乎官方接口地址与跳转链接
 * 方便知乎官方调整时进行统一修改
 */

/**
 * 知乎官方 API 接口路径配置
 */
export const ZHIHU_API = {
  // 推荐流相关接口
  feed: {
    /**
     * 推荐流接口标识路径 (用于 inject.ts 中的拦截过滤)
     */
    recommend: 'api/v3/feed/topstory/recommend',
  },

  // 互动操作相关接口
  action: {
    /**
     * 回答赞同/反对操作接口
     * @param answerId 回答 ID
     * @method POST
     * @body { type: 'up' | 'down' | 'neutral' }
     */
    voteAnswer: (answerId: number | string) =>
      `/api/v4/answers/${answerId}/voters`,

    /**
     * 文章点赞/取消点赞操作接口
     * @param articleId 文章 ID
     * @method POST (点赞) / DELETE (取消点赞)
     */
    likeArticle: (articleId: number | string) =>
      `/api/v4/articles/${articleId}/likers`,

    /**
     * 不感兴趣 / 模拟踩文章等负反馈操作接口
     * @method POST
     * @body x-www-form-urlencoded
     */
    feedAction: '/api/v4/zrec-feedback/uninterested',

    /**
     * 屏蔽用户
     * @param urlToken 用户的 url_token
     * @method POST
     */
    blockUser: (urlToken: string) => `/api/v4/members/${urlToken}/actions/block`,

    /**
     * 上报阅读历史
     * @method POST
     * @body { content_token: string, content_type: string } (application/json)
     */
    readHistory: '/api/v4/read_history/add',
  },

  // 收藏夹相关接口
  favorite: {
    /**
     * 获取个人收藏夹列表
     * @param limit 限制获取的数量，默认 5
     */
    list: (limit = 5) => `/api/v4/people/self/favlists?limit=${limit}`,

    /**
     * 添加内容到收藏夹
     * @param favlistId 收藏夹 ID
     * @method POST
     * @body { content_id: number | string, content_type: string }
     */
    addItem: (favlistId: number | string) =>
      `/api/v4/favlists/${favlistId}/items`,

    /**
     * 从收藏夹删除已收藏的内容
     * @param favlistId 收藏夹 ID
     * @param contentId 内容 ID (例如回答 ID 或文章 ID)
     * @method DELETE
     */
    removeItem: (favlistId: number | string, contentId: number | string) =>
      `/api/v4/favlists/${favlistId}/items/${contentId}`,
  },

  // 评论相关接口
  comment: {
    /**
     * 获取根评论（一级评论）列表
     * @param type 资源类型: 'answers' | 'articles' | 'pins'
     * @param id 资源 ID
     * @param limit 每页条数限制，默认 20
     * @param orderBy 排序规则: 'score' (按热度) | 'ts' (按时间)
     */
    rootComments: (
      type: 'answers' | 'articles' | 'pins',
      id: number | string,
      limit = 20,
      orderBy = 'score',
      reverse = false,
    ) =>
      `/api/v4/comment_v5/${type}/${id}/root_comment?order_by=${orderBy}&limit=${limit}${reverse ? '&reverse=true' : ''}&offset=`,

    /**
     * 获取二级评论（子回复评论）列表
     * @param commentId 一级评论 ID
     * @param limit 每页条数限制，默认 20
     */
    childComments: (commentId: number | string, limit = 20) =>
      `/api/v4/comments/${commentId}/child_comments?limit=${limit}&offset=`,

    /**
     * 评论点赞 (根据 user curl: POST)
     * 取消点赞通常是 DELETE
     */
    like: (commentId: number | string) =>
      `/api/v4/comments/${commentId}/like`,

    /**
     * 评论踩 (根据 user curl: PUT)
     * 取消踩可能需要 DELETE
     */
    downvote: (commentId: number | string) =>
      `/api/v4/comment_v5/comment/${commentId}/reaction/dislike`,
  },
} as const

/**
 * 知乎官方 Web 页面跳转 URL 配置
 */
export const ZHIHU_WEB_URL = {
  /**
   * 问题详情页
   * @param questionId 问题 ID
   */
  question: (questionId: number | string) =>
    `https://www.zhihu.com/question/${questionId}`,

  /**
   * 回答详情页
   * @param questionId 问题 ID
   * @param answerId 回答 ID
   */
  answer: (questionId: number | string, answerId: number | string) =>
    `https://www.zhihu.com/question/${questionId}/answer/${answerId}`,

  /**
   * 专栏文章详情页
   * @param articleId 文章 ID
   */
  article: (articleId: number | string) =>
    `https://zhuanlan.zhihu.com/p/${articleId}`,

  /**
   * 个人中心页
   * @param token 用户标识，如 url_token
   */
  profile: (token?: string) =>
    token
      ? `https://www.zhihu.com/people/${token}`
      : 'https://www.zhihu.com/people',

  /**
   * 搜索页面跳转
   * @param query 搜索关键词
   */
  search: (query: string) =>
    `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(query)}`,

  /**
   * 通用兜底跳转地址
   * @param type 资源类型，例如 'people'
   * @param id 资源 ID
   */
  fallback: (type: string, id: number | string) =>
    `https://www.zhihu.com/${type}/${id}`,
} as const

/**
 * 知乎官方默认静态资源配置
 */
export const ZHIHU_STATIC = {
  /**
   * 知乎默认保底头像（官方灰色双圈头像）
   */
  defaultAvatar:
    'https://pic1.zhimg.com/v2-ab422a7e109859907ea9fc553da9d852_l.jpg',
} as const
