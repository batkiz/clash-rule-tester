import { parse } from 'yaml';

// In-memory cache for rule providers
const providerCache = new Map<string, string[]>();
const CORS_PROXY = 'https://cors-proxy.batkiz.workers.dev/?url=';

export const getRulesFromProvider = async (url: string, format: string = 'yaml'): Promise<string[]> => {
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
      const parsedYaml = parse(text) as { payload?: string[] };
      if (!parsedYaml || !Array.isArray(parsedYaml.payload)) {
        throw new Error("YAML provider does not contain a valid 'payload' array.");
      }
      rules = parsedYaml.payload;
    } else { // format === 'text'
      rules = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    }

    providerCache.set(url, rules);
    return rules;
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw new Error(`Failed to fetch or parse provider from ${url}: ${e.message}`);
    }
    throw new Error(`Failed to fetch or parse provider from ${url}: ${e}`);
  }
};

export const resolveDomainToIp = async (domain: string): Promise<string | null> => {
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