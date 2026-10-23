import media from './media.generated.json'
import type { Photo } from './types'

type Group = { cover: Photo; photos: Photo[] }
type CruiseMedia = { hero: Photo | null; groups: Record<string, Group>; video?: { mp4: string; webm?: string; poster: string } }

const generated = (media as unknown as { cruises: CruiseMedia }).cruises

/**
 * Hand-picked changes on top of the generated media file (which stays untouched).
 * Private cruises: the close-up of two wine glasses showed nothing of the boat, so the cover is the group of friends
 * toasting on the NIRIIS saloon banquette (faces in the upper third), and the glasses move to the gallery.
 */
function withOverrides(m: CruiseMedia): CruiseMedia {
  const priv = m.groups.private
  const saloon = priv?.photos.find((p) => p.src.endsWith('/cruises-niriis-niriis-008.jpg'))
  if (!priv || !saloon) return m
  const cover: Photo = { ...saloon, focus: saloon.focus ?? '48% 30%' }
  return { ...m, groups: { ...m.groups, private: { cover, photos: [cover, ...priv.photos.filter((p) => p.src !== saloon.src)] } } }
}

export const cruiseMedia = withOverrides(generated)

export const historyPhotos = (cruiseMedia.groups.history?.photos ?? []) as Photo[]
