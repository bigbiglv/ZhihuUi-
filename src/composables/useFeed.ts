import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isYanxuanContent } from '@/utils/yanxuan'
import { useBlocklist } from '@/composables/useBlocklist'
import { getSeenIds, hasSeen } from '@/utils/seenTracker'

const MESSAGE_TYPE = 'ZHIHU_FEED_INTERCEPTED'

export function useFeed() {
  const rawRecommendList = ref<any[]>([])
  const isLoading = ref(false)
  const isHideYanxuanEnabled = ref(true)

  const { filterList } = useBlocklist()

  // 从 Chrome Storage 读取状态
  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get('hideYanxuan')
      isHideYanxuanEnabled.value = result.hideYanxuan !== false
    } catch (error) {
      console.error('[useFeed] 读取存储失败:', error)
    }
  }

  // 监听 Storage 变化
  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'local') {
      if (changes.hideYanxuan) {
        isHideYanxuanEnabled.value = changes.hideYanxuan.newValue !== false
      }
    }
  }

  // 计算属性：根据屏蔽词过滤后的干净数据列表
  const recommendList = computed(() => {
    let list = rawRecommendList.value

    if (isHideYanxuanEnabled.value) {
      list = list.filter(item => !isYanxuanContent(item.target))
    }

    return filterList(list)
  })

  /**
   * 核心数据处理：从 postMessage 中解析推荐流数据并追加到列表
   */
  const handleMessage = async (event: MessageEvent) => {
    if (!event.data || event.data.type !== MESSAGE_TYPE) return

    const responsePayload = event.data.data
    if (!responsePayload || !Array.isArray(responsePayload.data)) {
      console.warn('[useFeed] 数据格式不符合预期:', responsePayload)
      return
    }

    // 确保 seenTracker 已经初始化加载完成
    await getSeenIds()

    // 过滤出有效的内容卡片
    const items = responsePayload.data.filter(
      (item: any) => item && item.target,
    )

    if (items.length > 0) {
      // 去重与已浏览内容过滤合并
      const existingIds = new Set(rawRecommendList.value.map((i) => i.id))
      const newItems = items.filter((item: any) => {
        const safeId = item.id || `${item.target.type}-${item.target.id}`
        item.id = safeId
        return !existingIds.has(safeId) && !hasSeen(safeId)
      })

      if (newItems.length > 0) {
        rawRecommendList.value = [...rawRecommendList.value, ...newItems]
      }
    }

    // 延迟释放加载锁（给 Vue DOM 更新留缓冲时间）
    setTimeout(() => {
      isLoading.value = false
    }, 300)
  }

  /**
   * 触底加载下一页：向 MAIN World 发送加载指令
   * inject.ts 会使用缓存的 paging.next URL 直接发起请求
   */
  const loadMore = () => {
    if (isLoading.value) return

    isLoading.value = true

    // 向 MAIN World 的 inject.ts 发送翻页指令
    window.postMessage({ type: 'ZHIHU_LOAD_MORE' }, '*')

    // 安全兜底：5 秒后强制释放锁（给网络请求留足时间）
    setTimeout(() => {
      if (isLoading.value) {
        console.warn('[useFeed] 5 秒超时，强制释放加载锁')
        isLoading.value = false
      }
    }, 5000)
  }

  onMounted(async () => {
    await getSeenIds()
    loadSettings()
    chrome.storage.onChanged.addListener(handleStorageChange)
    window.addEventListener('message', handleMessage)

    // 冷启动保底
    setTimeout(() => {
      if (rawRecommendList.value.length === 0) {
        loadMore()
      }
    }, 1500)
  })

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(handleStorageChange)
    window.removeEventListener('message', handleMessage)
  })

  return {
    recommendList,
    isLoading,
    loadMore,
  }
}
