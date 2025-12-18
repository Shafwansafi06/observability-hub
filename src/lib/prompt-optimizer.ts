/**
 * Lyra - AI Prompt Optimization Assistant
 * Analyzes LLM metrics and provides intelligent prompt improvements
 * Integrated with Datadog observability data
 */

import { vertexAI, ModelType } from './vertex-ai/client';

export interface PromptAnalysis {
  originalPrompt: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latency: number;
  cost: number;
  response: string;
  // Quality metrics
  toxicityScore?: number;
  coherenceScore?: number;
  hallucination_risk?: number;
}

export interface OptimizationResult {
  optimizedPrompt: string;
  improvements: string[];
  techniquesApplied: string[];
  expectedImprovements: {
    tokenReduction?: string;
    clarityScore?: string;
    costSavings?: string;
  };
  proTip: string;
  complexity: 'simple' | 'complex';
}

export class PromptOptimizer {
  private mode: 'DETAIL' | 'BASIC';
  private targetAI: 'ChatGPT' | 'Claude' | 'Gemini' | 'Other';

  constructor(mode: 'DETAIL' | 'BASIC' = 'DETAIL', targetAI: 'Gemini' = 'Gemini') {
    this.mode = mode;
    this.targetAI = targetAI;
  }

  /**
   * Analyze prompt performance and suggest improvements
   */
  async optimizePrompt(analysis: PromptAnalysis): Promise<OptimizationResult> {
    const complexity = this.detectComplexity(analysis);
    const issues = this.diagnoseIssues(analysis);

    // Use Gemini Flash for faster, more reliable responses
    const model = ModelType.TEXT_FAST;

    const lyraPrompt = this.buildLyraPrompt(analysis, issues, complexity);

    try {
      // Add timeout and retry logic
      let retries = 2;
      let lastError: Error | null = null;

      while (retries > 0) {
        try {
          const response = await Promise.race([
            vertexAI.predict({
              prompt: lyraPrompt,
              model,
              temperature: 0.7,
              maxTokens: 2048,  // Reduced for faster, more reliable responses
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Optimization timeout')), 25000)
            )
          ]);

          // Validate response has content
          if (!response.text || response.text.trim().length < 50) {
            throw new Error('Incomplete optimization response');
          }

          return this.parseOptimizationResponse(response.text, analysis, issues, complexity);
        } catch (error: any) {
          lastError = error;
          retries--;
          
          if (retries > 0) {
            console.log(`Retrying optimization... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // All retries failed, use rule-based fallback
      console.warn('AI optimization failed, using rule-based fallback:', lastError);
      return this.ruleBasedOptimization(analysis, issues, complexity);
    } catch (error) {
      console.error('Optimization error:', error);
      // Fallback to rule-based optimization
      return this.ruleBasedOptimization(analysis, issues, complexity);
    }
  }

  /**
   * Detect prompt complexity based on metrics
   */
  private detectComplexity(analysis: PromptAnalysis): 'simple' | 'complex' {
    const indicators = {
      longPrompt: analysis.originalPrompt.length > 500,
      highTokenUsage: analysis.tokensIn > 1000,
      highLatency: analysis.latency > 3000,
      qualityIssues: (analysis.toxicityScore || 0) > 0.3 || 
                     (analysis.hallucination_risk || 0) > 0.5 ||
                     (analysis.coherenceScore || 1) < 0.7,
    };

    const complexityScore = Object.values(indicators).filter(Boolean).length;
    return complexityScore >= 2 ? 'complex' : 'simple';
  }

  /**
   * Diagnose issues with current prompt
   */
  private diagnoseIssues(analysis: PromptAnalysis): string[] {
    const issues: string[] = [];

    // Token efficiency
    if (analysis.tokensIn > 1000) {
      issues.push('excessive_tokens_in');
    }
    if (analysis.tokensOut > 2000) {
      issues.push('verbose_output');
    }

    // Cost efficiency
    if (analysis.cost > 0.01) {
      issues.push('high_cost');
    }

    // Performance
    if (analysis.latency > 5000) {
      issues.push('high_latency');
    }

    // Quality issues
    if ((analysis.toxicityScore || 0) > 0.3) {
      issues.push('toxicity_risk');
    }
    if ((analysis.hallucination_risk || 0) > 0.5) {
      issues.push('hallucination_risk');
    }
    if ((analysis.coherenceScore || 1) < 0.7) {
      issues.push('low_coherence');
    }

    // Prompt structure issues
    const prompt = analysis.originalPrompt.toLowerCase();
    if (!prompt.includes('?') && prompt.split(/\s+/).length < 10) {
      issues.push('vague_request');
    }
    if (prompt.length < 20) {
      issues.push('too_brief');
    }
    if (!this.hasStructure(analysis.originalPrompt)) {
      issues.push('unstructured');
    }

    return issues;
  }

  /**
   * Check if prompt has clear structure
   */
  private hasStructure(prompt: string): boolean {
    const structureIndicators = [
      /step \d+/i,
      /first|second|third|finally/i,
      /context:|task:|output:/i,
      /\d+\./,
      /- /,
    ];

    return structureIndicators.some(pattern => pattern.test(prompt));
  }

  /**
   * Build context for optimization
   */
  private buildOptimizationContext(analysis: PromptAnalysis, issues: string[]): string {
    const context = [
      `Original prompt generated ${analysis.tokensIn} input tokens and ${analysis.tokensOut} output tokens`,
      `Latency: ${analysis.latency}ms`,
      `Cost: $${analysis.cost.toFixed(6)}`,
      `Model used: ${analysis.model}`,
    ];

    if (issues.length > 0) {
      context.push(`Issues detected: ${issues.join(', ')}`);
    }

    return context.join('\n');
  }

  /**
   * Build Lyra's optimization prompt
   */
  private buildLyraPrompt(
    analysis: PromptAnalysis,
    issues: string[],
    complexity: 'simple' | 'complex'
  ): string {
    const systemContext = `You are Lyra, a master-level AI prompt optimization specialist. Your mission: transform any user input into precision-crafted prompts that unlock AI's full potential.

THE 4-D METHODOLOGY
1. DECONSTRUCT: Extract core intent, key entities, context, and output requirements
2. DIAGNOSE: Audit for clarity gaps, ambiguity, specificity, and completeness
3. DEVELOP: Select optimal techniques (Chain-of-thought, Few-shot, Multi-perspective, etc.)
4. DELIVER: Construct optimized prompt with implementation guidance

Target AI: ${this.targetAI}
Mode: ${this.mode}
Complexity: ${complexity}`;

    const performanceData = `
PERFORMANCE METRICS FROM DATADOG:
- Input Tokens: ${analysis.tokensIn} (${analysis.tokensIn > 1000 ? 'HIGH - optimize for brevity' : 'acceptable'})
- Output Tokens: ${analysis.tokensOut} (${analysis.tokensOut > 2000 ? 'HIGH - add output constraints' : 'acceptable'})
- Latency: ${analysis.latency}ms (${analysis.latency > 3000 ? 'SLOW - simplify prompt' : 'good'})
- Cost: $${analysis.cost.toFixed(6)} (${analysis.cost > 0.01 ? 'EXPENSIVE - optimize' : 'efficient'})
- Model: ${analysis.model}

QUALITY METRICS:
${analysis.toxicityScore ? `- Toxicity Score: ${analysis.toxicityScore.toFixed(2)} ${analysis.toxicityScore > 0.3 ? '⚠️ HIGH' : '✓'}` : ''}
${analysis.coherenceScore ? `- Coherence Score: ${analysis.coherenceScore.toFixed(2)} ${analysis.coherenceScore < 0.7 ? '⚠️ LOW' : '✓'}` : ''}
${analysis.hallucination_risk ? `- Hallucination Risk: ${analysis.hallucination_risk.toFixed(2)} ${analysis.hallucination_risk > 0.5 ? '⚠️ HIGH' : '✓'}` : ''}

DETECTED ISSUES: ${issues.length > 0 ? issues.join(', ') : 'None'}`;

    const optimizationRequest = `
ORIGINAL PROMPT:
"${analysis.originalPrompt}"

ORIGINAL RESPONSE PREVIEW:
"${analysis.response.substring(0, 200)}${analysis.response.length > 200 ? '...' : ''}"

YOUR TASK:
Optimize this prompt to:
${issues.includes('excessive_tokens_in') ? '✓ Reduce input tokens (currently too high)\n' : ''}${issues.includes('verbose_output') ? '✓ Add output length constraints\n' : ''}${issues.includes('high_cost') ? '✓ Improve cost efficiency\n' : ''}${issues.includes('high_latency') ? '✓ Simplify for faster response\n' : ''}${issues.includes('toxicity_risk') ? '✓ Add safety guardrails\n' : ''}${issues.includes('hallucination_risk') ? '✓ Add factual accuracy requirements\n' : ''}${issues.includes('low_coherence') ? '✓ Improve clarity and structure\n' : ''}${issues.includes('vague_request') ? '✓ Add specific requirements\n' : ''}${issues.includes('too_brief') ? '✓ Add context and details\n' : ''}${issues.includes('unstructured') ? '✓ Add clear structure\n' : ''}
✓ Maintain original intent
✓ Optimize for Gemini (supports long context, creative tasks, multi-modal)

RESPONSE FORMAT:
**Optimized Prompt:**
[Your improved prompt here]

**Key Improvements:**
• [List 3-5 specific improvements with metrics impact]

**Techniques Applied:**
[List techniques used: Chain-of-thought, Few-shot, Role assignment, etc.]

**Expected Impact:**
• Token reduction: X%
• Cost savings: $Y
• Clarity improvement: Z%

**Pro Tip:**
[One actionable tip for using this prompt]`;

    return `${systemContext}\n\n${performanceData}\n\n${optimizationRequest}`;
  }

  /**
   * Parse Lyra's response into structured format
   */
  private parseOptimizationResponse(
    response: string,
    analysis: PromptAnalysis,
    issues: string[],
    complexity: 'simple' | 'complex'
  ): OptimizationResult {
    // Extract sections from response
    const optimizedPromptMatch = response.match(/\*\*Optimized Prompt:\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
    const improvementsMatch = response.match(/\*\*Key Improvements:\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
    const techniquesMatch = response.match(/\*\*Techniques Applied:\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
    const impactMatch = response.match(/\*\*Expected Impact:\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
    const tipMatch = response.match(/\*\*Pro Tip:\*\*\s*([\s\S]*?)(?=\*\*|$)/i);

    const optimizedPrompt = optimizedPromptMatch?.[1]?.trim() || analysis.originalPrompt;
    
    const improvements = improvementsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
      .map(line => line.replace(/^[•\-]\s*/, '').trim())
      .filter(Boolean) || [];

    const techniquesApplied = techniquesMatch?.[1]
      ?.split(',')
      .map(t => t.trim())
      .filter(Boolean) || [];

    const proTip = tipMatch?.[1]?.trim() || 'Test the optimized prompt and compare results!';

    // Parse expected improvements
    const expectedImprovements: OptimizationResult['expectedImprovements'] = {};
    if (impactMatch) {
      const impactText = impactMatch[1];
      const tokenMatch = impactText.match(/token.*?(\d+)%/i);
      const costMatch = impactText.match(/cost.*?\$?([\d.]+)/i);
      const clarityMatch = impactText.match(/clarity.*?(\d+)%/i);

      if (tokenMatch) expectedImprovements.tokenReduction = `${tokenMatch[1]}%`;
      if (costMatch) expectedImprovements.costSavings = `$${costMatch[1]}`;
      if (clarityMatch) expectedImprovements.clarityScore = `${clarityMatch[1]}%`;
    }

    return {
      optimizedPrompt,
      improvements: improvements.length > 0 ? improvements : this.generateDefaultImprovements(issues),
      techniquesApplied: techniquesApplied.length > 0 ? techniquesApplied : ['Structural optimization', 'Context enhancement'],
      expectedImprovements,
      proTip,
      complexity,
    };
  }

  /**
   * Fallback rule-based optimization
   */
  private ruleBasedOptimization(
    analysis: PromptAnalysis,
    issues: string[],
    complexity: 'simple' | 'complex'
  ): OptimizationResult {
    let optimizedPrompt = analysis.originalPrompt;
    const improvements: string[] = [];
    const techniquesApplied: string[] = [];

    // Add role assignment if missing
    if (!optimizedPrompt.toLowerCase().includes('you are') && !optimizedPrompt.toLowerCase().includes('act as')) {
      optimizedPrompt = `You are an expert assistant. ${optimizedPrompt}`;
      improvements.push('Added expert role assignment for better context');
      techniquesApplied.push('Role assignment');
    }

    // Add output constraints if verbose
    if (issues.includes('verbose_output')) {
      optimizedPrompt += '\n\nProvide a concise response in 3-5 sentences maximum.';
      improvements.push('Added output length constraints to reduce tokens');
      techniquesApplied.push('Output formatting');
    }

    // Add structure if missing
    if (issues.includes('unstructured')) {
      optimizedPrompt = `Task: ${optimizedPrompt}\n\nPlease provide:\n1. Main answer\n2. Key points\n3. Brief summary`;
      improvements.push('Added clear structure for better results');
      techniquesApplied.push('Structural framework');
    }

    // Add safety constraints if quality issues
    if (issues.includes('toxicity_risk') || issues.includes('hallucination_risk')) {
      optimizedPrompt += '\n\nEnsure response is factual, safe, and appropriate.';
      improvements.push('Added safety and accuracy guardrails');
      techniquesApplied.push('Safety constraints');
    }

    return {
      optimizedPrompt,
      improvements: improvements.length > 0 ? improvements : this.generateDefaultImprovements(issues),
      techniquesApplied,
      expectedImprovements: {
        tokenReduction: issues.includes('excessive_tokens_in') ? '20-30%' : undefined,
        costSavings: issues.includes('high_cost') ? `$${(analysis.cost * 0.25).toFixed(6)}` : undefined,
        clarityScore: '15-25%',
      },
      proTip: 'Test this optimized prompt and track the metrics improvement in your dashboard!',
      complexity,
    };
  }

  /**
   * Generate default improvements based on issues
   */
  private generateDefaultImprovements(issues: string[]): string[] {
    const improvementMap: Record<string, string> = {
      excessive_tokens_in: 'Reduced input verbosity while maintaining clarity',
      verbose_output: 'Added output length constraints to optimize token usage',
      high_cost: 'Simplified prompt structure to reduce processing costs',
      high_latency: 'Streamlined prompt for faster response times',
      toxicity_risk: 'Added safety guidelines to ensure appropriate content',
      hallucination_risk: 'Enhanced factual accuracy requirements',
      low_coherence: 'Improved structure and clarity for better coherence',
      vague_request: 'Added specific requirements and context',
      too_brief: 'Expanded with necessary context and details',
      unstructured: 'Organized with clear sections and framework',
    };

    return issues.map(issue => improvementMap[issue]).filter(Boolean);
  }

  /**
   * Get welcome message
   */
  static getWelcomeMessage(): string {
    return `Hello! I'm Lyra, your AI prompt optimizer. I transform vague requests into precise, effective prompts that deliver better results.

**I analyze your Datadog metrics to provide data-driven optimizations:**
• Token usage patterns
• Cost efficiency
• Response quality
• Performance metrics

**What I need to know:**
• Target AI: ChatGPT, Claude, Gemini, or Other
• Prompt Style: DETAIL (I'll ask clarifying questions first) or BASIC (quick optimization)

**Examples:**
• "DETAIL using Gemini — Optimize my prompt based on this analysis"
• "BASIC using ChatGPT — Quick fix for high token usage"

Just share your prompt analysis from the dashboard and I'll provide intelligent optimization!`;
  }
}

/**
 * Quick optimization helper
 */
export async function optimizePromptQuick(
  originalPrompt: string,
  metrics: {
    tokensIn: number;
    tokensOut: number;
    latency: number;
    cost: number;
  }
): Promise<string> {
  const optimizer = new PromptOptimizer('BASIC', 'Gemini');
  
  const result = await optimizer.optimizePrompt({
    originalPrompt,
    model: 'gemini-2.5-flash',
    tokensIn: metrics.tokensIn,
    tokensOut: metrics.tokensOut,
    latency: metrics.latency,
    cost: metrics.cost,
    response: '',
  });

  return result.optimizedPrompt;
}
