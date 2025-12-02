import { HeroSection } from "@/components/blocks/hero-section-dark";
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
        <HeroSection
          title="Datadog x Google Cloud Hackathon"
          subtitle={{
            regular: "End-to-end LLM observability with ",
            gradient: "ObservAI",
          }}
          description="Monitor, detect anomalies, and debug your AI applications with comprehensive telemetry. Powered by Datadog and Google Cloud Vertex AI."
          ctaText="Explore Dashboard"
          ctaHref="/dashboard"
          secondaryCtaText="View Documentation"
          secondaryCtaHref="#features"
          bottomImage={{
            light: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&h=900&fit=crop",
            dark: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&h=900&fit=crop",
          }}
          gridOptions={{
            angle: 65,
            opacity: 0.3,
            cellSize: 50,
            lightLineColor: "hsl(262, 83%, 58%, 0.15)",
            darkLineColor: "hsl(262, 83%, 65%, 0.2)",
          }}
        />

        <Stats />
        <Features />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}
