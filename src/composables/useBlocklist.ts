import { ref, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'blocklistKeywords'

export function useBlocklist() {
  const blocklistKeywords = ref<string[]>([])
  const isHideBlockedWordsEnabled = ref(true)

  const loadKeywords = async () => {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY, 'hideBlockedWords'])
      
      // 默认开启过滤
      isHideBlockedWordsEnabled.value = result.hideBlockedWords !== false

      if (result[STORAGE_KEY] && Array.isArray(result[STORAGE_KEY])) {
        blocklistKeywords.value = result[STORAGE_KEY]
      }
    } catch (error) {
      console.error('[useBlocklist] 读取存储失败:', error)
    }
  }

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'local') {
      if (changes[STORAGE_KEY]) {
        const newVal = changes[STORAGE_KEY].newValue
        blocklistKeywords.value = Array.isArray(newVal) ? newVal : []
      }
      if (changes.hideBlockedWords) {
        isHideBlockedWordsEnabled.value = changes.hideBlockedWords.newValue !== false
      }
    }
  }

  onMounted(() => {
    loadKeywords()
    chrome.storage.onChanged.addListener(handleStorageChange)
  })

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(handleStorageChange)
  })

  // 通用的列表过滤逻辑
  const filterList = (list: any[]) => {
    // 如果开关被关闭，或者没有设置任何屏蔽词，则直接返回原始列表
    if (!isHideBlockedWordsEnabled.value || blocklistKeywords.value.length === 0) {
      return list
    }

    return list.filter(item => {
      let title = ''
      if (item.target?.type === 'answer') {
        title = item.target?.question?.title || ''
      } else if (item.target?.type === 'article') {
        title = item.target?.title || ''
      }

      if (!title) return true // 没有提取到标题的卡片默认放行

      const lowerTitle = title.toLowerCase()
      // 判断是否触发屏蔽词
      const isBlocked = blocklistKeywords.value.some(k => lowerTitle.includes(k.toLowerCase()))
      
      return !isBlocked
    })
  }

  return {
    filterList
  }
}
