// ===== Online Orders Admin Logic =====
let allOrders = [];

(async () => {
  await checkAuth();
  buildNavbar('Orders');
  await loadOrders();
})();

async function loadOrders() {
  const { data } = await db.from('online_orders').select('*').order('created_at', { ascending: false });
  allOrders = data || [];
  updateStats();
  renderOrders();
  renderHistory();
}

function updateStats() {
  document.getElementById('stat-pending').textContent = allOrders.filter(o => o.status === 'pending').length;
  document.getElementById('stat-confirmed').textContent = allOrders.filter(o => o.status === 'confirmed').length;
  document.getElementById('stat-delivered').textContent = allOrders.filter(o => o.status === 'delivered').length;
  document.getElementById('stat-declined').textContent = allOrders.filter(o => o.status === 'declined').length;
}

function renderOrders() {
  const filter = document.getElementById('filter-status').value;
  const search = document.getElementById('search-input').value.toLowerCase().trim();

  let filtered = allOrders;
  if (filter === 'active') filtered = allOrders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  else if (filter !== 'all') filtered = allOrders.filter(o => o.status === filter);

  if (search) {
    filtered = filtered.filter(o =>
      o.customer_name.toLowerCase().includes(search) ||
      o.customer_phone.includes(search)
    );
  }

  const container = document.getElementById('orders-cards');
  const empty = document.getElementById('orders-empty');

  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = filtered.map(o => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    const itemCount = items.reduce((s, i) => s + i.qty, 0);
    const statusBadge = getStatusBadge(o.status);
    const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    return `
      <div class="card" style="cursor:pointer;border-left:4px solid ${getStatusColor(o.status)};" onclick="viewOrder('${o.id}')">
        <div class="flex items-center justify-between mb-2">
          ${statusBadge}
          <span style="font-size:0.65rem;color:#94a3b8;">${date}</span>
        </div>
        <div class="mb-2">
          <div style="font-family:'Poppins',sans-serif;font-weight:700;font-size:0.9rem;color:#155e75;">${o.customer_name}</div>
          <div style="font-size:0.75rem;color:#64748b;">
            <i class="fa-solid fa-phone" style="font-size:0.6rem;"></i> ${o.customer_phone}
            <a href="tel:${o.customer_phone}" style="margin-left:6px;color:#0891b2;font-size:0.65rem;text-decoration:none;"><i class="fa-solid fa-phone-volume"></i> Call</a>
            <a href="https://wa.me/91${o.customer_phone.replace(/\D/g,'')}" target="_blank" style="margin-left:6px;color:#25D366;font-size:0.65rem;text-decoration:none;"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span style="font-size:0.75rem;color:#64748b;">${itemCount} item${itemCount > 1 ? 's' : ''}</span>
          <span style="font-family:'Poppins',sans-serif;font-weight:800;color:#059669;font-size:1rem;">₹${Number(o.total_amount).toLocaleString('en-IN')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderHistory() {
  const delivered = allOrders.filter(o => o.status === 'delivered' || o.status === 'declined');
  document.getElementById('history-count').textContent = delivered.length;
  const tbody = document.getElementById('history-body');

  if (delivered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:1rem;">No history yet</td></tr>';
    return;
  }

  tbody.innerHTML = delivered.map(o => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
    return `
      <tr onclick="viewOrder('${o.id}')" style="cursor:pointer;">
        <td>${date}</td>
        <td><strong>${o.customer_name}</strong></td>
        <td>${o.customer_phone}</td>
        <td>${items.length} items</td>
        <td style="font-weight:700;color:#059669;">₹${Number(o.total_amount).toLocaleString('en-IN')}</td>
        <td>${getStatusBadge(o.status)}</td>
      </tr>
    `;
  }).join('');
}

function viewOrder(id) {
  const o = allOrders.find(x => x.id === id);
  if (!o) return;

  const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
  const date = new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  document.getElementById('order-modal-body').innerHTML = `
    <div style="margin-bottom:1rem;">
      <div class="flex items-center justify-between mb-2">
        ${getStatusBadge(o.status)}
        <span style="font-size:0.7rem;color:#94a3b8;">${date}</span>
      </div>
      <div style="background:#f8fafc;border-radius:10px;padding:0.75rem;margin-bottom:0.75rem;">
        <div style="font-weight:700;font-size:0.95rem;color:#155e75;margin-bottom:2px;">${o.customer_name}</div>
        <div style="font-size:0.8rem;color:#64748b;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span><i class="fa-solid fa-phone"></i> ${o.customer_phone}</span>
          <a href="tel:${o.customer_phone}" style="color:#0891b2;text-decoration:none;font-weight:600;font-size:0.75rem;"><i class="fa-solid fa-phone-volume"></i> Call</a>
          <a href="https://wa.me/91${o.customer_phone.replace(/\D/g,'')}" target="_blank" style="color:#25D366;text-decoration:none;font-weight:600;font-size:0.75rem;"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
        </div>
      </div>
      <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Order Items</div>
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        ${items.map(i => `
          <div style="display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:0.8rem;">
            <span>${i.name} × ${i.qty}</span>
            <span style="font-weight:700;color:#059669;">₹${(i.price * i.qty).toLocaleString('en-IN')}</span>
          </div>
        `).join('')}
        <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#ecfdf5;font-weight:800;font-size:0.9rem;">
          <span>Total</span>
          <span style="color:#059669;">₹${Number(o.total_amount).toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  `;

  let actions = `<button class="btn btn-outline" onclick="document.getElementById('order-modal').style.display='none'">Close</button>`;

  if (o.status === 'pending') {
    actions += `
      <button class="btn btn-primary" onclick="updateOrderStatus('${o.id}','confirmed')"><i class="fa-solid fa-check"></i> Confirm Order</button>
      <button class="btn btn-danger" onclick="updateOrderStatus('${o.id}','declined')"><i class="fa-solid fa-xmark"></i> Decline</button>
    `;
  } else if (o.status === 'confirmed') {
    actions += `
      <button class="btn btn-primary" style="background:linear-gradient(135deg,#22c55e,#16a34a);" onclick="updateOrderStatus('${o.id}','delivered')"><i class="fa-solid fa-truck"></i> Mark Delivered</button>
    `;
  }

  document.getElementById('order-modal-actions').innerHTML = actions;
  document.getElementById('order-modal').style.display = 'flex';
}

async function updateOrderStatus(id, status) {
  const labels = { confirmed: 'Confirmed', declined: 'Declined', delivered: 'Delivered' };
  const yes = await showConfirm('Update Order', `Mark this order as <strong>${labels[status]}</strong>?`);
  if (!yes) return;

  try {
    await db.from('online_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    document.getElementById('order-modal').style.display = 'none';
    showToast(`Order ${labels[status]}!`);
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function getStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-gold"><i class="fa-solid fa-clock"></i> Pending</span>',
    confirmed: '<span class="badge badge-aqua"><i class="fa-solid fa-check-circle"></i> In Progress</span>',
    delivered: '<span class="badge badge-green"><i class="fa-solid fa-truck"></i> Delivered</span>',
    declined: '<span class="badge badge-red"><i class="fa-solid fa-xmark"></i> Declined</span>'
  };
  return map[status] || status;
}

function getStatusColor(status) {
  const map = { pending: '#f59e0b', confirmed: '#0891b2', delivered: '#22c55e', declined: '#dc2626' };
  return map[status] || '#94a3b8';
}
