import v from './videos.generated.json'

export type Film = { mp4: string; webm?: string; mp4Small?: string; poster: string; duration?: number }

export const films = v as Partial<Record<'home' | 'aegealis' | 'theodora' | 'cruises', Film>>
