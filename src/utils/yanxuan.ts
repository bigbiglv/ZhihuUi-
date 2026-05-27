export function isYanxuanContent(target: any): boolean {
  if (!target) return false

  const labelType = target.label_info?.type?.toLowerCase() || ''
  const labelText = target.label_info?.text?.toLowerCase() || ''
  
  // 作者信息有多种嵌套可能
  let authorName = ''
  if (target.author) {
    if (typeof target.author === 'object') {
      authorName = target.author.name || target.author.member?.name || ''
    } else if (typeof target.author === 'string') {
      authorName = target.author // 有时候直接是字符串
    }
  }

  const url = target.url || ''

  if (
    labelType.includes('yanxuan') ||
    labelText.includes('盐选') ||
    authorName.includes('盐选') ||
    (url && url.includes('/market/')) ||
    target.paid_info !== undefined ||
    target.type === 'column_yanxuan'
  ) {
    return true
  }

  return false
}
