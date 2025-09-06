import type { ClashConfig, RuleProvider } from './configParser';
import CIDR from 'ip-cidr';
import { isWildcardMatch, matchDomainRule } from './helper';
import { resolveDomainToIp, getRulesFromProvider } from './network';

export interface MatchResult {
  domain: string;
  resolvedIp?: string;
  matchingRule: string;
  subMatchingRule?: string; // For RULE-SET matches
  finalPolicy: string;
}


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
      case 'DOMAIN':
      case 'DOMAIN-KEYWORD':
        if (isWildcardMatch(lowerCaseDomain, value)) isMatch = true;
        break;
      case 'IP-CIDR':
        if (resolvedIp) {
          try {
            if (new CIDR(value).contains(resolvedIp)) isMatch = true;
          } catch {
            console.warn(`Invalid CIDR "${value}" in rule: ${ruleString}`);
          }
        }
        break;
      case 'RULE-SET': {
        const providerConfig = providers[value] as RuleProvider;
        if (!providerConfig) break;

        let providerRules: string[] | null = null;

        try {
          if (providerConfig.type === 'http') {
            providerRules = await getRulesFromProvider(providerConfig.url!, providerConfig.format);
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
        } catch (e: unknown) {
          if (e instanceof Error) {
            throw new Error(`Provider "${value}": ${e.message}`);
          }
          throw new Error(`Provider "${value}": ${e}`);
        }
        break;
      }
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

const matchAgainstRuleList = (domain: string, resolvedIp: string | null, rules: string[], behavior: string = 'classical'): string | null => {
  const lowerCaseDomain = domain.toLowerCase();

  for (const line of rules) {
    if (isRuleMatch(line, lowerCaseDomain, resolvedIp, behavior)) {
      return line;
    }
  }
  return null;
};

function isRuleMatch(
  line: string,
  lowerCaseDomain: string,
  resolvedIp: string | null,
  behavior: string = 'classical'
): boolean {
  if (behavior === 'domain') {
    return isWildcardMatch(lowerCaseDomain, line);
  } else if (behavior === 'ipcidr') {
    if (resolvedIp) {
      try {
        if (new CIDR(line).contains(resolvedIp)) return true;
      } catch { /* ignore invalid CIDR */ }
    }
  } else { // classical behavior
    const parts = line.split(',');
    const type = parts[0]?.toUpperCase();
    const value = parts[1];
    if (!value) return false;
    if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX' || type === 'DOMAIN-KEYWORD') {
      return matchDomainRule(lowerCaseDomain, value);
    }
    if (type === 'IP-CIDR' && resolvedIp) {
      try {
        if (new CIDR(value).contains(resolvedIp)) return true;
      } catch { /* ignore */ }
    }
  }
  return false;
}
