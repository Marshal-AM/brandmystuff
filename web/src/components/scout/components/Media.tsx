"use client";
import type { ArtKind } from '../data'
import { AdArt } from './AdArt'

/** The real close-up of an ad space when there is one, otherwise the reference illustration. */
export function Media({ src, art, className, alt = '' }: { src?: string | null; art: ArtKind; className?: string; alt?: string }) {
  if (!src) return <AdArt kind={art} className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} draggable={false} style={{ objectFit: 'cover', display: 'block' }} />
  )
}
