// ===== Shared Components for Admin Panel =====

// Build Navbar
function buildNavbar(activePage) {
  const pages = [
    { name: 'Home', href: 'index.html', icon: 'fa-house' },
    { name: 'Products', href: 'products.html', icon: 'fa-box' },
    { name: 'Catalogue', href: 'catalogue.html', icon: 'fa-store' },
    { name: 'Sales', href: 'sales.html', icon: 'fa-cash-register' },
    { name: 'Damage', href: 'damage.html', icon: 'fa-triangle-exclamation' },
    { name: 'Points', href: 'points.html', icon: 'fa-star' },
    { name: 'Referrals', href: 'referrals.html', icon: 'fa-handshake' },
    { name: 'Dashboard', href: 'dashboard.html', icon: 'fa-chart-line' },
  ];

  const nav = document.createElement('nav');
  nav.className = 'navbar';
  nav.innerHTML = `
    <div class="navbar-inner">
      <a href="index.html" class="navbar-logo">
        <img src="icons/logo.jpeg" alt="AGT" class="navbar-logo-icon" style="width:40px;height:40px;border-radius:10px;object-fit:cover;border:2px solid rgba(103,232,249,0.5);box-shadow:0 0 8px rgba(6,182,212,0.3);">
        <span>AquariumGalleryTripura</span>
      </a>
      <button class="navbar-toggle" onclick="document.querySelector('.navbar-links').classList.toggle('open')">
        <i class="fa-solid fa-bars"></i>
      </button>
      <div class="navbar-links">
        ${pages.map(p => `
          <a href="${p.href}" class="${activePage === p.name ? 'active' : ''}">
            <i class="fa-solid ${p.icon}"></i>
            ${p.name}
          </a>
        `).join('')}
        <a href="#" class="navbar-logout" onclick="signOut(); return false;">
          <i class="fa-solid fa-right-from-bracket"></i>
          Logout
        </a>
      </div>
    </div>
  `;

  document.body.prepend(nav);
}

// Toast Notification
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    info: 'fa-circle-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${message}`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// Confirmation Modal
function showConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3><i class="fa-solid fa-circle-question" style="color: var(--gold-500);"></i> ${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="btn btn-outline" id="modal-no">No</button>
          <button class="btn btn-primary" id="modal-yes">Yes</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modal-yes').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#modal-no').onclick = () => { overlay.remove(); resolve(false); };
  });
}

// Loading State
function showLoading(container) {
  container.innerHTML = `
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>Loading...</span>
    </div>
  `;
}

// Format currency
function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format date
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// Upload image to Supabase Storage
async function uploadImage(file, bucket = 'product_image') {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await db.storage.from(bucket).upload(filePath, file);
  if (error) throw error;

  const { data: { publicUrl } } = db.storage.from(bucket).getPublicUrl(filePath);
  return publicUrl;
}

// Empty state component
function emptyState(icon, title, message) {
  return `
    <div class="empty-state">
      <i class="fa-solid ${icon}"></i>
      <h3>${title}</h3>
      <p>${message}</p>
    </div>
  `;
}

// Debounce helper
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
