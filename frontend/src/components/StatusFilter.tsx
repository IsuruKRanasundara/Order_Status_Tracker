import type { StatusFilterValue } from '../types/order'
export default function StatusFilter({ value, onChange }: { value: StatusFilterValue; onChange: (value: StatusFilterValue) => void }) {
  return <label className="filter-select"><span className="sr-only">Filter by status</span>
    <select value={value} onChange={event => onChange(event.target.value as StatusFilterValue)}>
      <option value="all">All statuses</option><option value="created">Created</option><option value="paid">Paid</option>
      <option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option><option value="pending">Awaiting events</option>
    </select>
  </label>
}
