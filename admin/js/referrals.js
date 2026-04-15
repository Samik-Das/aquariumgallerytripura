// ===== Referral Commissions Logic =====

let allReferralSales = [];
let allPayments = [];
let filteredSales = [];

// Initialize
(async () => {
  await checkAuth();
  buildNavbar('Referrals');
  await loadReferralData();
  applyFilters();
})();

async function loadReferralData() {
  // Load all referral sales
  const { data: sales } = await db.from('sales')
    .select('*')
    .eq('is_referral', true)
    .order('sale_date', { ascending: false });
  allReferralSales = sales || [];

  // Load payment history
  const { data: payments } = await db.from('referral_payments')
    .select('*')
    .order('paid_date', { ascending: false });
  allPayments = payments || [];

  updateStats();
  renderPayments();
}

function updateStats() {
  const totalSales = allReferralSales.length;
  const totalCommission = allReferralSales.reduce((s, r) => s + (r.total_commission || 0), 0);
  const totalPaid = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const unpaid = totalCommission - totalPaid;

  document.getElementById('stat-total-sales').textContent = totalSales;
  document.getElementById('stat-total-commission').textContent = formatCurrency(totalCommission);
  document.getElementById('stat-unpaid').textContent = formatCurrency(Math.max(0, unpaid));
  document.getElementById('stat-paid').textContent = formatCurrency(totalPaid);
}

function applyFilters() {
  const referrerSearch = document.getElementById('filter-referrer').value.trim().toLowerCase();
  const period = document.getElementById('filter-period').value;
  const status = document.getElementById('filter-status').value;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  filteredSales = allReferralSales.filter(s => {
    // Referrer name filter
    if (referrerSearch && !(s.referrer_name || '').toLowerCase().includes(referrerSearch)) return false;

    // Period filter
    if (period !== 'all') {
      const saleDate = new Date(s.sale_date);
      if (period === 'today' && saleDate < startOfDay) return false;
      if (period === 'week' && saleDate < startOfWeek) return false;
      if (period === 'month' && saleDate < startOfMonth) return false;
      if (period === 'year' && saleDate < startOfYear) return false;
    }

    return true;
  });

  // For paid/unpaid status filter, we need to check against payments
  // We'll handle this in the summary render

  renderReferrerSummary(status);
  renderSalesDetail();
}

