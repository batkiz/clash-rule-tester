export const isWildcardMatch = (domainToMatch: string, rule: string): boolean => {
    const lowerCaseDomain = domainToMatch.toLowerCase();
    const lowerCaseRule = rule.toLowerCase();

    // Exact match
    if (lowerCaseDomain === lowerCaseRule) {
        return true;
    }

    // Handle '+.' rules (e.g., '+.baidu.com' matches 'baidu.com', 'www.baidu.com')
    if (lowerCaseRule.startsWith('+.')) {
        const suffixRule = lowerCaseRule.substring(2);
        return lowerCaseDomain === suffixRule || lowerCaseDomain.endsWith(`.${suffixRule}`);
    }

    // Handle '.' rules (e.g., '.baidu.com' matches 'www.baidu.com' but not 'baidu.com')
    if (lowerCaseRule.startsWith('.')) {
        const suffixRule = lowerCaseRule.substring(1);
        return lowerCaseDomain.endsWith(`.${suffixRule}`);
    }

    // Handle '*' rules (e.g., '*.baidu.com' matches 'www.baidu.com' but not 'a.www.baidu.com' or 'baidu.com')
    if (lowerCaseRule.includes('*')) {
        // Convert wildcard rule to regex pattern
        const regexPattern =
            '^' +
            lowerCaseRule
                .replace(/\./g, '\\.') // Escape dots
                .replace(/\*/g, '[^.]+') + // Replace * with [^.]+ (one or more non-dot characters)
            '$';
        try {
            return new RegExp(regexPattern).test(lowerCaseDomain);
        } catch (e) {
            console.error('Invalid regex pattern:', regexPattern, e);
            return false; // Invalid regex, return false
        }
    }

    return false;
};

export const isDomainSuffixMatch = (domainToMatch: string, rule: string): boolean => {
    const lowerCaseDomain = domainToMatch.toLowerCase();
    const lowerCaseRule = rule.toLowerCase();

    // It matches the domain suffix. For example, google.com matches www.google.com, mail.google.com, and google.com, but does not match content-google.com.
    return lowerCaseDomain === lowerCaseRule || lowerCaseDomain.endsWith(`.${lowerCaseRule}`);
};

export const matchDomainRule = (domain: string, rule: string): boolean => {
    const parts = rule.split(',');
    if (parts.length < 2) return false;

    const ruleType = parts[0].toUpperCase();
    const value = parts[1];
    const lowerCaseDomain = domain.toLowerCase();

    switch (ruleType) {
        case 'DOMAIN-SUFFIX':
            return isDomainSuffixMatch(lowerCaseDomain, value);
        case 'DOMAIN':
            return lowerCaseDomain === value.toLowerCase();
        case 'DOMAIN-KEYWORD':
            return lowerCaseDomain.includes(value.toLowerCase());
        default:
            return false;
    }
}
if (import.meta.vitest) {
    const { describe, it, expect } = import.meta.vitest

    describe('isWildcardMatch', () => {

        // Test cases for '+' and '.'
        describe('matches rules with "+."', () => {
            it('should match the root domain', () => {
                expect(isWildcardMatch('baidu.com', '+.baidu.com')).toBe(true);
            });
            it('should match a single-level subdomain', () => {
                expect(isWildcardMatch('tieba.baidu.com', '+.baidu.com')).toBe(true);
            });
            it('should match a multi-level subdomain', () => {
                expect(isWildcardMatch('123.tieba.baidu.com', '+.baidu.com')).toBe(true);
            });
            it('should not match an unrelated domain', () => {
                expect(isWildcardMatch('google.com', '+.baidu.com')).toBe(false);
            });
        });

        describe('matches rules with "."', () => {
            it('should not match the root domain', () => {
                expect(isWildcardMatch('baidu.com', '.baidu.com')).toBe(false);
            });
            it('should match a single-level subdomain', () => {
                expect(isWildcardMatch('tieba.baidu.com', '.baidu.com')).toBe(true);
            });
            it('should match a multi-level subdomain', () => {
                expect(isWildcardMatch('123.tieba.baidu.com', '.baidu.com')).toBe(true);
            });
        });

        // Test cases for '*'
        describe('matches rules with "*"', () => {
            it('should match a hostname without a dot', () => {
                expect(isWildcardMatch('localhost', '*')).toBe(true);
            });
            it('should match a single-level subdomain', () => {
                expect(isWildcardMatch('tieba.baidu.com', '*.baidu.com')).toBe(true);
            });
            it('should not match a multi-level subdomain', () => {
                expect(isWildcardMatch('123.tieba.baidu.com', '*.baidu.com')).toBe(false);
            });
            it('should not match the root domain', () => {
                expect(isWildcardMatch('baidu.com', '*.baidu.com')).toBe(false);
            });
        });

        // Test cases for other edge cases and mixed scenarios
        describe('matches with other rules and edge cases', () => {
            it('should handle exact domain matches', () => {
                expect(isWildcardMatch('baidu.com', 'baidu.com')).toBe(true);
            });
            it('should not match child domains with an exact rule', () => {
                expect(isWildcardMatch('www.baidu.com', 'baidu.com')).toBe(false);
            });
            it('should handle complex multi-level domain rules with "+."', () => {
                expect(isWildcardMatch('x.y.b.c.d', '+.b.c.d')).toBe(true);
            });
            it('should handle complex multi-level domain rules with "."', () => {
                expect(isWildcardMatch('x.y.b.c.d', '.b.c.d')).toBe(true);
            });
            it('should not match multi-level domains with "*"', () => {
                expect(isWildcardMatch('x.y.b.c.d', '*.b.c.d')).toBe(false);
            });
            it('should match a single-level domain with "*"', () => {
                expect(isWildcardMatch('y.b.c.d', '*.b.c.d')).toBe(true);
            });
        });
    });

    describe('isDomainSuffixMatch', () => {
        it('should match the domain itself', () => {
            expect(isDomainSuffixMatch('google.com', 'google.com')).toBe(true);
        });

        it('should match a subdomain', () => {
            expect(isDomainSuffixMatch('www.google.com', 'google.com')).toBe(true);
        });

        it('should match a multi-level subdomain', () => {
            expect(isDomainSuffixMatch('mail.google.com', 'google.com')).toBe(true);
        });

        it('should not match a domain that contains the rule but is not a suffix', () => {
            expect(isDomainSuffixMatch('content-google.com', 'google.com')).toBe(false);
        });

        it('should not match an unrelated domain', () => {
            expect(isDomainSuffixMatch('example.com', 'google.com')).toBe(false);
        });

        it('should handle case insensitivity', () => {
            expect(isDomainSuffixMatch('Google.com', 'google.com')).toBe(true);
            expect(isDomainSuffixMatch('www.GOOGLE.com', 'google.com')).toBe(true);
        });
    });

}


