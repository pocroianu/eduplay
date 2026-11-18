'use client'

import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { staggerContainer, staggerItem } from '@/config/animations'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'

const proofItems = [
  { key: 'ro', icon: 'MapPin' as IconName, tone: 'bg-purple-soft text-purple-deep' },
  { key: 'euHosting', icon: 'HardDrives' as IconName, tone: 'bg-primary-soft text-primary-deep' },
  { key: 'noAds', icon: 'Prohibit' as IconName, tone: 'bg-pink-soft text-pink-deep' },
  { key: 'diacritics', icon: 'BookOpen' as IconName, tone: 'bg-gold-soft text-gold-deep' },
] as const

export function SocialProofBar() {
  const { t } = useTranslation('landing')

  return (
    <section className="bg-surface-container-lowest">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: '-50px' }}
        className="mx-auto max-w-7xl px-6 py-10 lg:px-10"
      >
        <div className="rounded-xl bg-surface-container-lowest shadow-soft">
          <div className="grid grid-cols-1 divide-y divide-outline-variant lg:grid-cols-12 lg:divide-x lg:divide-y-0">
            <motion.div variants={staggerItem} className="p-6 text-center lg:col-span-3 lg:text-left">
              <div className="text-xl font-bold leading-tight text-purple-deep">
                {t('socialProof.headline')}
              </div>
              <p className="mt-2 text-base font-semibold text-on-surface">
                {t('socialProof.title')}
              </p>
            </motion.div>

            <div className="grid gap-0 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-4">
              {proofItems.map((item) => (
                <motion.div
                  key={item.key}
                  variants={staggerItem}
                  className="flex min-h-36 flex-col items-center justify-center px-5 py-6 text-center"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${item.tone}`}>
                    <Icon
                      name={item.icon}
                      weight="fill"
                      size="lg"
                      aria-hidden
                    />
                  </div>
                  <div className="mt-4 text-lg font-bold text-on-surface">
                    {t(`socialProof.stickers.${item.key}.short`)}
                  </div>
                  <div className="mt-1 max-w-36 text-sm font-semibold leading-snug text-on-surface-variant">
                    {t(`socialProof.stickers.${item.key}.label`)}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
