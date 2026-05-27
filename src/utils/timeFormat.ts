/**
 * 格式化时间戳为 YYYY-MM-DD HH:mm:ss，若是今年则省略 YYYY-
 * @param timestamp 秒级或毫秒级时间戳
 */
export function formatPublishTime(timestamp: number): string {
  if (!timestamp) return ''
  // 兼容秒级和毫秒级
  const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp)
  const now = new Date()

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  const timeStr = `${hours}:${minutes}:${seconds}`
  const dateStr = `${month}-${day}`

  if (year === now.getFullYear()) {
    return `${dateStr} ${timeStr}`
  } else {
    return `${year}-${dateStr} ${timeStr}`
  }
}
