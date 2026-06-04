// src/utils/seenTracker.ts - 用于在本地持久化跟踪已读/已曝光内容卡片以进行主页排重过滤
const SEEN_IDS_KEY = 'seenCardIds'
const MAX_SEEN_IDS = 1000

let seenIdsSet = new Set<string>()
let seenIdsQueue: string[] = []
let isInitialized = false

const initPromise = init()

async function init() {
  if (isInitialized) return
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(SEEN_IDS_KEY)
      const list = result[SEEN_IDS_KEY]
      if (Array.isArray(list)) {
        seenIdsQueue = list
        seenIdsSet = new Set(list)
      }
    }
  } catch (e) {
    console.error('[seenTracker] 加载已曝光记录失败:', e)
  }
  isInitialized = true
}

/**
 * 异步获取所有已读/已曝光 ID 的 Set
 */
export async function getSeenIds(): Promise<Set<string>> {
  await initPromise
  return seenIdsSet
}

/**
 * 同步检查某个 ID 是否已被曝光/阅读 (要求已初始化完成)
 */
export function hasSeen(id: string): boolean {
  return seenIdsSet.has(id)
}

/**
 * 记录一个新的曝光/已读 ID 并保存到 Chrome Storage
 */
export async function addSeenId(id: string) {
  if (!id) return
  await initPromise
  if (seenIdsSet.has(id)) return

  console.log('[Seen Tracker] 卡片在视口停留满 1s，记录本地曝光已读:', id)

  seenIdsSet.add(id)
  seenIdsQueue.push(id)

  // 超过上限则移除最早的记录 (FIFO)
  if (seenIdsQueue.length > MAX_SEEN_IDS) {
    const oldId = seenIdsQueue.shift()
    if (oldId) {
      seenIdsSet.delete(oldId)
    }
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [SEEN_IDS_KEY]: seenIdsQueue })
    }
  } catch (e) {
    console.error('[seenTracker] 保存曝光记录失败:', e)
  }
}
