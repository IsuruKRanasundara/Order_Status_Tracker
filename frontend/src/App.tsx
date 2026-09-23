import OrderList from './components/OrderList'
import OrderDetails from './components/OrderDetails'
import StatusFilter from './components/StatusFilter'
import './App.css'

function App() {
  return (
    <main>
      <header><h1>Order Status Tracker</h1><p>View orders and track their status.</p></header>
      <StatusFilter />
      <div className="order-layout"><OrderList /><OrderDetails /></div>
    </main>
  )
}

export default App
