import { useState } from 'react';
import { parseConfig } from './core/configParser';
import type { ClashConfig } from './core/configParser';
import { matchDomain } from './core/ruleMatcher';
import type { MatchResult } from './core/ruleMatcher';
import Editor from '@monaco-editor/react';
import './App.css';

const initialConfig = `
# A more realistic example with a rule provider
rule-providers:
  reject:
    type: http
    behavior: domain
    format: text # Explicitly set format
    url: "https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/reject.txt"
    path: ./ruleset/reject.txt
    interval: 86400
  cnip:
    type: http
    behavior: ipcidr
    format: text # Explicitly set format
    url: "https://raw.githubusercontent.com/Loyalsoldier/clash-rules/release/cnip.txt"
    path: ./ruleset/cnip.txt
    interval: 86400
  # Example of an inline provider
  inline-provider:
    type: inline
    behavior: classical # Use classical for TYPE,VALUE format
    payload:
      - 'DOMAIN-SUFFIX,inline-test.com'

rules:
  - RULE-SET,reject,REJECT
  - RULE-SET,cnip,DIRECT
  - RULE-SET,inline-provider,PROXY
  - DOMAIN-SUFFIX,google.com,PROXY
  - MATCH,PROXY
`;

function App() {
  const [configYaml, setConfigYaml] = useState(initialConfig);
  const [domain, setDomain] = useState('test.inline-test.com');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = async () => {
    if (isLoading || !domain.trim()) return;
    try {
      setError('');
      setResult(null);
      setIsLoading(true);
      const config: ClashConfig = parseConfig(configYaml);
      const match = await matchDomain(config, domain);
      if (match) {
        setResult(match);
      } else {
        setError(`No rule matched for domain: ${domain}`);
      }
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleTest();
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Clash Rule Tester</h1>
      </header>
      <main className="container">
        <div className="config-editor">
          <h2>Configuration</h2>
          <Editor
            height="60vh"
            language="yaml"
            theme="light"
            value={configYaml}
            onChange={(value) => setConfigYaml(value || '')}
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 14,
            }}
          />
        </div>
        <div className="tester">
          <h2>Test Case</h2>
          <div className="input-group">
            <label htmlFor="domain">Domain to Test</label>
            <input
              id="domain"
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., www.google.com"
            />
            <button onClick={handleTest} disabled={isLoading || !domain.trim()}>
              {isLoading ? 'Testing...' : 'Test'}
            </button>
          </div>
          <div className="results">
            <h2>Result</h2>
            {isLoading && <div className="placeholder-box">Fetching providers, resolving DNS, and matching...</div>}
            {error && <div className="error-box">{error}</div>}
            {result && (
              <div className="result-box">
                <p><strong>Domain:</strong> {result.domain}</p>
                {result.resolvedIp && <p><strong>Resolved IP:</strong> {result.resolvedIp}</p>}
                <p><strong>Matching Rule:</strong> <code>{result.matchingRule}</code></p>
                {result.subMatchingRule && (
                  <p><strong>Provider Rule:</strong> <code>{result.subMatchingRule}</code></p>
                )}
                <p><strong>Final Policy:</strong> <span>{result.finalPolicy}</span></p>
              </div>
            )}
            {!result && !error && !isLoading && <div className="placeholder-box">Run a test to see the result.</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;