function renderReferrerSummary(statusFilter) {
  const tbody = document.getElementById('referrer-summary-body');
  const empty = document.getElementById('referrer-empty');
  const wrapper = document.getElementById('referrer-summary-wrapper');
  const count = document.getElementById('referrer-count');

  // Group by referrer
  const referrerMap = {};
  filteredSales.forEach(s => {
    const name = s.referrer_name || 'Unknown';
    if (!referrerMap[name]) referrerMap[name] = { sales: [], totalCommission: 0 };
    referrerMap[name].sales.push(s);
    referrerMap[name].totalCommission += (s.total_commission || 0);
  });

  // Calculate paid per referrer
  const paidPerReferrer = {};
  allPayments.forEach(p => {
    const name = p.referrer_name || 'Unknown';
    paidPerReferrer[name] = (paidPerReferrer[name] || 0) + (p.amount || 0);
  });

  let referrers = Object.entries(referrerMap).map(([name, data]) => {
    const paid = paidPerReferrer[name] || 0;
    const unpaid = Math.max(0, data.totalCommission - paid);
    return { name, salesCount: data.sales.length, totalCommission: data.totalCommission, paid, unpaid, saleIds: data.sales.map(s => s.id) };
  });

  // Status filter
  if (statusFilter === 'unpaid') referrers = referrers.filter(r => r.unpaid > 0);
  if (statusFilter === 'paid') referrers = referrers.filter(r => r.unpaid <= 0);

  // Sort by unpaid desc
  referrers.sort((a, b) => b.unpaid - a.unpaid);

  if (referrers.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    count.textContent = '0 referrers';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';
  count.textContent = referrers.length + ' referrers';

  tbody.innerHTML = referrers.map(r => `
    <tr>
      <td><strong class="text-purple-700"><i class="fa-solid fa-user"></i> ${escapeHtml(r.name)}</strong></td>
      <td>${r.salesCount}</td>
      <td><strong>${formatCurrency(r.totalCommission)}</strong></td>
      <td><span class="text-green-600">${formatCurrency(r.paid)}</span></td>
      <td><strong class="${r.unpaid > 0 ? 'text-red-600' : 'text-gray-400'}">${formatCurrency(r.unpaid)}</strong></td>
      <td>
        ${r.unpaid > 0 ? `<button onclick="payReferrer('${escapeHtml(r.name)}', ${r.unpaid}, '${r.saleIds.join(',')}')" class="btn btn-primary btn-sm"><i class="fa-solid fa-money-bill-wave"></i> Pay ₹${r.unpaid.toLocaleString('en-IN')}</button>` : '<span class="badge badge-green"><i class="fa-solid fa-check"></i> Paid</span>'}
      </td>
    </tr>
  `).join('');
}

function renderSalesDetail() {
  const tbody = document.getElementById('sales-detail-body');
  const empty = document.getElementById('sales-empty');
  const wrapper = document.getElementById('sales-detail-wrapper');
  const count = document.getElementById('sales-count');

  if (filteredSales.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    count.textContent = '0 sales';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';
  count.textContent = filteredSales.length + ' sales';

  tbody.innerHTML = filteredSales.map(s => `
    <tr>
      <td>${formatDate(s.sale_date)}</td>
      <td><strong>${escapeHtml(s.customer_name || '-')}</strong><br><span class="text-xs text-gray-500">${s.customer_phone || ''}</span></td>
      <td><span class="badge badge-purple">${escapeHtml(s.referrer_name || '-')}</span></td>
      <td class="text-xs">—</td>
      <td><strong class="text-green-600">${formatCurrency(s.total_amount)}</strong></td>
      <td><strong class="text-purple-600">${formatCurrency(s.total_commission)}</strong></td>
    </tr>
  `).join('');
}

function renderPayments() {
  const tbody = document.getElementById('payments-body');
  const empty = document.getElementById('payments-empty');
  const wrapper = document.getElementById('payments-wrapper');

  if (!allPayments || allPayments.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';

  tbody.innerHTML = allPayments.map(p => `
    <tr>
      <td>${formatDate(p.paid_date)}</td>
      <td><strong class="text-purple-700">${escapeHtml(p.referrer_name)}</strong></td>
      <td><strong class="text-green-600">${formatCurrency(p.amount)}</strong></td>
      <td><span class="text-xs text-gray-500">${(p.sale_ids || []).length} sale(s)</span></td>
    </tr>
  `).join('');
}

async function payReferrer(name, amount, saleIdsStr) {
  const confirmed = await showConfirm(`Pay ₹${amount.toLocaleString('en-IN')} commission to <strong>${name}</strong>?`);
  if (!confirmed) return;

  try {
    const saleIds = saleIdsStr.split(',').filter(Boolean);
    const { error } = await db.from('referral_payments').insert({
      referrer_name: name,
      amount: amount,
      sale_ids: saleIds
    });
    if (error) throw error;

    showToast(`Paid ₹${amount.toLocaleString('en-IN')} to ${name}`);
    await loadReferralData();
    applyFilters();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function exportReferralCSV() {
  if (filteredSales.length === 0) { showToast('No data to export', 'error'); return; }

  const headers = ['Date', 'Customer', 'Phone', 'Referrer', 'Sale Total', 'Commission'];
  const rows = filteredSales.map(s => [
    new Date(s.sale_date).toLocaleDateString('en-IN'),
    s.customer_name || '',
    s.customer_phone || '',
    s.referrer_name || '',
    s.total_amount || 0,
    s.total_commission || 0
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `referrals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
