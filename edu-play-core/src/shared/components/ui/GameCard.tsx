'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { cardHover, cardTap, thumbnailZoom } from '@/config/animations'
import { Card } from './kit'
import { Icon } from './Icon'

interface GameCardProps {
  id: string
  title: string
  category?: string
  thumbnailUrl?: string | null
  bgColorClass?: string
}

export function GameCard({ id, title, category, thumbnailUrl, bgColorClass = 'bg-surface-container' }: GameCardProps) {
  return (
    <motion.div
      variants={{ ...cardHover, ...cardTap }}
      whileHover="hover"
      whileTap="tap"
    >
      <Link href={`/games/${id}`} className="block focus-visible:outline-3 focus-visible:outline-blue focus-visible:outline-offset-2">
        <Card className="flex cursor-pointer flex-col items-center text-center" padding="sm">
          <div className={`relative mb-4 aspect-square w-full overflow-hidden rounded-md ${bgColorClass}`}>
            {thumbnailUrl ? (
              <motion.div variants={thumbnailZoom} className="relative h-full w-full">
                <Image
                  src={thumbnailUrl}
                  alt={title}
                  fill
                  className="object-cover"
                />
              </motion.div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary">
                <Icon name="GameController" size="xl" weight="bold" aria-hidden />
              </div>
            )}
          </div>
          <h3 className="text-lg font-bold text-on-surface">{title}</h3>
          {category && (
            <span className="mt-1 text-xs text-on-surface-variant">{category}</span>
          )}
        </Card>
      </Link>
    </motion.div>
  )
}
