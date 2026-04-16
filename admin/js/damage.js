// ===== Damage Entry Logic =====

let allProducts = [];
let selectedProduct = null;

// Initialize
(async () => {
  await checkAuth();
  buildNavbar('Damage');
  await Promise.all([loadProducts(), loadDamageHistory()]);
})();

async function loadProducts() {
  const { data } = await db.from('products').select('*').gt('quantity', 0).order('name');
  allProducts = data || [];

  const select = document.getElementById('damage-product');
  select.innerHTML = '<option value="">-- Select Product --</option>';
  allProducts.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.name} (Stock: ${p.quantity})</option>`;
  });
}

function onDamageProductChange() {
  const productId = document.getElementById('damage-product').value;
  selectedProduct = allProducts.find(p => p.id === productId) || null;

  if (selectedProduct) {
    document.getElementById('damage-category').value = selectedProduct.category;
    document.getElementById('damage-stock').value = selectedProduct.quantity;
    document.getElementById('damage-bp').value = '₹' + Number(selectedProduct.buying_price).toLocaleString('en-IN');
  } else {
    document.getElementById('damage-category').value = '';
    document.getElementById('damage-stock').value = '';
    document.getElementById('damage-bp').value = '';
  }

  calculateDamageCost();
}

function calculateDamageCost() {
  const qty = parseInt(document.getElementById('damage-qty').value) || 0;
  if (selectedProduct && qty > 0) {
    const totalLoss = selectedProduct.buying_price * qty;
    document.getElementById('damage-total-bp').value = '₹' + totalLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  } else {
    document.getElementById('damage-total-bp').value = '';
  }
  calculateNewSP();
}

function calculateNewSP() {
  const autoFix = document.getElementById('auto-fix-sp').checked;
  const preview = document.getElementById('sp-preview');

  if (!autoFix || !selectedProduct) {
    preview.style.display = 'none';
    return;
  }

  const qty = parseInt(document.getElementById('damage-qty').value) || 0;
  if (qty <= 0 || qty >= selectedProduct.quantity) {
    preview.style.display = 'none';
    return;
  }

  preview.style.display = 'block';
  const oldSP = Number(selectedProduct.selling_price);
  const bp = Number(selectedProduct.buying_price);
  const remainingQty = selectedProduct.quantity - qty;
  const totalDamageCost = bp * qty;

  // New SP = Old SP + (Total damage cost / Remaining quantity)
  const newSP = oldSP + (totalDamageCost / remainingQty);

  document.getElementById('preview-old-sp').textContent = '₹' + oldSP.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('preview-new-sp').textContent = '₹' + newSP.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ===== Save Damage =====
async function saveDamage(e) {
  e.preventDefault();

  if (!selectedProduct) { showToast('Select a product', 'error'); return; }

  const qty = parseInt(document.getElementById('damage-qty').value);
  if (!qty || qty < 1) { showToast('Enter a valid quantity', 'error'); return; }
  if (qty > selectedProduct.quantity) { showToast('Damaged quantity exceeds stock', 'error'); return; }

  const autoFix = document.getElementById('auto-fix-sp').checked;
  const bp = Number(selectedProduct.buying_price);
  const oldSP = Number(selectedProduct.selling_price);
  const totalLoss = bp * qty;
  const remainingQty = selectedProduct.quantity - qty;

  let newSP = oldSP;
  if (autoFix && remainingQty > 0) {
    newSP = oldSP + (totalLoss / remainingQty);
  }

  const btn = document.getElementById('save-damage-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  try {
    // Record damage
    await db.from('damages').insert({
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      category: selectedProduct.category,
      quantity: qty,
      buying_price_per_item: bp,
      total_buying_price: totalLoss,
      auto_fix_sp: autoFix,
      old_sp: oldSP,
      new_sp: autoFix ? newSP : null
    });

    // Update product
    const updates = {
      quantity: remainingQty,
      updated_at: new Date().toISOString()
    };
    if (autoFix && remainingQty > 0) {
      updates.selling_price = Math.round(newSP * 100) / 100;
    }
    await db.from('products').update(updates).eq('id', selectedProduct.id);

    showToast(`Damage recorded! ${autoFix ? 'SP adjusted to ₹' + newSP.toFixed(2) : ''}`);
    resetDamageForm();
    await loadProducts();
    await loadDamageHistory();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Damage';
}

function resetDamageForm() {
  document.getElementById('damage-form').reset();
  selectedProduct = null;
  document.getElementById('damage-category').value = '';
  document.getElementById('damage-stock').value = '';
  document.getElementById('damage-bp').value = '';
  document.getElementById('damage-total-bp').value = '';
  document.getElementById('sp-preview').style.display = 'none';
}

// ===== Damage History =====
async function loadDamageHistory() {
  const { data } = await db.from('damages').select('*').order('damage_date', { ascending: false }).limit(100);

  const tbody = document.getElementById('damage-body');
  const empty = document.getElementById('damage-empty');
  const count = document.getElementById('damage-count');
  const wrapper = document.getElementById('damage-table-wrapper');

  if (!data || data.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    count.textContent = '0 records';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = 'block';
  count.textContent = data.length + ' records';

  tbody.innerHTML = data.map(d => `
    <tr>
      <td>${formatDate(d.damage_date)}</td>
      <td><strong>${d.product_name}</strong></td>
      <td><span class="badge badge-aqua">${d.category}</span></td>
      <td class="text-red-600 font-bold">${d.quantity}</td>
      <td>${formatCurrency(d.buying_price_per_item)}</td>
      <td class="text-red-600 font-bold">${formatCurrency(d.total_buying_price)}</td>
      <td>${d.auto_fix_sp ? '<span class="badge badge-green"><i class="fa-solid fa-check"></i> Yes</span>' : '<span class="badge badge-red">No</span>'}</td>
      <td>${d.new_sp ? formatCurrency(d.new_sp) : '-'}</td>
    </tr>
  `).join('');
}
