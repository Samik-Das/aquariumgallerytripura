// ===== Customer Points Logic =====

let allCustomers = [];
let filteredCustomers = [];

// Initialize
(async () => {
  await checkAuth();
  buildNavbar('Points');
  await loadCustomers();
  await loadPointsHistory();
})();

async function loadCustomers() {
  const { data } = await db.from('customers').select('*').order('name');
  allCustomers = data || [];
  filteredCustomers = [...allCustomers];
  renderCustomers();
  updateStats();
}

function updateStats() {
  const totalPoints = allCustomers.reduce((s, c) => s + (c.points || 0), 0);
  document.getElementById('stat-customers').textContent = allCustomers.length;
  document.getElementById('stat-total-points').textContent = totalPoints.toLocaleString('en-IN');
}

function filterCustomers() {
  const search = document.getElementById('search-input').value.toLowerCase().trim();
  filteredCustomers = allCustomers.filter(c => {
    return !search ||
      c.name.toLowerCase().includes(search) ||
      c.phone.includes(search);
  });
  renderCustomers();
}

function renderCustomers() {
  const tbody = document.getElementById('customer-body');
  const empty = document.getElementById('customer-empty');
  const wrapper = document.getElementById('customer-table-wrapper');
  const count = document.getElementById('customer-count');

  if (filteredCustomers.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    count.textContent = '0 customers';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';
  count.textContent = filteredCustomers.length + ' customers';

  tbody.innerHTML = filteredCustomers.map(c => {
    const canClaim = c.points >= 1000;
    const claimCount = Math.floor(c.points / 1000);
    return `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.phone}</td>
        <td>
          <div class="flex items-center gap-2">
            <span class="font-heading font-bold text-lg ${canClaim ? 'text-amber-500' : 'text-gray-600'}">${(c.points || 0).toLocaleString('en-IN')}</span>
            ${canClaim ? `<span class="badge badge-gold"><i class="fa-solid fa-gift"></i> ${claimCount} reward${claimCount > 1 ? 's' : ''} available</span>` : ''}
          </div>
        </td>
        <td>${formatDate(c.created_at)}</td>
        <td>
          ${canClaim
            ? `<button onclick="claimPoints('${c.id}', '${c.name}', ${c.points})" class="btn btn-gold btn-sm">
                <i class="fa-solid fa-gift"></i> Claim 1000 pts
              </button>`
            : `<span class="text-xs text-gray-400">${1000 - (c.points || 0)} more to claim</span>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

// ===== Claim Points =====
async function claimPoints(customerId, customerName, currentPoints) {
  const yes = await showConfirm(
    'Claim Reward Points',
    `<strong>${customerName}</strong> has <strong>${currentPoints.toLocaleString('en-IN')}</strong> points.<br><br>Deduct <strong>1000 points</strong>?<br>Remaining: <strong>${(currentPoints - 1000).toLocaleString('en-IN')}</strong> points`
  );

  if (!yes) return;

  try {
    const newPoints = currentPoints - 1000;

    await db.from('customers').update({ points: newPoints }).eq('id', customerId);

    await db.from('points_history').insert({
      customer_id: customerId,
      customer_name: customerName,
      points_change: -1000,
      type: 'claimed'
    });

    showToast(`1000 points claimed for ${customerName}! Remaining: ${newPoints}`);
    await loadCustomers();
    await loadPointsHistory();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== Points History =====
async function loadPointsHistory() {
  const { data } = await db.from('points_history').select('*').order('created_at', { ascending: false }).limit(100);

  const tbody = document.getElementById('history-body');
  const empty = document.getElementById('history-empty');
  const wrapper = document.getElementById('history-table-wrapper');

  // Count total claims for stat
  const claims = (data || []).filter(h => h.type === 'claimed').length;
  document.getElementById('stat-claims').textContent = claims;

  if (!data || data.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';

  tbody.innerHTML = data.map(h => `
    <tr>
      <td>${formatDateTime(h.created_at)}</td>
      <td><strong>${h.customer_name || '-'}</strong></td>
      <td>
        ${h.type === 'earned'
          ? '<span class="badge badge-green"><i class="fa-solid fa-arrow-up"></i> Earned</span>'
          : '<span class="badge badge-gold"><i class="fa-solid fa-gift"></i> Claimed</span>'
        }
      </td>
      <td class="font-bold ${h.type === 'earned' ? 'text-green-600' : 'text-amber-600'}">
        ${h.type === 'earned' ? '+' : ''}${h.points_change.toLocaleString('en-IN')}
      </td>
    </tr>
  `).join('');
}
