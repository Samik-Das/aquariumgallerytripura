// ===== Catalogue Logic =====

let allProducts = [];
let filteredProducts = [];
let editImageFile = null;
let displayedCount = 0;
let categoryOrder = {};
const PAGE_SIZE = 21;

// Initialize
(async () => {
  await checkAuth();
  buildNavbar('Catalogue');
  await Promise.all([loadProducts(), loadCategoryFilter()]);
  applyUrlFilter();
})();

function applyUrlFilter() {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('category');
  const saved = sessionStorage.getItem('catalogue_filter_cat');
  if (cat) {
    document.getElementById('filter-category').value = cat;
  } else if (saved) {
    document.getElementById('filter-category').value = saved;
  }
  filterProducts();
}

async function loadProducts() {
  const { data } = await db.from('products').select('*').order('name');
  allProducts = data || [];
  updateStats();
}

async function loadCategoryFilter() {
  const { data } = await db.from('categories').select('name').order('created_at');
  const select = document.getElementById('filter-category');
  (data || []).forEach((c, i) => {
    categoryOrder[c.name] = i;
    select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
  });
}

function updateStats() {
  const total = allProducts.length;
  const stock = allProducts.reduce((s, p) => s + (p.quantity || 0), 0);
  const value = allProducts.reduce((s, p) => s + (p.selling_price || 0) * (p.quantity || 0), 0);
  const low = allProducts.filter(p => p.quantity > 0 && p.quantity < 5).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-stock').textContent = stock.toLocaleString('en-IN');
  document.getElementById('stat-value').textContent = '₹' + value.toLocaleString('en-IN');
  document.getElementById('stat-low').textContent = low;
}

function filterProducts() {
  const search = document.getElementById('search-input').value.toLowerCase().trim();
  const category = document.getElementById('filter-category').value;

  // Persist category filter across refresh
  if (category) sessionStorage.setItem('catalogue_filter_cat', category);
  else sessionStorage.removeItem('catalogue_filter_cat');

  filteredProducts = allProducts.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search);
    const matchCat = !category || p.category === category;
    return matchSearch && matchCat;
  });

  // Sort: in-stock grouped by category order first, then out-of-stock grouped by category order
  filteredProducts.sort((a, b) => {
    const aOut = a.quantity > 0 ? 0 : 1;
    const bOut = b.quantity > 0 ? 0 : 1;
    if (aOut !== bOut) return aOut - bOut;
    const aCat = categoryOrder[a.category] ?? 999;
    const bCat = categoryOrder[b.category] ?? 999;
    return aCat - bCat;
  });

  displayedCount = 0;
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  const empty = document.getElementById('products-empty');
  const wrapper = document.getElementById('load-more-wrapper');
  const countLabel = document.getElementById('load-more-count');

  if (filteredProducts.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    return;
  }

  empty.style.display = 'none';

  if (displayedCount === 0) grid.innerHTML = '';

  const nextBatch = filteredProducts.slice(displayedCount, displayedCount + PAGE_SIZE);
  grid.insertAdjacentHTML('beforeend', nextBatch.map(p => renderProductCard(p)).join(''));
  displayedCount += nextBatch.length;

  const remaining = filteredProducts.length - displayedCount;
  if (remaining > 0) {
    wrapper.style.display = 'block';
    countLabel.textContent = `Load ${remaining} More Products`;
  } else {
    wrapper.style.display = 'none';
  }
}

function loadMoreProducts() {
  renderProducts();
}

function renderProductCard(p) {
  const isLow = p.quantity > 0 && p.quantity < 5;
  const isOut = p.quantity <= 0;
  return `
    <div class="product-card ${isLow ? 'ring-1 ring-red-300' : ''}">
      <div class="product-image">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" decoding="async">`
          : `<div class="no-image"><i class="fa-solid fa-fish"></i></div>`
        }
        ${isLow ? '<div class="absolute top-1 left-1"><span class="badge badge-red" style="font-size:0.5rem;padding:1px 4px;"><i class="fa-solid fa-triangle-exclamation"></i> Low</span></div>' : ''}
        ${isOut ? '<div class="absolute top-1 left-1"><span class="badge badge-red" style="font-size:0.5rem;padding:1px 4px;"><i class="fa-solid fa-xmark"></i> Out</span></div>' : ''}
      </div>
      <div class="product-info">
        <div class="product-category">${p.category}</div>
        <div class="product-name">${p.name}</div>
        ${p.description ? `<div style="font-size:0.65rem;color:#94a3b8;line-height:1.3;min-height:2.8em;margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.description}</div>` : `<div style="font-size:0.65rem;min-height:2.8em;margin-bottom:2px;"></div>`}
        <div class="product-prices">
          <span class="product-sp">₹${Number(p.selling_price).toLocaleString('en-IN')}</span>
          <span class="product-bp">BP:₹${Number(p.buying_price).toLocaleString('en-IN')}</span>
        </div>
        <span class="product-qty ${isLow || isOut ? 'low-stock' : 'in-stock'}">
          ${isOut ? '✗ Out' : p.quantity + ' pcs'}
        </span>
        <div class="product-actions">
          <button onclick="openEditModal('${p.id}')" class="btn btn-primary btn-sm flex-1">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button onclick="deleteProduct('${p.id}')" class="btn btn-danger btn-sm">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ===== Edit Modal =====
async function openEditModal(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  // Load categories for dropdown
  const { data: categories } = await db.from('categories').select('name').order('name');
  const categorySelect = document.getElementById('edit-category');
  categorySelect.innerHTML = '<option value="">Select category...</option>';
  if (categories) {
    categories.forEach(cat => {
      categorySelect.innerHTML += `<option value="${cat.name}" ${cat.name === product.category ? 'selected' : ''}>${cat.name}</option>`;
    });
  }

  document.getElementById('edit-name').value = product.name || '';
  document.getElementById('edit-category').value = product.category || '';
  document.getElementById('edit-sp').value = product.selling_price;
  document.getElementById('edit-bp').value = product.buying_price;
  document.getElementById('edit-qty').value = product.quantity;
  document.getElementById('edit-description').value = product.description || '';
  document.getElementById('edit-product-id').value = id;
  editImageFile = null;
  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

document.getElementById('edit-image').addEventListener('change', (e) => {
  editImageFile = e.target.files[0] || null;
});

async function saveEditProduct() {
  const id = document.getElementById('edit-product-id').value;
  const name = document.getElementById('edit-name').value.trim();
  const category = document.getElementById('edit-category').value.trim();
  const sp = parseFloat(document.getElementById('edit-sp').value);
  const bp = parseFloat(document.getElementById('edit-bp').value);
  const qty = parseInt(document.getElementById('edit-qty').value);
  const description = document.getElementById('edit-description').value.trim();

  if (!name || !category || isNaN(sp) || isNaN(bp) || isNaN(qty)) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  try {
    const updates = {
      name,
      category,
      selling_price: sp,
      buying_price: bp,
      quantity: qty,
      description: description || null,
      updated_at: new Date().toISOString()
    };

    if (editImageFile) {
      showToast('Uploading image...', 'info');
      updates.image_url = await uploadImage(editImageFile);
    }

    const { error } = await db.from('products').update(updates).eq('id', id);
    if (error) throw error;

    closeEditModal();
    showToast('Product updated!');
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function deleteProduct(id) {
  const yes = await showConfirm('Delete Product', 'Are you sure? This will permanently delete this product.');
  if (!yes) return;

  try {
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) throw error;
    showToast('Product deleted');
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}
