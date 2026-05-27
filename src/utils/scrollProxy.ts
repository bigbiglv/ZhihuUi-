/**
 * 触底模拟滚动与点击代理
 * 精准欺骗原页面隐藏的 #root 节点中的主信息流，并自动处理可能出现的“加载更多”按钮
 */
export const triggerOriginalPageScroll = () => {
  // 触发全局滚动事件（知乎主 window 侦听器）
  window.dispatchEvent(new Event('scroll'))
  document.dispatchEvent(new Event('scroll'))

  const root = document.getElementById('root')
  if (!root) {
    console.warn('[ScrollProxy] 未找到原网页 #root 节点')
    return
  }

  // 精准寻找知乎主内容列（不盲目滚动评论区等 48 个无关节点，防 React 状态崩溃）
  const mainColumn =
    root.querySelector('.Topstory-mainColumn') ||
    root.querySelector('.Card') ||
    root.querySelector('[role="list"]')

  if (mainColumn) {
    // 模拟向上微调再向下猛滚，产生位移差以唤醒 IntersectionObserver
    mainColumn.dispatchEvent(new Event('scroll', { bubbles: true }))

    // 如果主容器是具有实际滚动属性的元素，进行极小幅度的模拟位移
    if (mainColumn.scrollHeight > mainColumn.clientHeight) {
      mainColumn.scrollTop = mainColumn.scrollHeight - 100
      setTimeout(() => {
        mainColumn.scrollTop = mainColumn.scrollHeight
        mainColumn.dispatchEvent(new Event('scroll', { bubbles: true }))
      }, 50)
    }
  }

  // 3. 自动探测并模拟点击知乎非登录状态或滚动受限时弹出的“点击加载更多”按钮
  //    知乎常见的加载更多按钮类名：Topstory-lookMore, QuestionAnswers-nextBtn 等
  const moreButton =
    (root.querySelector('button.Topstory-lookMore') as HTMLButtonElement) ||
    (root.querySelector(
      'button.QuestionAnswers-nextBtn',
    ) as HTMLButtonElement) ||
    (root.querySelector('.Topstory-mainColumn button') as HTMLButtonElement) ||
    (root.querySelector('[role="list"] + button') as HTMLButtonElement)

  if (moreButton && typeof moreButton.click === 'function') {
    try {
      moreButton.click()
    } catch (e) {
      console.error('[ScrollProxy] 模拟点击失败:', e)
    }
  }
}
