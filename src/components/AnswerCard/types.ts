export interface Author {
  id: string
  name: string
  avatar_url: string
  headline?: string
  type: string
  member?: any
}

export interface Question {
  id: number
  type: string
  title: string
}

export interface Target {
  id: number
  type: 'answer' | 'article' | 'pin' | string
  excerpt: string
  content: string
  voteup_count?: number
  vote_count?: number
  comment_count: number
  created_time?: number
  updated_time?: number
  votedown_count?: number
  favorite_count?: number
  thanks_count?: number
  visited_count?: number
  relationship?: {
    is_thanked?: boolean
    is_nothelp?: boolean
    voting?: number
  }
  reaction?: {
    relation?: {
      liked?: boolean
      faved?: boolean
    }
  }
  author: Author
  question?: Question
  title?: string
}

export interface FeedItem {
  id: string
  type: string
  target: Target
}

export interface ChildComment {
  id: number
  type: string
  content: string
  created_time: number
  vote_count: number
  author: {
    name: string
    avatar_url: string
    headline?: string
    member?: any
  }
  reply_to_author?: {
    member?: {
      name: string
      id: string
    }
  }
  comment_tag?: { type: string; text: string }[]
  like_count?: number
  address_text?: string
  featured?: boolean
  is_featured?: boolean
  hot?: boolean
  is_hot?: boolean
  voting?: boolean
  isDownvoted?: boolean
}

export interface RootComment {
  id: number
  type: string
  content: string
  created_time: number
  vote_count: number
  author: {
    name: string
    avatar_url: string
    headline?: string
    member?: any
  }
  child_comment_count: number
  childComments?: ChildComment[]
  comment_tag?: { type: string; text: string }[]
  like_count?: number
  address_text?: string
  featured?: boolean
  is_featured?: boolean
  hot?: boolean
  is_hot?: boolean
  isChildLoading?: boolean
  isChildExpanded?: boolean
  childCommentsNextUrl?: string | null
  isChildLoadingMore?: boolean
  isChildEnd?: boolean
  voting?: boolean
  isDownvoted?: boolean
}
