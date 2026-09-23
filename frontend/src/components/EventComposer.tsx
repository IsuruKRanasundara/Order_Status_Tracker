import { useEffect, useRef, useState, type FormEvent } from 'react'
import { inspectApi, type ApiInspection } from '../api/orders.api'
import type { OrderEventInput, OrderStatus, WebhookResult } from '../types/order'
import Icon from './Icon'

export default function EventComposer({ initialEvent, onClose, onSubmitted }: {
  initialEvent: OrderEventInput | null
  onClose: () => void
  onSubmitted: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const [event, setEvent] = useState<OrderEventInput>(() => initialEvent ?? {
    eventId: `evt_${crypto.randomUUID()}`, orderId: `ord_${crypto.randomUUID()}`,
    status: 'created', timestamp: new Date().toISOString(),
  })
  const [raw, setRaw] = useState('')
  const [rawMode, setRawMode] = useState(false)
  const [lastBody, setLastBody] = useState<string | null>(null)
  const [response, setResponse] = useState<ApiInspection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  async function send(body: string) {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setError(null)
    setResponse(null)
    setLastBody(body)
    try {
      const result = await inspectApi('/webhooks/orders', 'POST', body)
      setResponse(result)
      onSubmitted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit event.')
    } finally { busy.current = false; setSaving(false) }
  }

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault()
    void send(rawMode ? raw : JSON.stringify(event))
  }

  function toggleRaw() {
    if (!rawMode) setRaw(JSON.stringify(event, null, 2))
    setRawMode(!rawMode)
  }

  const result = response?.ok ? response.body as WebhookResult : null
  const errorBody = response && !response.ok ? response.body as { error?: { message?: string } } : null
  return <dialog ref={dialogRef} className="create-dialog event-dialog" aria-labelledby="event-title"
    onCancel={e => { e.preventDefault(); if (!saving) onClose() }}>
    <div className="create-dialog-heading"><span className="create-order-symbol"><Icon name="refresh" /></span><button className="icon-button" aria-label="Close event form" disabled={saving} onClick={onClose}><Icon name="close" /></button></div>
    <h2 id="event-title">Send an order event</h2>
    <p className="dialog-description">Update an order, add an earlier event, or resend an event to check duplicate handling.</p>
    <form onSubmit={submit} aria-busy={saving}>
      <fieldset disabled={saving} className="event-fields">
        <label className="raw-toggle"><input type="checkbox" checked={rawMode} onChange={toggleRaw} />Edit raw JSON</label>
        {rawMode ? <label className="event-field">Request body<textarea className="json-editor" value={raw} onChange={e => setRaw(e.target.value)} rows={10} spellCheck={false} /><span className="field-help">Raw mode sends the exact text, including invalid JSON, to test validation.</span></label>
          : <><label className="event-field">Order ID<input className="create-input" required maxLength={200} value={event.orderId} onChange={e => setEvent({ ...event, orderId: e.target.value })} /></label>
            <label className="event-field">Status<select className="create-input" value={event.status} onChange={e => setEvent({ ...event, status: e.target.value as OrderStatus })}>{['created', 'paid', 'shipped', 'delivered', 'cancelled'].map(status => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="event-field">Event ID<input className="create-input" required maxLength={200} value={event.eventId} onChange={e => setEvent({ ...event, eventId: e.target.value })} /><span className="field-help">Keep this ID and payload unchanged when retrying. Use a new ID for a different event.</span></label>
            <label className="event-field">Event timestamp<input className="create-input" required value={event.timestamp} onChange={e => setEvent({ ...event, timestamp: e.target.value })} /><span className="field-help">ISO timestamp with a timezone, for example 2026-09-20T10:01:00Z. Earlier timestamps allow out-of-order testing.</span></label></>}
      </fieldset>
      {error && <p className="create-error" role="alert">{error}</p>}
      {response && <div className={`event-response ${response.ok ? 'response-ok' : 'response-error'}`} role="status">
        <strong>HTTP {response.status}{result?.duplicate ? ' · Duplicate event' : result ? ` · ${result.event.outcome}` : ' · Request rejected'}</strong>
        <p>{result?.duplicate ? 'This event was already received. No extra history entry was added.' : result?.event.outcome === 'pending' ? 'Saved and waiting for an earlier event.' : result ? `Order status: ${result.order.status ?? 'awaiting events'}.` : errorBody?.error?.message ?? 'The service rejected this request.'}</p>
        <details><summary>Response JSON</summary><pre>{JSON.stringify(response.body, null, 2)}</pre></details>
      </div>}
      <div className="create-actions event-actions"><button type="button" className="button" onClick={onClose} disabled={saving}>Close</button>{lastBody !== null && <button type="button" className="button" disabled={saving} onClick={() => void send(lastBody)}>Resend last payload</button>}<button className="button primary-button" disabled={saving} type="submit">{saving ? 'Sending...' : 'Send event'}</button></div>
    </form>
  </dialog>
}
