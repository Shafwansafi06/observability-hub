import * as React from "react"
import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { ChevronRight, ChevronDown, Play } from "lucide-react"
import { ParticleTextEffect } from "@/components/ui/particle-text-effect"
import { Button } from "@/components/ui/button"

interface HeroSectionAppleProps extends React.HTMLAttributes<HTMLDivElement> {
  badge?: string
  title?: string
  highlightedTitle?: string
  description?: string
  ctaText?: string
  ctaHref?: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
}

const FloatingOrb = ({ 
  className, 
  delay = 0,
  size = "lg"
}: { 
  className?: string
  delay?: number
  size?: "sm" | "md" | "lg" | "xl"
}) => {
  const sizeClasses = {
    sm: "w-32 h-32",
    md: "w-48 h-48",
    lg: "w-64 h-64",
    xl: "w-96 h-96"
  }
  
  return (
    <div 
      className={cn(
        "absolute rounded-full blur-3xl opacity-30 animate-float pointer-events-none",
        sizeClasses[size],
        className
      )}
      style={{ 
        animationDelay: `${delay}s`,
        animationDuration: "8s"
      }}
    />
  )
}

const GlowingLine = ({ className }: { className?: string }) => (
  <div className={cn(
    "absolute h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent",
    className
  )} />
)

export function HeroSectionApple({
  className,
  badge = "Datadog × Google Cloud Hackathon",
  title = "The future of",
  highlightedTitle = "AI Observability",
  description = "Monitor, detect anomalies, and debug your AI applications with comprehensive telemetry. Powered by Datadog and Google Cloud Vertex AI.",
  ctaText = "Start Observing",
  ctaHref = "/dashboard",
  secondaryCtaText = "Watch Demo",
  secondaryCtaHref = "#demo",
  ...props
}: HeroSectionAppleProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsLoaded(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect()
        setMousePosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height
        })
      }
    }
    
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  return (
    <div 
      ref={heroRef}
      className={cn("relative min-h-screen overflow-hidden bg-background", className)} 
      {...props}
    >
      {/* Particle Text Effect Background */}
      <div className="absolute inset-0 opacity-40">
        <ParticleTextEffect 
          words={["ObservAI", "Monitor", "Detect", "Debug", "Scale"]}
        />
      </div>

      {/* Animated gradient orbs */}
      <FloatingOrb 
        className="bg-primary -top-32 -left-32" 
        size="xl" 
        delay={0}
      />
      <FloatingOrb 
        className="bg-accent top-1/4 -right-24" 
        size="lg" 
        delay={2}
      />
      <FloatingOrb 
        className="bg-purple-500 bottom-1/4 left-1/4" 
        size="md" 
        delay={4}
      />
      <FloatingOrb 
        className="bg-blue-500 -bottom-32 right-1/3" 
        size="lg" 
        delay={1}
      />
      
      {/* Mouse-following gradient */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-20 pointer-events-none transition-all duration-1000 ease-out"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
          left: `calc(${mousePosition.x * 100}% - 300px)`,
          top: `calc(${mousePosition.y * 100}% - 300px)`,
        }}
      />

      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "100px 100px"
        }}
      />

      {/* Glowing lines */}
      <GlowingLine className="top-1/4 left-0 w-full" />
      <GlowingLine className="top-3/4 left-0 w-full" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pt-20">
        <div className="max-w-5xl mx-auto text-center">
          
          {/* Badge */}
          <div 
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full",
              "bg-card/40 backdrop-blur-xl border border-border/50",
              "transition-all duration-1000 ease-out",
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {badge}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Main Title */}
          <h1 
            className={cn(
              "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6",
              "transition-all duration-1000 delay-200 ease-out",
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <span className="text-foreground">{title}</span>
            <br />
            <span className="relative inline-block mt-2">
              <span className="relative z-10 bg-gradient-to-r from-primary via-purple-500 to-accent bg-clip-text text-transparent">
                {highlightedTitle}
              </span>
              {/* Animated underline */}
              <span 
                className={cn(
                  "absolute -bottom-2 left-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-accent rounded-full",
                  "transition-all duration-1000 delay-700 ease-out",
                  isLoaded ? "w-full" : "w-0"
                )}
              />
            </span>
          </h1>

          {/* Description */}
          <p 
            className={cn(
              "text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10",
              "transition-all duration-1000 delay-400 ease-out",
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            {description}
          </p>

          {/* CTA Buttons */}
          <div 
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-4",
              "transition-all duration-1000 delay-600 ease-out",
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            {/* Primary CTA with animated border */}
            <a href={ctaHref} className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-accent rounded-full blur opacity-70 group-hover:opacity-100 transition-opacity animate-pulse-glow" />
              <Button 
                size="xl" 
                className="relative bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 shadow-2xl shadow-primary/25"
              >
                {ctaText}
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>

            {/* Secondary CTA */}
            <a href={secondaryCtaHref}>
              <Button 
                variant="glass" 
                size="xl"
                className="rounded-full group"
              >
                <Play className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                {secondaryCtaText}
              </Button>
            </a>
          </div>

          {/* Stats row */}
          <div 
            className={cn(
              "flex flex-wrap items-center justify-center gap-8 mt-16",
              "transition-all duration-1000 delay-800 ease-out",
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            {[
              { value: "<100ms", label: "Detection" },
              { value: "99.9%", label: "Uptime" },
              { value: "1M+", label: "Events/sec" },
            ].map((stat, index) => (
              <div 
                key={stat.label}
                className="text-center px-6 py-3 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/30"
              >
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div 
          className={cn(
            "absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2",
            "transition-all duration-1000 delay-1000 ease-out",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="text-xs text-muted-foreground">Scroll to explore</span>
          <ChevronDown className="w-5 h-5 text-muted-foreground animate-bounce" />
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
  )
}
