import { ref, computed, onMounted, onUnmounted } from 'vue'
import { matchRoute, ZhihuPageType } from '@/utils/routeMatcher'
import { isYanxuanContent } from '@/utils/yanxuan'

const MESSAGE_TYPE_SUCCESS = 'ZHIHU_PROXY_FETCH_SUCCESS'
const MESSAGE_TYPE_ERROR = 'ZHIHU_PROXY_FETCH_ERROR'

/**
 * 格式化问题对象，将 SSR 的驼峰命名兼容为与知乎 API 一致的蛇形命名
 */
const mapQuestionToSnakeCase = (question: any) => {
  if (!question) return null
  return {
    ...question,
    answer_count:
      question.answer_count !== undefined
        ? question.answer_count
        : question.answerCount,
    comment_count:
      question.comment_count !== undefined
        ? question.comment_count
        : question.commentCount,
    follower_count:
      question.follower_count !== undefined
        ? question.follower_count
        : question.followerCount,
    visit_count:
      question.visit_count !== undefined
        ? question.visit_count
        : question.visitCount || question.visitCountTotal || 0,
  }
}

/**
 * 格式化回答对象，确保其包含 voteup_count, comment_count 以及正确的作者信息以完美适配 AnswerCard 组件
 */
const mapAnswerToSnakeCase = (answer: any, state?: any) => {
  if (!answer) return null

  // 解析作者信息
  let authorObj: any = {
    name: '匿名用户',
    avatar_url:
      'https://pic1.zhimg.com/v2-ab422a7e109859907ea9fc553da9d852_l.jpg',
    headline: '',
    type: 'people',
  }
  const authorRef = answer.author

  if (authorRef) {
    if (typeof authorRef === 'object') {
      authorObj = { ...authorRef }
    } else if (typeof authorRef === 'string' && state) {
      const userObj =
        state.entities?.users?.[authorRef] ||
        state.entities?.people?.[authorRef]
      if (userObj) {
        authorObj = { ...userObj }
      }
    }
  }

  // 驼峰命名转换为蛇形命名以适应已有的组件
  if (authorObj && !authorObj.avatar_url && authorObj.avatarUrl) {
    authorObj.avatar_url = authorObj.avatarUrl
  }

  return {
    ...answer,
    voteup_count:
      answer.voteup_count !== undefined
        ? answer.voteup_count
        : answer.voteupCount || 0,
    comment_count:
      answer.comment_count !== undefined
        ? answer.comment_count
        : answer.commentCount || 0,
    author: authorObj,
    question: answer.question || {
      id: answer.questionId || (answer.question && answer.question.id),
      title: answer.question && answer.question.title,
    },
  }
}

