import { HeroSectionApple } from "@/components/blocks/hero-section-apple";
import { Features } from "@/components/landing/Features";
import { Stats } from "@/components/landing/Stats";
import { CTA } from "@/components/landing/CTA";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

interface IndexProps {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}

export default function Index({ theme, setTheme }: IndexProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar theme={theme} setTheme={setTheme} />
      
      <main>
        <HeroSectionApple
          badge="Datadog × Google Cloud Hackathon 2024"
          title="The future of"
          highlightedTitle="AI Observability"
          description="End-to-end LLM monitoring with deep telemetry, anomaly detection, and automated incident management. Built for the next generation of AI engineers."
          ctaText="Explore Dashboard"
          ctaHref="/dashboard"
          secondaryCtaText="Read Docs"
          secondaryCtaHref="/docs"
        />

        <Features />
        <Stats />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}
