// ===== Product Entry Logic =====

let allProducts = [];
let allCategories = [];
let productImageFile = null;

// Initialize
(async () => {
  await checkAuth();
  buildNavbar('Products');
  await Promise.all([loadDropdowns(), loadHistory()]);
})();

// ===== Load Dropdowns =====
async function loadDropdowns() {
  // Load products
  const { data: products } = await db.from('products').select('*').order('name');
  allProducts = products || [];

  const nameSelect = document.getElementById('product-name-select');
  nameSelect.innerHTML = '<option value="">-- Select Product --</option>';
  allProducts.forEach(p => {
    nameSelect.innerHTML += `<option value="${p.id}" data-category="${p.category}" data-sp="${p.selling_price}" data-bp="${p.buying_price}">${p.name} ${p.quantity > 0 ? `(Stock: ${p.quantity})` : '(Out of stock)'}</option>`;
  });

  // Load categories
  const { data: cats } = await db.from('categories').select('*').order('created_at');
  allCategories = cats || [];

  const catSelect = document.getElementById('category-select');
  catSelect.innerHTML = '<option value="">-- Select Category --</option>';
  allCategories.forEach(c => {
    catSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
  });

  makeSearchable('product-name-select');
  makeSearchable('category-select');
}

// When a product is selected from dropdown
function onProductSelect() {
  const select = document.getElementById('product-name-select');
  const option = select.options[select.selectedIndex];
  if (option && option.value) {
    const category = option.getAttribute('data-category');
    const sp = option.getAttribute('data-sp');
    const bp = option.getAttribute('data-bp');
    if (category) {
      document.getElementById('category-select').value = category;
      document.getElementById('category-select').syncSearchable();
    }
    if (sp && Number(sp) > 0) document.getElementById('selling-price').value = sp;
    if (bp && Number(bp) > 0) document.getElementById('buying-price').value = bp;
    // Load description for existing product
    const product = allProducts.find(p => p.id === option.value);
    document.getElementById('product-description').value = product?.description || '';
  }
}

// Image preview
function previewProductImage(event) {
  const file = event.target.files[0];
  if (file) {
    productImageFile = file;
    const preview = document.getElementById('image-preview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  }
}

// ===== Add New Name =====
function showAddNameModal() {
  document.getElementById('new-name-input').value = '';
  document.getElementById('name-modal').style.display = 'flex';
  document.getElementById('new-name-input').focus();
}

async function addNewName() {
  const name = document.getElementById('new-name-input').value.trim();
  if (!name) { showToast('Enter a product name', 'error'); return; }

  // Just add to dropdown (product gets created on save)
  const nameSelect = document.getElementById('product-name-select');
  const newOption = document.createElement('option');
  newOption.value = 'new:' + name;
  newOption.textContent = name + ' (New)';
  newOption.selected = true;
  nameSelect.appendChild(newOption);
  nameSelect.syncSearchable();

  document.getElementById('name-modal').style.display = 'none';
  showToast('Product name added! Fill in details and save.');
}

// ===== Add New Category =====
function showAddCategoryModal() {
  document.getElementById('new-category-input').value = '';
  document.getElementById('category-modal').style.display = 'flex';
  document.getElementById('new-category-input').focus();
}

async function addNewCategory() {
  const name = document.getElementById('new-category-input').value.trim();
  if (!name) { showToast('Enter a category name', 'error'); return; }

  try {
    // Check if exists
    const existing = allCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      await db.from('categories').insert({ name });
    }

    // Add to dropdown
    const catSelect = document.getElementById('category-select');
    const exists = Array.from(catSelect.options).find(o => o.value.toLowerCase() === name.toLowerCase());
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      catSelect.appendChild(opt);
    }
    catSelect.value = name;
    catSelect.syncSearchable();

    document.getElementById('category-modal').style.display = 'none';
    showToast('Category added!');
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== Save Product =====
async function saveProduct(e) {
  e.preventDefault();
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  const nameSelect = document.getElementById('product-name-select');
  const selectedValue = nameSelect.value;
  const category = document.getElementById('category-select').value;
  const buyingPrice = parseFloat(document.getElementById('buying-price').value);
  const sellingPrice = parseFloat(document.getElementById('selling-price').value);
  const quantity = parseInt(document.getElementById('quantity').value);
  const description = document.getElementById('product-description').value.trim();

  if (!selectedValue) { showToast('Select a product name', 'error'); resetBtn(); return; }
  if (!category) { showToast('Select a category', 'error'); resetBtn(); return; }
  if (!quantity || quantity < 1) { showToast('Enter valid quantity', 'error'); resetBtn(); return; }

  try {
    let productId;
    let productName;
    let imageUrl = null;

    // Upload image if provided
    if (productImageFile) {
      showToast('Uploading image...', 'info');
      imageUrl = await uploadImage(productImageFile);
    }

    if (selectedValue.startsWith('new:')) {
      // New product
      productName = selectedValue.replace('new:', '');

      // Ensure category exists
      const catExists = allCategories.find(c => c.name.toLowerCase() === category.toLowerCase());
      if (!catExists) {
        await db.from('categories').insert({ name: category });
      }

      const insertData = {
        name: productName,
        category,
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        quantity,
        description: description || null
      };
      if (imageUrl) insertData.image_url = imageUrl;

      const { data, error } = await db.from('products').insert(insertData).select().single();
      if (error) throw error;
      productId = data.id;
    } else {
      // Existing product - update quantity (ADD) and SP
      productId = selectedValue;
      const product = allProducts.find(p => p.id === productId);
      productName = product?.name || 'Unknown';

      const newQuantity = (product?.quantity || 0) + quantity;
      const updates = {
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        quantity: newQuantity,
        category,
        description: description || null,
        updated_at: new Date().toISOString()
      };
      if (imageUrl) updates.image_url = imageUrl;

      const { error } = await db.from('products').update(updates).eq('id', productId);
      if (error) throw error;
    }

    // Log the entry
    await db.from('product_entries').insert({
      product_id: productId,
      product_name: productName,
      category,
      buying_price: buyingPrice,
      selling_price: sellingPrice,
      quantity
    });

    showToast('Product saved successfully!');
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }

  resetBtn();
}

function resetBtn() {
  const btn = document.getElementById('save-btn');
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Product';
}

function resetForm() {
  document.getElementById('product-form').reset();
  document.getElementById('image-preview').style.display = 'none';
  productImageFile = null;
}

// ===== Load History =====
async function loadHistory() {
  const { data, error } = await db.from('product_entries').select('*').order('entry_date', { ascending: false }).limit(100);

  const tbody = document.getElementById('history-body');
  const empty = document.getElementById('history-empty');
  const count = document.getElementById('entry-count');

  if (!data || data.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    document.getElementById('history-table-wrapper').style.display = 'none';
    count.textContent = '0 entries';
    return;
  }

  empty.style.display = 'none';
  document.getElementById('history-table-wrapper').style.display = 'block';
  count.textContent = data.length + ' entries';

  tbody.innerHTML = data.map(e => `
    <tr>
      <td>${formatDate(e.entry_date)}</td>
      <td><strong>${e.product_name}</strong></td>
      <td><span class="badge badge-aqua">${e.category}</span></td>
      <td>${formatCurrency(e.buying_price)}</td>
      <td>${formatCurrency(e.selling_price)}</td>
      <td><strong>${e.quantity}</strong></td>
    </tr>
  `).join('');
}
