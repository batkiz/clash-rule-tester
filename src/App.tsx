import { useState } from 'react';
import { parseConfig } from './core/configParser';
import type { ClashConfig } from './core/configParser';
import { matchDomain } from './core/ruleMatcher';
import type { MatchResult } from './core/ruleMatcher';
import Editor from '@monaco-editor/react';
import './App.css';

const initialConfig = `
# this is an example config
rule-providers:
  reject:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt"
    path: ./ruleset/reject.yaml
    interval: 86400

  private:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt"
    path: ./ruleset/private.yaml
    interval: 86400

  tld-not-cn:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt"
    path: ./ruleset/tld-not-cn.yaml
    interval: 86400

  gfw:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt"
    path: ./ruleset/gfw.yaml
    interval: 86400

  telegramcidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt"
    path: ./ruleset/telegramcidr.yaml
    interval: 86400

rules:
  - DOMAIN,clash.razord.top,DIRECT
  - DOMAIN,yacd.haishan.me,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,tld-not-cn,PROXY
  - RULE-SET,gfw,PROXY
  - RULE-SET,telegramcidr,PROXY
  - MATCH,DIRECT
`;

function App() {
  const [configYaml, setConfigYaml] = useState(initialConfig);
  const [domain, setDomain] = useState('www.google.com');
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message || 'An unknown error occurred.');
      } else {
        setError('An unknown error occurred.');
      }
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
        <a href="https://github.com/batkiz/clash-rule-tester" target="_blank" rel="noopener noreferrer" style={{ color: '#1DA1F2' }}>
          GitHub
        </a>
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