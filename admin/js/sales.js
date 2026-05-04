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
  await Promise.all([loadProducts(), loadSalesHistory()]);
  addSaleItem(); // Add first item row
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
      document.getElementById('customer-name').readOnly = true;
      document.getElementById('customer-name').style.background = '#f0fdfa';
      document.getElementById('returning-badge').style.display = 'inline-flex';
      existingCustomerId = data.id;

      // Auto-populate referrer name from most recent referral sale
      const { data: lastReferral } = await db.from('sales')
        .select('referrer_name')
        .eq('customer_id', data.id)
        .eq('is_referral', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastReferral && lastReferral.referrer_name) {
        document.getElementById('referrer-name').value = lastReferral.referrer_name;
      }
    } else {
      document.getElementById('returning-badge').style.display = 'none';
      document.getElementById('customer-name').readOnly = false;
      document.getElementById('customer-name').style.background = '';
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
      <div class="flex items-center justify-between mb-2">
        <span class="badge badge-gold"><i class="fa-solid fa-box"></i> Item #${id}</span>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer text-sm font-medium text-purple-700">
            <input type="checkbox" id="item-referral-${id}" onchange="toggleReferralCommission(${id})" class="w-4 h-4 accent-purple-600">
            <i class="fa-solid fa-handshake"></i> Referral
          </label>
          ${saleItemCounter > 1 ? `<button onclick="removeSaleItem(${id})" class="btn btn-danger btn-sm btn-icon"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>
      </div>
      <!-- Product + Category row -->
      <div class="grid grid-cols-2 gap-2 mb-2">
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
      </div>
      <!-- SP + Actual SP + Qty + Discount row -->
      <div class="grid grid-cols-4 gap-2">
        <div class="form-group mb-0">
          <label class="form-label text-xs">Default SP</label>
          <input type="text" class="form-input" id="item-sp-${id}" readonly style="background:#f8fafc;">
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Actual SP</label>
          <input type="number" class="form-input" id="item-actual-sp-${id}" placeholder="₹" step="0.01" min="0" oninput="calculateTotal()">
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Qty</label>
          <input type="number" class="form-input" id="item-qty-${id}" placeholder="0" min="1" oninput="calculateTotal()">
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Discount (₹)</label>
          <input type="number" class="form-input" id="item-discount-${id}" placeholder="0" step="0.01" min="0" oninput="calculateTotal()">
        </div>
      </div>
      <!-- Referral Commission Row (hidden by default) -->
      <div class="mt-2 p-2 rounded-lg bg-purple-50 border border-purple-200" id="item-referral-row-${id}" style="display:none;">
        <div class="grid grid-cols-2 gap-2">
          <div class="form-group mb-0">
            <label class="form-label text-xs text-purple-700"><i class="fa-solid fa-percent"></i> Commission %</label>
            <input type="number" class="form-input" id="item-commission-pct-${id}" placeholder="e.g. 10" step="0.01" min="0" max="100" oninput="calculateTotal()">
          </div>
          <div class="form-group mb-0">
            <label class="form-label text-xs text-purple-700"><i class="fa-solid fa-indian-rupee-sign"></i> Commission</label>
            <input type="text" class="form-input" id="item-commission-amt-${id}" readonly style="background:#faf5ff;color:#7e22ce;font-weight:600;">
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('sale-items-container').insertAdjacentHTML('beforeend', html);
  saleItems.push(id);
  makeSearchable(`item-product-${id}`);
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
  let totalCommission = 0;
  let totalDiscount = 0;
  saleItems.forEach(id => {
    const qty = parseInt(document.getElementById(`item-qty-${id}`)?.value) || 0;
    const asp = parseFloat(document.getElementById(`item-actual-sp-${id}`)?.value) || 0;
    const discount = parseFloat(document.getElementById(`item-discount-${id}`)?.value) || 0;
    const itemTotal = qty * asp;
    total += itemTotal;
    totalDiscount += discount;

    // Calculate commission if referral checked
    const isRef = document.getElementById(`item-referral-${id}`)?.checked;
    if (isRef) {
      const pct = parseFloat(document.getElementById(`item-commission-pct-${id}`)?.value) || 0;
      const commAmt = (itemTotal * pct) / 100;
      totalCommission += commAmt;
      const amtEl = document.getElementById(`item-commission-amt-${id}`);
      if (amtEl) amtEl.value = '₹' + commAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }
  });

  const finalTotal = total - totalDiscount;
  document.getElementById('sale-total').textContent = '₹' + finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Show total discount if any
  let discEl = document.getElementById('total-discount-display');
  if (totalDiscount > 0) {
    if (!discEl) {
      const container = document.getElementById('sale-total').parentElement;
      container.insertAdjacentHTML('afterend', `
        <div id="total-discount-display" class="mt-2 text-right">
          <span class="text-sm font-heading font-bold text-orange-700"><i class="fa-solid fa-tag"></i> Total Discount:</span>
          <span class="text-lg font-heading font-extrabold text-orange-600 ml-2" id="discount-total">₹0.00</span>
        </div>
      `);
      discEl = document.getElementById('total-discount-display');
    }
    document.getElementById('discount-total').textContent = '₹' + totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    discEl.style.display = 'block';
  } else if (discEl) {
    discEl.style.display = 'none';
  }

  // Show total commission if any referral items
  let commEl = document.getElementById('total-commission-display');
  if (totalCommission > 0) {
    if (!commEl) {
      const container = document.getElementById('sale-total').parentElement;
      container.insertAdjacentHTML('afterend', `
        <div id="total-commission-display" class="mt-2 text-right">
          <span class="text-sm font-heading font-bold text-purple-700"><i class="fa-solid fa-handshake"></i> Total Commission:</span>
          <span class="text-lg font-heading font-extrabold text-purple-600 ml-2" id="commission-total">₹0.00</span>
        </div>
      `);
      commEl = document.getElementById('total-commission-display');
    }
    document.getElementById('commission-total').textContent = '₹' + totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    commEl.style.display = 'block';
  } else if (commEl) {
    commEl.style.display = 'none';
  }
}

function toggleReferralCommission(id) {
  const isChecked = document.getElementById(`item-referral-${id}`).checked;
  const row = document.getElementById(`item-referral-row-${id}`);
  if (row) {
    row.style.display = isChecked ? 'block' : 'none';
    if (!isChecked) {
      document.getElementById(`item-commission-pct-${id}`).value = '';
      document.getElementById(`item-commission-amt-${id}`).value = '';
    }
  }
  calculateTotal();
}

// ===== Save Sale =====
async function saveSale() {
  const phone = document.getElementById('customer-phone').value.trim();
  const name = document.getElementById('customer-name').value.trim();

  if (!phone || !name) { showToast('Enter customer phone and name', 'error'); return; }

  // Validate phone number - must be 10 digits
  const phoneClean = phone.replace(/\D/g, '');
  if (phoneClean.length !== 10) {
    showToast('Phone number must be exactly 10 digits', 'error');
    document.getElementById('customer-phone').focus();
    return;
  }

  // Validate items
  const items = [];
  let hasReferralItems = false;
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

    const isRef = document.getElementById(`item-referral-${id}`)?.checked || false;
    const commPct = isRef ? (parseFloat(document.getElementById(`item-commission-pct-${id}`)?.value) || 0) : 0;
    const commAmt = isRef ? ((actualSp * qty * commPct) / 100) : 0;
    const discount = parseFloat(document.getElementById(`item-discount-${id}`)?.value) || 0;
    if (isRef) hasReferralItems = true;

    items.push({
      product_id: productId,
      product_name: product.name,
      category: product.category,
      quantity: qty,
      selling_price: product.selling_price,
      actual_selling_price: actualSp,
      buying_price: product.buying_price,
      discount_amount: discount,
      is_referral: isRef,
      commission_percent: commPct,
      commission_amount: commAmt
    });
  }

  const referrerName = document.getElementById('referrer-name').value.trim();
  if (hasReferralItems && !referrerName) {
    showToast('Enter referrer name for referral items', 'error');
    document.getElementById('referrer-name').focus();
    return;
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
      } else {
        const { data: newCust, error } = await db.from('customers').insert({ name, phone, points: 0 }).select().single();
        if (error) throw error;
        customerId = newCust.id;
      }
    }

    // Calculate total
    const totalAmount = items.reduce((s, i) => s + i.actual_selling_price * i.quantity, 0);
    const totalCommission = items.reduce((s, i) => s + i.commission_amount, 0);
    const totalDiscount = items.reduce((s, i) => s + i.discount_amount, 0);

    // Create sale
    const { data: sale, error: saleErr } = await db.from('sales').insert({
      customer_id: customerId,
      customer_name: name,
      customer_phone: phone,
      total_amount: totalAmount - totalDiscount,
      total_discount: totalDiscount,
      is_referral: hasReferralItems,
      referrer_name: hasReferralItems ? referrerName : null,
      total_commission: totalCommission
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
    const pointsEarned = Math.floor(totalAmount - totalDiscount);
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

    showToast(`Sale saved! ${name} earned ${pointsEarned} points.${hasReferralItems ? ' Referral commission: ₹' + totalCommission.toLocaleString('en-IN') : ''}${totalDiscount > 0 ? ' Discount: ₹' + totalDiscount.toLocaleString('en-IN') : ''}`);
    setTimeout(() => window.location.reload(), 1000);
    document.getElementById('sale-items-container').innerHTML = '';
    saleItems = [];
    saleItemCounter = 0;
    addSaleItem();
    calculateTotal();
    const commDisplay = document.getElementById('total-commission-display');
    if (commDisplay) commDisplay.remove();
    const discDisplay = document.getElementById('total-discount-display');
    if (discDisplay) discDisplay.remove();

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
        <td>${s.total_discount > 0 ? `<strong class="text-orange-600">${formatCurrency(s.total_discount)}</strong>` : '<span class="text-gray-300">—</span>'}</td>
        <td>${s.is_referral ? `<span class="badge badge-purple text-xs">${s.referrer_name || '-'}</span>` : '<span class="text-gray-300">—</span>'}</td>
        <td>${s.total_commission > 0 ? `<strong class="text-purple-600">${formatCurrency(s.total_commission)}</strong>` : '<span class="text-gray-300">—</span>'}</td>
      </tr>
    `;
  }).join('');
}
