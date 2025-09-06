import type { ClashConfig } from './configParser';
import CIDR from 'ip-cidr';
import yaml from 'js-yaml';

export interface MatchResult {
  domain: string;
  resolvedIp?: string;
  matchingRule: string;
  subMatchingRule?: string; // For RULE-SET matches
  finalPolicy: string;
}

// In-memory cache for rule providers
const providerCache = new Map<string, string[]>();
const CORS_PROXY = 'https://cors-proxy.batkiz.workers.dev/?url=';

const getRulesFromProvider = async (url: string, format: string = 'yaml'): Promise<string[]> => {
  if (providerCache.has(url)) {
    return providerCache.get(url)!;
  }
  try {
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const text = await response.text();
    let rules: string[];

    if (format === 'yaml') {
      const parsedYaml = yaml.load(text) as { payload?: string[] };
      if (!parsedYaml || !Array.isArray(parsedYaml.payload)) {
        throw new Error("YAML provider does not contain a valid 'payload' array.");
      }
      rules = parsedYaml.payload;
    } else { // format === 'text'
      rules = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    }

    providerCache.set(url, rules);
    return rules;
  } catch (e: any) {
    throw new Error(`Failed to fetch or parse provider from ${url}: ${e.message}`);
  }
};

const resolveDomainToIp = async (domain: string): Promise<string | null> => {
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { 'accept': 'application/dns-json' }
    });
    const data = await response.json();
    return data.Answer?.[0]?.data || null;
  } catch (error) {
    console.error('DNS resolution failed:', error);
    return null;
  }
};

const matchAgainstRuleList = (domain: string, resolvedIp: string | null, rules: string[], behavior: string = 'classical'): string | null => {
    const lowerCaseDomain = domain.toLowerCase();
    let bestMatch = { rule: '', score: -1 };

    for (const line of rules) {
        let score = -1;
        if (behavior === 'domain') {
            if (line.startsWith('+.')) {
                const value = line.substring(2);
                if (lowerCaseDomain === value) score = 4000 + value.length;
                else if (lowerCaseDomain.endsWith(`.${value}`)) score = 2000 + value.length;
            } else if (line.startsWith('.')) {
                const value = line.substring(1);
                if (lowerCaseDomain.endsWith(`.${value}`)) score = 2000 + value.length;
            } else if (line.includes('*')) {
                const regexPattern = '^' + line.replace(/\./g, '\\.\\').replace(/\*/g, '[^.]+') + '$';
                try {
                    if (new RegExp(regexPattern).test(lowerCaseDomain)) score = 3000 + line.replace(/\*/g, '').length;
                } catch (e) { /* Invalid regex */ }
            } else {
                if (lowerCaseDomain === line) score = 4000 + line.length;
            }
        } else if (behavior === 'ipcidr') {
            if (resolvedIp) {
                try {
                    if (new CIDR(line).contains(resolvedIp)) score = 1000 + line.length;
                } catch { /* ignore invalid CIDR */ }
            }
        } else { // classical behavior
            const parts = line.split(',');
            const type = parts[0]?.toUpperCase();
            const value = parts[1];
            if (!value) continue;
            if ((type === 'DOMAIN' && lowerCaseDomain === value.toLowerCase()) || (type === 'DOMAIN-SUFFIX' && lowerCaseDomain === value.toLowerCase())) score = 4000 + value.length;
            else if (type === 'DOMAIN-SUFFIX' && lowerCaseDomain.endsWith(`.${value.toLowerCase()}`)) score = 2000 + value.length;
            else if (type === 'DOMAIN-KEYWORD' && lowerCaseDomain.includes(value.toLowerCase())) score = 1000 + value.length;
            else if (type === 'IP-CIDR' && resolvedIp) {
                try {
                    if (new CIDR(value).contains(resolvedIp)) score = 1000 + value.length;
                } catch { /* ignore */ }
            }
        }
        if (score > bestMatch.score) bestMatch = { rule: line, score: score };
    }
    return bestMatch.score !== -1 ? bestMatch.rule : null;
};

export const matchDomain = async (config: ClashConfig, domain: string): Promise<MatchResult | null> => {
  const rules = config.rules ?? [];
  const providers = config['rule-providers'] ?? {};
  const lowerCaseDomain = domain.toLowerCase();
  
  let resolvedIp: string | null = null;
  const hasIpBasedRules = rules.some(r => {
    const upperRule = r.toUpperCase();
    return upperRule.startsWith('IP-CIDR') || upperRule.startsWith('RULE-SET');
  });

  if (hasIpBasedRules) {
    resolvedIp = await resolveDomainToIp(domain);
  }

  for (const ruleString of rules) {
    const parts = ruleString.split(',');
    if (parts.length < 2) continue;

    const ruleType = parts[0].toUpperCase();
    const value = parts[1];
    const policy = parts[parts.length - 1];

    let isMatch = false;
    let subMatchingRule: string | undefined = undefined;

    switch (ruleType) {
      case 'DOMAIN-SUFFIX':
        if (lowerCaseDomain === value.toLowerCase() || lowerCaseDomain.endsWith(`.${value.toLowerCase()}`)) isMatch = true;
        break;
      case 'DOMAIN':
        if (lowerCaseDomain === value.toLowerCase()) isMatch = true;
        break;
      case 'DOMAIN-KEYWORD':
        if (lowerCaseDomain.includes(value.toLowerCase())) isMatch = true;
        break;
      case 'IP-CIDR':
        if (resolvedIp) {
          try {
            if (new CIDR(value).contains(resolvedIp)) isMatch = true;
          } catch (e) {
            console.warn(`Invalid CIDR "${value}" in rule: ${ruleString}`);
          }
        }
        break;
      case 'RULE-SET':
        const providerConfig = providers[value];
        if (!providerConfig) break;

        let providerRules: string[] | null = null;

        try {
          if (providerConfig.type === 'http') {
            providerRules = await getRulesFromProvider(providerConfig.url, providerConfig.format);
          } else if (providerConfig.type === 'inline') {
            if (Array.isArray(providerConfig.payload)) {
              providerRules = providerConfig.payload;
            }
          }

          if (providerRules) {
            const subMatch = matchAgainstRuleList(domain, resolvedIp, providerRules, providerConfig.behavior);
            if (subMatch) {
              isMatch = true;
              subMatchingRule = subMatch;
            }
          }
        } catch (e: any) {
          throw new Error(`Provider "${value}": ${e.message}`);
        }
        break;
      case 'MATCH':
      case 'FINAL':
        isMatch = true;
        break;
    }

    if (isMatch) {
      return {
        domain: domain,
        resolvedIp: resolvedIp || undefined,
        matchingRule: ruleString,
        subMatchingRule: subMatchingRule,
        finalPolicy: policy,
      };
    }
  }

  return null;
};
