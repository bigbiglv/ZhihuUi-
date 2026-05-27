const updateIcon = (tabId: number) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      // 忽略已关闭或无效的标签页报错
      return
    }
    
    // 由于我们在 manifest 中配置了 zhihu.com 的 host_permissions，
    // 所以当我们获取知乎的标签页时，可以读取到 tab.url。
    // 如果是非知乎标签页，tab.url 会是 undefined。
    const cb = () => {
      if (chrome.runtime.lastError) {
        // 消耗掉 lastError 避免报警
      }
    }
    
    if (tab && tab.url && tab.url.includes('zhihu.com')) {
      chrome.action.setIcon({ tabId, path: 'icon-on.png' }, cb)
      chrome.action.setPopup({ tabId, popup: 'src/popup/index.html' }, cb)
    } else {
      chrome.action.setIcon({ tabId, path: 'icon-off.png' }, cb)
      chrome.action.setPopup({ tabId, popup: '' }, cb)
    }
  })
}

// 监听标签页更新（如刷新、跳转）
chrome.tabs.onUpdated.addListener((tabId) => {
  updateIcon(tabId)
})

// 监听标签页切换
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateIcon(activeInfo.tabId)
})

// 安装或更新扩展时，初始化所有已有标签页的状态
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) updateIcon(tab.id)
    })
  })
})
