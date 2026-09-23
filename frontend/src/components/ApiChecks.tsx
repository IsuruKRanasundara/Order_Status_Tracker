import { useEffect, useRef, useState } from 'react'
import { runApiChecks, type ApiCheckResult } from '../api/api-checks'
import Icon from './Icon'

export default function ApiChecks({ open, onComplete, onClose }: { open: boolean; onComplete: () => void; onClose: () => void }) {
  const controllerRef = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ApiCheckResult[]>([])
  const [runId, setRunId] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => () => controllerRef.current?.abort(), [])

  async function run() {
    if (controllerRef.current) return
    const controller = new AbortController()
    controllerRef.current = controller
    const id = `check_${crypto.randomUUID()}`
    setRunId(id)
    setResults([])
    setMessage('')
    setRunning(true)
    let completed = 0
    try {
      await runApiChecks(id, result => { completed++; setResults(current => [...current, result]) }, controller.signal)
      setMessage(controller.signal.aborted ? 'Stopped. Completed requests and test orders are retained.' : completed === 24 ? 'All 24 checks completed.' : 'Stopped after a connection failure. Reconnect and run again.')
    } finally {
      controllerRef.current = null
      setRunning(false)
      onComplete()
    }
  }

  const passed = results.filter(result => result.passed).length
  return <section hidden={!open} className="api-checks-panel" aria-labelledby="checks-title">
    <div className="panel-heading"><h2 id="checks-title">API checks</h2><button className="icon-button" disabled={running} aria-label="Close API checks" onClick={onClose}><Icon name="close" /></button></div>
    <div className="checks-intro"><p>Run the 24 scenarios from your API checklist: status changes, duplicates, cancellation, out-of-order events, and invalid requests.</p><p className="field-help">Each run creates uniquely named test orders in this application. Expected 400, 404, and 409 responses count as passing checks. Stopping does not undo completed requests.</p>
      <div className="checks-controls"><button className="button primary-button" disabled={running} onClick={() => void run()}><Icon name={running ? 'refresh' : 'check'} className={running ? 'spin' : ''} />{running ? `Running ${results.length}/24` : 'Run all 24 checks'}</button>{running && <button className="button" onClick={() => controllerRef.current?.abort()}>Stop</button>}<span role="status">{results.length > 0 && `${passed} passed · ${results.length - passed} failed · ${24 - results.length} remaining`}</span></div>
      {runId && <p className="run-id">Run: {runId}</p>}{message && <p role="status" className="field-help">{message}</p>}
    </div>
    {results.length > 0 && <ol className="check-results">{results.map((result, index) => <li key={`${runId}-${index}`}><details>
      <summary><span className={result.passed ? 'check-pass' : 'check-fail'}>{result.passed ? 'PASS' : 'FAIL'}</span><span className="check-name">{String(index + 1).padStart(2, '0')} · {result.name}</span><span className="check-http">{result.status ?? 'Network error'}</span></summary>
      <div className="check-result-body"><p><code>{result.method} {result.path}</code></p><p>Expected HTTP {result.expectedStatus}</p><ul>{result.assertions.map(assertion => <li key={assertion.label}>{assertion.passed ? 'PASS' : 'FAIL'} · {assertion.label}</li>)}</ul><pre>{JSON.stringify(result.body, null, 2)}</pre></div>
    </details></li>)}</ol>}
  </section>
}
