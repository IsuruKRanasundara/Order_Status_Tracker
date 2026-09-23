import { useEffect, useState } from 'react'
import { getOrders } from './api/orders.api'
import OrderList from './components/OrderList'
import OrderDetails from './components/OrderDetails'
import StatusFilter from './components/StatusFilter'
import Icon from './components/Icon'
import type { OrderSummary, StatusFilterValue } from './types/order'
import './App.css'

function App() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilterValue>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getOrders(undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) { setOrders(data); setLastSync(new Date()); setLoading(false) }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Unable to load orders.'); setLoading(false) }
    })
    return () => controller.abort()
  }, [refreshCount])

  function refresh() { setLoading(true); setError(null); setRefreshCount(count => count + 1) }
  const visibleOrders = orders
    .filter(order => (filter === 'all' || (filter === 'pending' ? order.status === null : order.status === filter)) && order.id.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (b.updatedAt ? Date.parse(b.updatedAt) : 0) - (a.updatedAt ? Date.parse(a.updatedAt) : 0) || a.id.localeCompare(b.id))
  const activeId = !error && visibleOrders.some(order => order.id === selectedId) ? selectedId : null
  const stats = [
    { label: 'Total orders', value: orders.length, note: 'Across all statuses', icon: 'box' as const, color: 'blue' },
    { label: 'In progress', value: orders.filter(order => order.status === 'created' || order.status === 'paid' || order.status === 'shipped').length, note: 'On the way to completion', icon: 'truck' as const, color: 'amber' },
    { label: 'Delivered', value: orders.filter(order => order.status === 'delivered').length, note: 'Successfully completed', icon: 'check' as const, color: 'green' },
    { label: 'Pending events', value: orders.reduce((total, order) => total + order.pendingEventCount, 0), note: 'Waiting for earlier updates', icon: 'clock' as const, color: 'purple' },
  ]

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to orders</a>
    <aside className="sidebar">
      <a className="brand" href="#main-content"><span className="brand-icon"><Icon name="box" /></span><span>orderly<span className="brand-dot">.</span></span></a>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="Main navigation"><a className="nav-item active" href="#main-content" aria-current="page"><Icon name="grid" />Order overview<span className="nav-indicator" /></a></nav>
      <div className="sidebar-note"><span className="sidebar-note-icon"><Icon name="box" /></span><h3>Every order has a story.</h3><p>Follow every update, from the first step to the final delivery.</p></div>
      <div className="sidebar-footer"><span className="workspace-avatar">OT</span><div><strong>Order workspace</strong><span>Status tracker</span></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Orders</strong></div><span className={`connection ${loading ? 'checking' : error ? 'offline' : ''}`}><span />{loading ? 'Connecting' : error ? 'Service unavailable' : 'Service connected'}</span></header>
      <main id="main-content">
        <div className="page-heading"><div><div className="eyebrow">YOUR OPERATIONS, AT A GLANCE</div><h1>Order overview<span>.</span></h1><p>Keep every order in sight, every step of the way.</p></div><button className="button refresh-button" onClick={refresh} disabled={loading}><Icon name="refresh" className={loading ? 'spin' : ''} />{loading ? 'Refreshing...' : 'Refresh orders'}</button></div>
        <div className="stats-grid">{stats.map(stat => <section className="stat-card" key={stat.label} aria-label={stat.label}><div className="stat-top"><span>{stat.label}</span><span className={`stat-icon ${stat.color}`}><Icon name={stat.icon} /></span></div><strong className="stat-value">{loading || error ? '—' : stat.value}</strong><p>{stat.note}</p></section>)}</div>
        <div className="order-layout">
          <section className="orders-panel" aria-labelledby="orders-title">
            <div className="panel-heading"><div className="heading-group"><h2 id="orders-title">All orders</h2><span className="count-pill">{loading || error ? '—' : orders.length}</span></div><span className="small-muted">Latest activity</span></div>
            <div className="list-toolbar"><label className="search-field"><Icon name="search" /><span className="sr-only">Search orders by ID</span><input type="search" placeholder="Search by order ID..." value={search} onChange={event => { setSearch(event.target.value); setSelectedId(null) }} /></label><StatusFilter value={filter} onChange={value => { setFilter(value); setSelectedId(null) }} /></div>
            <OrderList orders={visibleOrders} selectedId={activeId} onSelect={setSelectedId} loading={loading} error={error} onRetry={refresh} filtered={filter !== 'all' || search.trim() !== ''} />
            {!loading && !error && <div className="list-footer"><span>Showing {visibleOrders.length} of {orders.length} orders</span>{(filter !== 'all' || search !== '') && <button className="text-button" onClick={() => { setSearch(''); setFilter('all'); setSelectedId(null) }}>Clear filters</button>}</div>}
          </section>
          <OrderDetails key={`${activeId ?? 'empty'}-${refreshCount}`} orderId={activeId} onClose={() => setSelectedId(null)} />
        </div>
        <footer className="page-footer"><span><span className="footer-dot" />Order Status Tracker</span><span aria-live="polite">{loading ? 'Fetching latest updates...' : error ? 'Refresh to reconnect' : lastSync ? `Last refreshed at ${lastSync.toLocaleTimeString()}` : 'Ready to connect'}</span></footer>
      </main>
    </div>
  </div>
}
export default App