export function useQuestion() {
  const questionId = ref('')
  const answerId = ref('')
  const mode = ref<'single_answer' | 'all_answers'>('all_answers')

  // 数据状态
  const questionInfo = ref<any>(null)
  const singleAnswer = ref<any>(null)
  const rawAnswersList = ref<any[]>([])

  const isHideYanxuanEnabled = ref(true)

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get('hideYanxuan')
      isHideYanxuanEnabled.value = result.hideYanxuan !== false
    } catch (e) {
      console.error('[useQuestion] 读取存储失败:', e)
    }
  }

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'local' && changes.hideYanxuan) {
      isHideYanxuanEnabled.value = changes.hideYanxuan.newValue !== false
    }
  }

  const answersList = computed(() => {
    if (!isHideYanxuanEnabled.value) return rawAnswersList.value
    return rawAnswersList.value.filter(item => !isYanxuanContent(item.target))
  })

  // 加载锁
  const isQuestionLoading = ref(false)
  const isAnswersLoading = ref(false)
  const isSingleAnswerLoading = ref(false)

  // 分页控制
  const nextPageUrl = ref<string | null>(null)
  const isEnd = ref(false)

  // 排序控制
  const answersSortBy = ref<'default' | 'updated'>('default')

  /**
   * 解析当前浏览器地址栏的 ID 及展示模式
   */
  const parseRoute = () => {
    const path = window.location.pathname
    const matchResult = matchRoute(path)

    questionId.value = matchResult.params.id || ''

    if (matchResult.pageType === ZhihuPageType.QUESTION_ANSWER) {
      answerId.value = matchResult.params.answerId || ''
      mode.value = 'single_answer'
    } else {
      answerId.value = ''
      mode.value = 'all_answers'
    }
  }

  /**
   * 通道 A：冷启动时，尝试从 SSR 的 #js-initialData 中极速提取数据
   */
  const loadFromSSR = (): boolean => {
    try {
      const initialDataEl = document.getElementById('js-initialData')
      if (!initialDataEl || !initialDataEl.textContent) {
        return false
      }

      const initialData = JSON.parse(initialDataEl.textContent)
      const state = initialData?.initialState
      if (!state) return false

      let hasData = false

      // 抓取问题主体数据
      const ssrQuestion = state.entities?.questions?.[questionId.value]
      if (ssrQuestion) {
        questionInfo.value = mapQuestionToSnakeCase(ssrQuestion)
        console.log(
          '[useQuestion] 🎯 成功从 SSR 首屏提取到问题详情:',
          questionInfo.value.title,
        )
        hasData = true
      }

      // 抓取单回答数据 (若有)
      if (mode.value === 'single_answer' && answerId.value) {
        const ssrAnswer = state.entities?.answers?.[answerId.value]
        if (ssrAnswer) {
          singleAnswer.value = mapAnswerToSnakeCase(ssrAnswer, state)
          console.log(
            '[useQuestion] 🎯 成功从 SSR 首屏提取到特定高亮回答，作者为:',
            singleAnswer.value.author?.name,
          )
        }
      }

      // 3. 抓取多回答列表数据 (若有)
      const answersMap = state.entities?.answers
      if (answersMap && Object.keys(answersMap).length > 0) {
        // 过滤出当前问题对应的所有预加载回答
        const preloadedAnswers = Object.values(answersMap)
          .filter((ans: any) => {
            const qId = ans.questionId || (ans.question && ans.question.id)
            return String(qId) === String(questionId.value)
          })
          .map((ans: any) => mapAnswerToSnakeCase(ans, state))
          .filter(Boolean)

        if (preloadedAnswers.length > 0) {
          // 封装为兼容 AnswerCard 的 FeedItem 格式
          const feedItems = preloadedAnswers.map((ans: any) => ({
            id: String(ans.id),
            type: 'answer_result',
            target: ans,
          }))

          // 排序：单回答优先，其余按票数排序
          feedItems.sort((a: any, b: any) => {
            if (String(a.target.id) === String(answerId.value)) return -1
            if (String(b.target.id) === String(answerId.value)) return 1
            return (b.target.voteup_count || 0) - (a.target.voteup_count || 0)
          })

          // 如果是展示所有回答，直接赋给列表
          if (mode.value === 'all_answers') {
            rawAnswersList.value = feedItems
            console.log(
              `[useQuestion] 🎯 成功从 SSR 提取到 ${feedItems.length} 条回答列表`,
            )
          }
        }
      }

      // 提取分页信息
      const pagination = state.question?.answers?.[questionId.value]
      if (pagination) {
        isEnd.value = pagination.isEnd || false
        if (pagination.next) {
          let nextUrl = pagination.next
          if (nextUrl.includes('api.zhihu.com')) {
            nextUrl = nextUrl.replace(/^https?:\/\/api\.zhihu\.com/, '')
          }
          nextPageUrl.value = nextUrl
          console.log(
            '[useQuestion] 🎯 从 SSR 提取到回答下一页链接:',
            nextPageUrl.value,
          )
        }
      }

      return hasData
    } catch (err) {
      console.error('[useQuestion] 尝试解析 SSR 首屏数据失败:', err)
      return false
    }
  }

  /**
   * 通道 B：当无首屏数据或进行 SPA 跳转时，通过代理发起 fetch 网络请求获取数据
   */
  const fetchQuestionDetail = () => {
    if (!questionId.value) return
    isQuestionLoading.value = true

    const requestId = `question_info_${questionId.value}_${Date.now()}`
    const url = `/api/v4/questions/${questionId.value}?include=detail,excerpt,answer_count,comment_count,follower_count,visit_count`

    window.postMessage(
      {
        type: 'ZHIHU_PROXY_FETCH',
        requestId,
        url,
        method: 'GET',
      },
      '*',
    )
  }

  const fetchSingleAnswer = () => {
    if (!answerId.value) return
    isSingleAnswerLoading.value = true

    const requestId = `single_answer_${answerId.value}_${Date.now()}`
    const url = `/api/v4/answers/${answerId.value}?include=content,excerpt,voteup_count,comment_count,created_time,updated_time,author.badge[*].topics,author.vip_info,relationship.voting,relationship.is_thanked,relationship.is_nothelp,reaction.relation,reaction.statistics,thanks_count,favorite_count,visited_count`

    window.postMessage(
      {
        type: 'ZHIHU_PROXY_FETCH',
        requestId,
        url,
        method: 'GET',
      },
      '*',
    )
  }

  const fetchAnswersList = (isFirstPage = true) => {
    if (!questionId.value) return
    isAnswersLoading.value = true

    if (isFirstPage) {
      rawAnswersList.value = []
      nextPageUrl.value = null
      isEnd.value = false
    }

    const requestId = `question_answers_${questionId.value}_${isFirstPage ? 'first' : 'more'}_${Date.now()}`
    const url = isFirstPage
      ? `/api/v4/questions/${questionId.value}/answers?include=data[*].is_normal,content,excerpt,voteup_count,comment_count,created_time,updated_time,author.badge[*].topics,author.vip_info,relationship.voting,relationship.is_thanked,relationship.is_nothelp,reaction.relation,reaction.statistics,thanks_count,favorite_count,visited_count&offset=0&limit=10&sort_by=${answersSortBy.value}`
      : nextPageUrl.value

    if (!url) {
      isAnswersLoading.value = false
      return
    }

    window.postMessage(
      {
        type: 'ZHIHU_PROXY_FETCH',
        requestId,
        url,
        method: 'GET',
      },
      '*',
    )
  }

  /**
   * 触发加载下一页回答（供无限滚动调用）
   */
  const loadMoreAnswers = () => {
    if (
      isAnswersLoading.value ||
      isEnd.value ||
      !nextPageUrl.value ||
      mode.value === 'single_answer'
    )
      return
    fetchAnswersList(false)
  }

  /**
   * 从单回答模式一键切换到全部回答模式
   */
  const viewAllAnswers = () => {
    window.location.href = `/question/${questionId.value}`
  }

  /**
   * 切换回答排序并重新拉取
   */
  const changeAnswersSortBy = (sort: 'default' | 'updated') => {
    if (answersSortBy.value === sort) return
    answersSortBy.value = sort
    
    // 清空基于 SSR 的预加载数据，确保从 API 纯净拉取新排序数据
    if (mode.value === 'all_answers') {
      rawAnswersList.value = []
    }
    fetchAnswersList(true)
  }

  /**
   * 监听并分发处理来自 MAIN World 的代理网络请求响应
   */
  const handleProxyResponse = (event: MessageEvent) => {
    if (!event.data) return
    const { type, requestId, data, error } = event.data

    if (!requestId) return

    // 处理问题详情响应
    if (String(requestId).startsWith(`question_info_${questionId.value}`)) {
      isQuestionLoading.value = false
      if (type === MESSAGE_TYPE_SUCCESS) {
        questionInfo.value = mapQuestionToSnakeCase(data)
      } else if (type === MESSAGE_TYPE_ERROR) {
        console.error('[useQuestion] 代理拉取问题详情失败:', error)
      }
    }

    // 处理单回答详情响应
    if (String(requestId).startsWith(`single_answer_${answerId.value}`)) {
      isSingleAnswerLoading.value = false
      if (type === MESSAGE_TYPE_SUCCESS) {
        singleAnswer.value = mapAnswerToSnakeCase(data)
      } else if (type === MESSAGE_TYPE_ERROR) {
        console.error('[useQuestion] 代理拉取单回答详情失败:', error)
      }
    }

    // 3. 处理多回答列表响应
    if (String(requestId).startsWith(`question_answers_${questionId.value}`)) {
      isAnswersLoading.value = false
      if (type === MESSAGE_TYPE_SUCCESS && data && Array.isArray(data.data)) {
        const answers = data.data
          .map((ans: any) => mapAnswerToSnakeCase(ans))
          .filter(Boolean)
        const wrappedItems = answers.map((ans: any) => ({
          id: String(ans.id),
          type: 'answer_result',
          target: ans,
        }))

        const isFirst = requestId.includes('_first_')
        if (isFirst) {
          rawAnswersList.value = wrappedItems
        } else {
          // 去重合并
          const existingIds = new Set(rawAnswersList.value.map((item) => item.id))
          const newItems = wrappedItems.filter(
            (item: any) => !existingIds.has(item.id),
          )
          rawAnswersList.value = [...rawAnswersList.value, ...newItems]
        }

        // 解析分页
        if (data.paging) {
          isEnd.value = data.paging.is_end || false
          if (data.paging.next) {
            let nextUrl = data.paging.next
            // 避免跨域并映射为正常代理端点
            if (nextUrl.includes('api.zhihu.com')) {
              nextUrl = nextUrl.replace(/^https?:\/\/api\.zhihu\.com/, '')
            }
            nextPageUrl.value = nextUrl
          } else {
            nextPageUrl.value = null
          }
        }
      } else if (type === MESSAGE_TYPE_ERROR) {
        console.error('[useQuestion] 代理拉取回答列表失败:', error)
      }
    }
  }

  /**
   * 初始化入口
   */
  const initData = () => {
    parseRoute()

    // 重置所有状态，防止上一个问题的内容闪烁
    questionInfo.value = null
    singleAnswer.value = null
    rawAnswersList.value = []
    nextPageUrl.value = null
    isEnd.value = false

    // 首先尝试从 DOM 进行 SSR 嗅探
    const successSSR = loadFromSSR()

    // 如果 SSR 嗅探没有获取到核心数据，或者我们需要更多的数据
    if (!successSSR || !questionInfo.value) {
      fetchQuestionDetail()
    }

    if (mode.value === 'single_answer') {
      if (!singleAnswer.value) {
        fetchSingleAnswer()
      }
    } else {
      if (rawAnswersList.value.length === 0) {
        fetchAnswersList(true)
      }
    }
  }

  onMounted(() => {
    loadSettings()
    chrome.storage.onChanged.addListener(handleStorageChange)
    window.addEventListener('message', handleProxyResponse)
    initData()
  })

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(handleStorageChange)
    window.removeEventListener('message', handleProxyResponse)
  })

  return {
    questionId,
    answerId,
    mode,
    questionInfo,
    singleAnswer,
    answersList,
    isQuestionLoading,
    isAnswersLoading,
    isSingleAnswerLoading,
    loadMoreAnswers,
    viewAllAnswers,
    answersSortBy,
    changeAnswersSortBy,
    refresh: initData,
  }
}
