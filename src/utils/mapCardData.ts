export interface CardAuthor {
  id: string
  name: string
  avatar_url: string
  headline?: string
  type: string
  url_token?: string
}

export interface CardQuestion {
  id: string | number
  title: string
}

export interface StandardCardData {
  id: string | number
  type: 'answer' | 'article' | string
  feedId?: string | number
  feedType?: string
  title?: string
  content: string
  excerpt: string
  createdTime?: number
  updatedTime?: number
  
  author: CardAuthor
  question?: CardQuestion
  
  voteupCount?: number
  votedownCount?: number
  favoriteCount?: number
  thanksCount?: number
  visitCount?: number
  commentCount?: number

  isUpvoted: boolean
  isDownvoted: boolean
  isFavorited: boolean
  isLiked: boolean
}

export function mapToStandardCardData(raw: any): StandardCardData {
  // 支持外层包裹 target 或直接传入 target 本身
  const isWrapped = !!raw.target
  const target = isWrapped ? raw.target : raw
  
  const type = target.type || 'answer'
  const feedId = isWrapped ? raw.id : undefined
  const feedType = isWrapped ? raw.type : undefined
  
  // 提取作者信息，兼容各种嵌套格式
  const authorRef = target.author || {}
  const member = authorRef.member || {}
  
  const author: CardAuthor = {
    id: authorRef.id || member.id || '',
    name: member.name || authorRef.name || '匿名用户',
    avatar_url: member.avatar_url || authorRef.avatar_url || authorRef.avatarUrl || 'https://pic1.zhimg.com/v2-ab422a7e109859907ea9fc553da9d852_l.jpg',
    headline: member.headline || authorRef.headline || '',
    type: member.type || authorRef.type || 'people',
    url_token: member.url_token || member.urlToken || authorRef.url_token || authorRef.urlToken || authorRef.id || '',
  }
  
  const question = target.question ? {
    id: target.question.id || target.questionId,
    title: target.question.title
  } : undefined

  // 安全提取交互与关系字段
  const relationship = target.relationship || {}
  const reaction = target.reaction || {}
  const relation = reaction.relation || {}
  const statistics = reaction.statistics || {}

  return {
    id: target.id,
    type,
    feedId,
    feedType,
    title: target.title,
    content: target.content || '',
    excerpt: target.excerpt || target.excerpt_new || '',
    createdTime: target.created_time || target.created || 0,
    updatedTime: target.updated_time || target.updated || 0,
    author,
    question,
    
    // 兼容数量读取
    voteupCount: target.voteup_count ?? target.voteupCount ?? 0,
    votedownCount: target.votedown_count ?? target.votedownCount ?? 0,
    favoriteCount: target.favorite_count ?? statistics?.favorites,
    thanksCount: target.thanks_count ?? statistics?.like_count,
    visitCount: target.visited_count ?? target.visit_count ?? target.visitCount,
    commentCount: target.comment_count ?? target.commentCount ?? 0,

    // 兼容状态读取
    isUpvoted: relationship.voting === 1 || relation.liked === true,
    isDownvoted: relationship.voting === -1 || relationship.is_nothelp === true,
    isFavorited: relation.faved === true,
    isLiked: relationship.is_thanked === true,
  }
}
