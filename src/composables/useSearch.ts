import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isYanxuanContent } from '@/utils/yanxuan'
import { useBlocklist } from '@/composables/useBlocklist'

const MESSAGE_TYPE_SUCCESS = 'ZHIHU_PROXY_FETCH_SUCCESS'
const MESSAGE_TYPE_ERROR = 'ZHIHU_PROXY_FETCH_ERROR'

export function useSearch() {
  const rawSearchList = ref<any[]>([])
  const isLoading = ref(false)
  const currentQuery = ref('')
  const nextPageUrl = ref<string | null>(null)

  const isHideYanxuanEnabled = ref(true)

  const { filterList } = useBlocklist()

  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get('hideYanxuan')
      isHideYanxuanEnabled.value = result.hideYanxuan !== false
    } catch (e) {
      console.error('[useSearch] 读取存储失败:', e)
    }
  }

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'local' && changes.hideYanxuan) {
      isHideYanxuanEnabled.value = changes.hideYanxuan.newValue !== false
    }
  }

  const searchList = computed(() => {
    let list = rawSearchList.value
    
    if (isHideYanxuanEnabled.value) {
      list = list.filter(item => !isYanxuanContent(item.target))
    }
    
    return filterList(list)
  })

  // 内部监听器
  const handleProxyResponse = (event: MessageEvent) => {
    if (!event.data) return

    // 我们只处理带有 search_ 前缀的响应
    if (
      event.data.requestId &&
      String(event.data.requestId).startsWith('search_')
    ) {
      if (event.data.type === MESSAGE_TYPE_SUCCESS) {
        const payload = event.data.data
        if (payload && payload.data) {
          // 将搜索结果的 object 结构映射为 ArticleCard/AnswerCard 兼容的 target 结构
          const items = payload.data
            .filter(
              (item: any) =>
                item &&
                item.object &&
                (item.object.type === 'answer' ||
                  item.object.type === 'article'),
            )
            .map((item: any) => {
              return {
                id: item.id || `search-${item.object.type}-${item.object.id}`,
                type: 'search_result',
                target: item.object,
              }
            })

          // 如果是第一页，直接覆盖，否则追加
          const isFirstPage = event.data.requestId.includes('_first')
          if (isFirstPage) {
            rawSearchList.value = items
          } else {
            // 去重合并
            const existingIds = new Set(rawSearchList.value.map((i) => i.id))
            const newItems = items.filter(
              (item: any) => !existingIds.has(item.id),
            )
            rawSearchList.value = [...rawSearchList.value, ...newItems]
          }

          if (
            payload.paging &&
            payload.paging.is_end === false &&
            payload.paging.next
          ) {
            let nextUrl = payload.paging.next
            // 知乎返回的 next 链接可能是跨域的 api.zhihu.com，这在我们的代理 fetch 中会触发 CORS
            // 需要将其替换为相对路径的 /api/v4/search_v3，与首页请求保持一致
            if (nextUrl.includes('api.zhihu.com/search_v3')) {
              nextUrl = nextUrl.replace(
                /^https?:\/\/api\.zhihu\.com\/search_v3/,
                '/api/v4/search_v3',
              )
            }
            nextPageUrl.value = nextUrl
          } else {
            nextPageUrl.value = null
          }
        }
        isLoading.value = false
      } else if (event.data.type === MESSAGE_TYPE_ERROR) {
        console.error('[useSearch] 搜索请求失败:', event.data.error)
        isLoading.value = false
      }
    }
  }

  const doSearch = (query: string) => {
    if (!query) return
    currentQuery.value = query
    isLoading.value = true
    rawSearchList.value = []
    nextPageUrl.value = null

    const requestId = 'search_' + Date.now() + '_first'
    const url = `/api/v4/search_v3?t=general&q=${encodeURIComponent(query)}&correction=1&offset=0&limit=20`

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

  const loadMore = () => {
    if (isLoading.value || !nextPageUrl.value) return

    isLoading.value = true
    const requestId = 'search_' + Date.now() + '_more'

    window.postMessage(
      {
        type: 'ZHIHU_PROXY_FETCH',
        requestId,
        url: nextPageUrl.value,
        method: 'GET',
      },
      '*',
    )
  }

  onMounted(() => {
    loadSettings()
    chrome.storage.onChanged.addListener(handleStorageChange)
    window.addEventListener('message', handleProxyResponse)
  })

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(handleStorageChange)
    window.removeEventListener('message', handleProxyResponse)
  })

  return {
    searchList,
    isLoading,
    currentQuery,
    doSearch,
    loadMore,
  }
}
