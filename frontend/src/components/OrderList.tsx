import type { OrderSummary } from '../types/order'
import Icon from './Icon'
import StatusBadge from './StatusBadge'
export default function OrderList({ orders, selectedId, onSelect, loading, error, onRetry, filtered }: {
  orders: OrderSummary[]; selectedId: string | null; onSelect: (id: string) => void
  loading: boolean; error: string | null; onRetry: () => void; filtered: boolean
}) {
  if (loading) return <div className="state-box" role="status"><Icon name="refresh" className="spin" /><h3>Loading your orders</h3><p>Getting the latest updates.</p></div>
  if (error) return <div className="state-box error-state" role="alert"><Icon name="close" /><h3>Could not load orders</h3><p>{error}</p><button className="button" onClick={onRetry}>Try again</button></div>
  if (orders.length === 0) return <div className="state-box" role="status"><span className="empty-icon"><Icon name="box" /></span><h3>{filtered ? 'No matching orders' : 'Your orders will appear here'}</h3><p>{filtered ? 'Try a different status or order ID.' : 'Once the first order arrives, you can follow its progress here.'}</p></div>
  return <div className="table-scroll"><table className="order-table"><caption className="sr-only">Orders. Select an order to view its event history.</caption>
    <thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Last update</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
    <tbody>{orders.map(order => <tr key={order.id} className={order.id === selectedId ? 'selected-row' : ''}>
      <td><button className="order-link" onClick={() => onSelect(order.id)} aria-pressed={order.id === selectedId}><span className="order-symbol"><Icon name="box" /></span><span className="order-id" title={order.id}>{order.id}</span></button>{order.pendingEventCount > 0 && <span className="pending-note">{order.pendingEventCount} pending {order.pendingEventCount === 1 ? 'event' : 'events'}</span>}</td>
      <td><StatusBadge status={order.status} /></td>
      <td className="date-cell">{order.updatedAt ? <time dateTime={order.updatedAt}>{new Date(order.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<span>{new Date(order.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></time> : '—'}</td>
      <td><button className="icon-button" onClick={() => onSelect(order.id)} aria-label={`View ${order.id}`}><Icon name="arrow" /></button></td>
    </tr>)}</tbody>
  </table></div>
}
