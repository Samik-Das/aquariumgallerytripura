// ===== Dashboard Logic =====

let currentFilter = 'day';
let salesData = [];
let damageData = [];

// Initialize
(async () => {
  await checkAuth();
  buildNavbar('Dashboard');
  await loadDashboard();
})();

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  document.getElementById(`filter-${filter}`).classList.add('active');
  loadDashboard();
}

function getDateRange() {
  const now = new Date();
  let start;

  switch (currentFilter) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
      start = new Date(2000, 0, 1);
      break;
  }

  return start.toISOString();
}

async function loadDashboard() {
  const startDate = getDateRange();

  // Load sales with items
  const { data: sales } = await db.from('sales')
    .select('*')
    .gte('sale_date', startDate)
    .order('sale_date', { ascending: false });

  let saleItems = [];
  if (sales && sales.length > 0) {
    const saleIds = sales.map(s => s.id);
    const { data: items } = await db.from('sale_items').select('*').in('sale_id', saleIds);
    saleItems = items || [];
  }

  // Load damages
  const { data: damages } = await db.from('damages')
    .select('*')
    .gte('damage_date', startDate)
    .order('damage_date', { ascending: false });

  salesData = sales || [];
  damageData = damages || [];

  // Calculate stats
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalDamageLoss = 0;

  const detailRows = [];

  saleItems.forEach(item => {
    const sale = salesData.find(s => s.id === item.sale_id);
    const revenue = item.actual_selling_price * item.quantity;
    const cost = item.buying_price * item.quantity;
    const profit = revenue - cost;

    totalRevenue += revenue;
    totalProfit += profit;

    detailRows.push({
      date: sale?.sale_date || item.created_at,
      customer: sale?.customer_name || '-',
      product: item.product_name,
      qty: item.quantity,
      sp: item.selling_price,
      actual_sp: item.actual_selling_price,
      bp: item.buying_price,
      revenue,
      profit
    });
  });

  damageData.forEach(d => {
    totalDamageLoss += d.total_buying_price;
  });

  // Update stat cards
  document.getElementById('stat-revenue').textContent = '₹' + totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0 });
  document.getElementById('stat-profit').textContent = '₹' + totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 0 });
  document.getElementById('stat-profit').parentElement.className = `stat-card ${totalProfit >= 0 ? 'green' : 'red'}`;
  document.getElementById('stat-sales-count').textContent = salesData.length;
  document.getElementById('stat-damage-loss').textContent = '₹' + totalDamageLoss.toLocaleString('en-IN', { minimumFractionDigits: 0 });

  // Render sales table
  renderSalesTable(detailRows);
  renderDamageTable();
}

function renderSalesTable(rows) {
  const tbody = document.getElementById('sales-detail-body');
  const empty = document.getElementById('sales-empty');
  const wrapper = document.getElementById('sales-table-wrapper');
  const count = document.getElementById('table-count');

  if (rows.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    count.textContent = '0 records';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';
  count.textContent = rows.length + ' records';

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td><strong>${r.customer}</strong></td>
      <td>${r.product}</td>
      <td>${r.qty}</td>
      <td>${formatCurrency(r.sp)}</td>
      <td>${formatCurrency(r.actual_sp)}</td>
      <td class="text-gray-400">${formatCurrency(r.bp)}</td>
      <td><strong class="text-aqua-600">${formatCurrency(r.revenue)}</strong></td>
      <td><strong class="${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(r.profit)}</strong></td>
    </tr>
  `).join('');
}

function renderDamageTable() {
  const tbody = document.getElementById('damage-detail-body');
  const empty = document.getElementById('damage-empty');
  const wrapper = document.getElementById('damage-table-wrapper');
  const count = document.getElementById('damage-table-count');

  if (damageData.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    count.textContent = '0 records';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';
  count.textContent = damageData.length + ' records';

  tbody.innerHTML = damageData.map(d => `
    <tr>
      <td>${formatDate(d.damage_date)}</td>
      <td><strong>${d.product_name}</strong></td>
      <td class="text-red-600 font-bold">${d.quantity}</td>
      <td>${formatCurrency(d.buying_price_per_item)}</td>
      <td class="text-red-600 font-bold">${formatCurrency(d.total_buying_price)}</td>
      <td>${d.auto_fix_sp ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-red">No</span>'}</td>
    </tr>
  `).join('');
}

// ===== Export to Excel =====
function exportToExcel() {
  const table = document.getElementById('sales-detail-table');
  if (!table) return;

  let csv = '';
  const rows = table.querySelectorAll('tr');

  rows.forEach(row => {
    const cols = row.querySelectorAll('td, th');
    const rowData = [];
    cols.forEach(col => {
      let text = col.innerText.replace(/"/g, '""').replace(/₹/g, '');
      rowData.push(`"${text}"`);
    });
    csv += rowData.join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AGT-Dashboard-${currentFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showToast('Report exported!');
}
