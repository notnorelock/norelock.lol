import { AboutSection } from '@/components/sections/AboutSection';
import { HeroSection } from '@/components/sections/HeroSection';
import { LinksSection } from '@/components/sections/LinksSection';
import { WorkSection } from '@/components/sections/WorkSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <AboutSection />
      <WorkSection />
      <LinksSection />
    </>
  );
}
