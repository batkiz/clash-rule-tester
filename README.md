# Clash Rule Tester

A web-based clash rule-providers & rules tester.

## Usage

Paste your rule-providers & rules to editor, and enter a domain name to test.

## supported features

### rule-provider
https://wiki.metacubex.one/en/config/rule-providers/

| field    | supported values            |
| -------- | --------------------------- |
| type     | http/inline                 |
| url      |                             |
| behavior | domain / ipcidr / classical |
| format   | yaml / text                 |

### rule
https://wiki.metacubex.one/en/config/rules/

supported rules:
- DOMAIN
- DOMAIN-SUFFIX
- DOMAIN-KEYWORD
- IP-CIDR
- RULE-SET
- MATCH