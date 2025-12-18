/**
 * PII (Personally Identifiable Information) Detector
 * Scans text for sensitive data and provides masking capabilities
 */

export interface PIIDetectionResult {
  hasPII: boolean;
  types: string[];
  matches: Array<{
    type: string;
    value: string;
    position: number;
  }>;
  maskedText: string;
}

const PII_PATTERNS = {
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    description: 'Email address',
    mask: (match: string) => {
      const [local, domain] = match.split('@');
      return `${local[0]}***@${domain}`;
    },
  },
  phone: {
    pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    description: 'Phone number',
    mask: () => '***-***-****',
  },
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    description: 'Social Security Number',
    mask: () => '***-**-****',
  },
  creditCard: {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    description: 'Credit card number',
    mask: () => '****-****-****-****',
  },
  ipAddress: {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    description: 'IP address',
    mask: (match: string) => {
      const parts = match.split('.');
      return `${parts[0]}.${parts[1]}.***.***.`;
    },
  },
  passport: {
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    description: 'Passport number',
    mask: () => '**######',
  },
  driverLicense: {
    pattern: /\b[A-Z]{1,2}\d{5,8}\b/g,
    description: 'Driver license',
    mask: () => '**#####',
  },
  address: {
    pattern: /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|highway|hwy|square|sq|trail|trl|drive|dr|court|ct|parkway|pkwy|circle|cir|boulevard|blvd)\b/gi,
    description: 'Street address',
    mask: () => '[ADDRESS REDACTED]',
  },
};

/**
 * Detect PII in text
 */
export function detectPII(text: string): PIIDetectionResult {
  const matches: Array<{ type: string; value: string; position: number }> = [];
  const types = new Set<string>();
  let maskedText = text;

  for (const [type, config] of Object.entries(PII_PATTERNS)) {
    const pattern = new RegExp(config.pattern);
    let match;

    while ((match = pattern.exec(text)) !== null) {
      types.add(type);
      matches.push({
        type,
        value: match[0],
        position: match.index,
      });

      // Mask the PII in the text
      maskedText = maskedText.replace(match[0], config.mask(match[0]));
    }
  }

  return {
    hasPII: matches.length > 0,
    types: Array.from(types),
    matches,
    maskedText,
  };
}

/**
 * Check if text contains PII (quick check)
 */
export function hasPII(text: string): boolean {
  return Object.values(PII_PATTERNS).some(config => config.pattern.test(text));
}

/**
 * Mask PII in text
 */
export function maskPII(text: string): string {
  let masked = text;

  for (const config of Object.values(PII_PATTERNS)) {
    masked = masked.replace(config.pattern, (match) => config.mask(match));
  }

  return masked;
}

/**
 * Get PII types found in text
 */
export function getPIITypes(text: string): string[] {
  const types = new Set<string>();

  for (const [type, config] of Object.entries(PII_PATTERNS)) {
    if (config.pattern.test(text)) {
      types.add(type);
    }
  }

  return Array.from(types);
}
