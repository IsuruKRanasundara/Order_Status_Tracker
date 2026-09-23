export default function StatusFilter() {
  return (
    <label>
      Filter by status{' '}
      <select disabled aria-describedby="filter-help"><option>All statuses</option></select>
      <span id="filter-help"> Filtering will be available after API integration.</span>
    </label>
  )
}
