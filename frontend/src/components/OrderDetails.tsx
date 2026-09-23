import { useEffect, useState } from 'react'
import { getOrder } from '../api/orders.api'
import type { OrderDetails as OrderDetailsData } from '../types/order'
import Icon from './Icon'
import StatusBadge from './StatusBadge'

export default function OrderDetails({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const [order, setOrder] = useState<OrderDetailsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(orderId))
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!orderId) return
    const controller = new AbortController()
    getOrder(orderId, controller.signal).then(data => {
      if (!controller.signal.aborted) { setOrder(data); setLoading(false) }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Unable to load order.'); setLoading(false) }
    })
    return () => controller.abort()
  }, [orderId, retry])

  return <aside className="details-panel" aria-labelledby="details-title">
    <div className="panel-heading"><h2 id="details-title">Order details</h2>{orderId && <button className="icon-button" aria-label="Close order details" onClick={onClose}><Icon name="close" /></button>}</div>
    {!orderId ? <div className="state-box details-empty"><div className="empty-orbit"><Icon name="box" /></div><h3>A closer look at every order</h3><p>Select an order to see its journey, from creation to delivery.</p><span className="subtle-label">EVERY UPDATE, IN ONE PLACE</span></div>
      : loading ? <div className="state-box" role="status"><Icon name="refresh" className="spin" /><p>Loading order history...</p></div>
      : error ? <div className="state-box error-state" role="alert"><h3>Could not load details</h3><p>{error}</p><button className="button" onClick={() => { setLoading(true); setError(null); setRetry(value => value + 1) }}>Try again</button></div>
      : order && <div className="details-body">
        <div className="detail-label">ORDER ID</div><h3 className="detail-order-id">{order.id}</h3><StatusBadge status={order.status} />
        <dl className="detail-facts"><div><dt>Last update</dt><dd>{order.updatedAt ? new Date(order.updatedAt).toLocaleString() : 'Awaiting earlier events'}</dd></div><div><dt>Total events</dt><dd>{order.events.length}</dd></div></dl>
        {order.pendingEventCount > 0 && <p className="pending-banner"><Icon name="clock" />{order.pendingEventCount} {order.pendingEventCount === 1 ? 'event is' : 'events are'} waiting for an earlier update.</p>}
        <div className="timeline-heading"><h3>Event history</h3><span>{order.events.length} events</span></div>
        <ol className="timeline">{order.events.map(event => <li key={event.eventId} className={`event-${event.outcome}`}>
          <span className="timeline-marker"><Icon name={event.outcome === 'applied' ? 'check' : event.outcome === 'pending' ? 'clock' : 'close'} /></span>
          <div className="event-heading"><strong>{event.status}</strong><span className={`outcome outcome-${event.outcome}`}>{event.outcome}</span></div>
          <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time>
          <p className="event-id">{event.eventId}</p>
          {event.reason && <p className="event-reason">{event.reason}</p>}
        </li>)}</ol>
      </div>}
  </aside>
}
