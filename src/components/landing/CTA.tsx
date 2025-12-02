import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 gradient-glow" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
          Ready to observe your{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">AI applications?</span>
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Get started with ObservAI in minutes. Open source, cloud-native, 
          and built for the next generation of AI engineers.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="glow" size="xl" asChild>
            <Link to="/dashboard">
              Start Observing
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button variant="outline" size="xl" asChild>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-5 w-5" />
              View on GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
