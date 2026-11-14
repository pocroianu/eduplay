import { HeroSection } from './HeroSection'
import { SocialProofBar } from './SocialProofBar'
import { AudienceSplit } from './AudienceSplit'
import { TrustSection } from './TrustSection'
import { CTABanner } from './CTABanner'
import { LandingFooter } from './LandingFooter'

export function HomePage() {
  return (
    <main>
      <HeroSection />
      <SocialProofBar />
      <AudienceSplit />
      <TrustSection />
      <CTABanner />
      <LandingFooter />
    </main>
  )
}
