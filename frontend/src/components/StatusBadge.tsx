import type { OrderStatus } from '../types/order'
export default function StatusBadge({ status }: { status: OrderStatus | null }) {
  return <span className={`status-badge status-${status ?? 'pending'}`}><span className="status-dot" />{status ?? 'Awaiting events'}</span>
}
