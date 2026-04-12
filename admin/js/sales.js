// ===== Sales Entry Logic =====

let allProducts = [];
let saleItems = [];
let saleItemCounter = 0;
let lookupTimer = null;
let existingCustomerId = null;

// Initialize
(async () => {
  await checkAuth();
  buildNavbar('Sales');
  await loadProducts();
  addSaleItem(); // Add first item row
  await loadSalesHistory();
})();

async function loadProducts() {
  const { data } = await db.from('products').select('*').order('name');
  allProducts = data || [];
}

// ===== Customer Lookup =====
function lookupCustomer() {
  clearTimeout(lookupTimer);
  const phone = document.getElementById('customer-phone').value.trim();
  if (phone.length < 3) {
    document.getElementById('returning-badge').style.display = 'none';
    existingCustomerId = null;
    return;
  }
  lookupTimer = setTimeout(async () => {
    const { data } = await db.from('customers').select('*').eq('phone', phone).single();
    if (data) {
      document.getElementById('customer-name').value = data.name;
      document.getElementById('returning-badge').style.display = 'inline-flex';
      existingCustomerId = data.id;
    } else {
      document.getElementById('returning-badge').style.display = 'none';
      existingCustomerId = null;
    }
  }, 500);
}

// ===== Sale Items =====
function addSaleItem() {
  saleItemCounter++;
  const id = saleItemCounter;

  const productOptions = allProducts.map(p =>
    `<option value="${p.id}" data-category="${p.category}" data-sp="${p.selling_price}" data-bp="${p.buying_price}" data-qty="${p.quantity}">${p.name} (Stock: ${p.quantity})</option>`
  ).join('');

  const html = `
    <div class="sale-item p-4 mb-3 rounded-xl bg-gray-50 border border-gray-100" id="sale-item-${id}">
      <div class="flex items-center justify-between mb-3">
        <span class="badge badge-gold"><i class="fa-solid fa-box"></i> Item #${id}</span>
        ${saleItemCounter > 1 ? `<button onclick="removeSaleItem(${id})" class="btn btn-danger btn-sm btn-icon"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="form-group mb-0">
          <label class="form-label text-xs">Product</label>
          <select class="form-select" id="item-product-${id}" onchange="onItemProductChange(${id})">
            <option value="">-- Select --</option>
            ${productOptions}
          </select>
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Category</label>
          <input type="text" class="form-input" id="item-category-${id}" readonly style="background:#f8fafc;">
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Default SP</label>
          <input type="text" class="form-input" id="item-sp-${id}" readonly style="background:#f8fafc;">
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Actual SP</label>
          <input type="number" class="form-input" id="item-actual-sp-${id}" placeholder="₹" step="0.01" min="0" oninput="calculateTotal()">
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Quantity</label>
          <input type="number" class="form-input" id="item-qty-${id}" placeholder="0" min="1" oninput="calculateTotal()">
        </div>
      </div>
    </div>
  `;

  document.getElementById('sale-items-container').insertAdjacentHTML('beforeend', html);
  saleItems.push(id);
}

function removeSaleItem(id) {
  const el = document.getElementById(`sale-item-${id}`);
  if (el) el.remove();
  saleItems = saleItems.filter(i => i !== id);
  calculateTotal();
}

function onItemProductChange(id) {
  const select = document.getElementById(`item-product-${id}`);
  const option = select.options[select.selectedIndex];
  if (option && option.value) {
    document.getElementById(`item-category-${id}`).value = option.getAttribute('data-category') || '';
    const sp = option.getAttribute('data-sp') || '0';
    document.getElementById(`item-sp-${id}`).value = '₹' + Number(sp).toLocaleString('en-IN');
    document.getElementById(`item-actual-sp-${id}`).value = sp;
    document.getElementById(`item-actual-sp-${id}`).placeholder = sp;
  }
  calculateTotal();
}

function calculateTotal() {
  let total = 0;
  saleItems.forEach(id => {
    const qty = parseInt(document.getElementById(`item-qty-${id}`)?.value) || 0;
    const asp = parseFloat(document.getElementById(`item-actual-sp-${id}`)?.value) || 0;
    total += qty * asp;
  });
  document.getElementById('sale-total').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ===== Save Sale =====
async function saveSale() {
  const phone = document.getElementById('customer-phone').value.trim();
  const name = document.getElementById('customer-name').value.trim();

  if (!phone || !name) { showToast('Enter customer phone and name', 'error'); return; }

  // Validate items
  const items = [];
  for (const id of saleItems) {
    const productId = document.getElementById(`item-product-${id}`)?.value;
    const qty = parseInt(document.getElementById(`item-qty-${id}`)?.value) || 0;
    const actualSp = parseFloat(document.getElementById(`item-actual-sp-${id}`)?.value) || 0;

    if (!productId || qty < 1) continue;

    const product = allProducts.find(p => p.id === productId);
    if (!product) continue;

    if (qty > product.quantity) {
      showToast(`Not enough stock for ${product.name}. Available: ${product.quantity}`, 'error');
      return;
    }

    items.push({
      product_id: productId,
      product_name: product.name,
      category: product.category,
      quantity: qty,
      selling_price: product.selling_price,
      actual_selling_price: actualSp,
      buying_price: product.buying_price
    });
  }

  if (items.length === 0) { showToast('Add at least one item', 'error'); return; }

  const btn = document.getElementById('save-sale-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  try {
    // Create or get customer
    let customerId = existingCustomerId;
    if (!customerId) {
      const { data: existing } = await db.from('customers').select('id').eq('phone', phone).single();
      if (existing) {
        customerId = existing.id;
        // Update name if changed
        await db.from('customers').update({ name }).eq('id', customerId);
      } else {
        const { data: newCust, error } = await db.from('customers').insert({ name, phone, points: 0 }).select().single();
        if (error) throw error;
        customerId = newCust.id;
      }
    }

    // Calculate total
    const totalAmount = items.reduce((s, i) => s + i.actual_selling_price * i.quantity, 0);

    // Create sale
    const { data: sale, error: saleErr } = await db.from('sales').insert({
      customer_id: customerId,
      customer_name: name,
      customer_phone: phone,
      total_amount: totalAmount
    }).select().single();
    if (saleErr) throw saleErr;

    // Insert sale items
    const saleItemsData = items.map(i => ({ sale_id: sale.id, ...i }));
    const { error: itemsErr } = await db.from('sale_items').insert(saleItemsData);
    if (itemsErr) throw itemsErr;

    // Update product quantities
    for (const item of items) {
      const product = allProducts.find(p => p.id === item.product_id);
      if (product) {
        await db.from('products').update({
          quantity: product.quantity - item.quantity,
          updated_at: new Date().toISOString()
        }).eq('id', item.product_id);
      }
    }

    // Award loyalty points (1 point per ₹1 spent, capped per 1000)
    const pointsEarned = Math.floor(totalAmount);
    if (pointsEarned > 0) {
      // Get current points
      const { data: cust } = await db.from('customers').select('points').eq('id', customerId).single();
      const newPoints = (cust?.points || 0) + pointsEarned;
      await db.from('customers').update({ points: newPoints }).eq('id', customerId);

      // Log points
      await db.from('points_history').insert({
        customer_id: customerId,
        customer_name: name,
        points_change: pointsEarned,
        type: 'earned',
        sale_id: sale.id
      });
    }

    showToast(`Sale saved! ${name} earned ${pointsEarned} points.`);

    // Reset form
    document.getElementById('customer-phone').value = '';
    document.getElementById('customer-name').value = '';
    document.getElementById('returning-badge').style.display = 'none';
    existingCustomerId = null;
    document.getElementById('sale-items-container').innerHTML = '';
    saleItems = [];
    saleItemCounter = 0;
    addSaleItem();
    calculateTotal();

    await loadProducts();
    await loadSalesHistory();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Sale';
}

// ===== Sales History =====
async function loadSalesHistory() {
  const { data: sales } = await db.from('sales').select('*').order('sale_date', { ascending: false }).limit(100);

  const tbody = document.getElementById('sales-body');
  const empty = document.getElementById('sales-empty');
  const count = document.getElementById('sales-count');
  const wrapper = document.getElementById('sales-table-wrapper');

  if (!sales || sales.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    count.textContent = '0 sales';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';
  count.textContent = sales.length + ' sales';

  // Get sale items for each sale
  const saleIds = sales.map(s => s.id);
  const { data: allSaleItems } = await db.from('sale_items').select('*').in('sale_id', saleIds);

  tbody.innerHTML = sales.map(s => {
    const items = (allSaleItems || []).filter(i => i.sale_id === s.id);
    const itemNames = items.map(i => `${i.product_name} ×${i.quantity}`).join(', ');
    return `
      <tr>
        <td>${formatDate(s.sale_date)}</td>
        <td><strong>${s.customer_name || '-'}</strong></td>
        <td>${s.customer_phone || '-'}</td>
        <td class="text-xs max-w-xs truncate">${itemNames || '-'}</td>
        <td><strong class="text-green-600">${formatCurrency(s.total_amount)}</strong></td>
      </tr>
    `;
  }).join('');
}
