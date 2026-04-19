// ===== Admin Reviews Logic =====

let _arRating = 0;

(async () => {
  buildNavbar('Reviews');
  await Promise.all([loadReviews(), loadProductsForReview()]);
})();

async function loadProductsForReview() {
  const { data } = await db.from('products').select('id,name').order('name');
  const select = document.getElementById('ar-product');
  if (!data) return;
  data.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

async function loadReviews() {
  const { data, error } = await db.from('reviews').select('*').order('created_at', { ascending: false });

  if (error || !data) {
    showToast('Failed to load reviews', 'error');
    return;
  }

  const pending  = data.filter(r => r.status === 'pending');
  const approved = data.filter(r => r.status === 'approved');

  // Stats
  document.getElementById('stat-pending').textContent  = pending.length;
  document.getElementById('stat-approved').textContent = approved.length;
  document.getElementById('pending-count').textContent  = pending.length;
  document.getElementById('approved-count').textContent = approved.length;

  const allRatings = data.map(r => r.rating).filter(Boolean);
  if (allRatings.length > 0) {
    const avg = (allRatings.reduce((s, r) => s + r, 0) / allRatings.length).toFixed(1);
    document.getElementById('stat-avg').textContent = avg + ' ★';
  }

  // Render pending
  const pendingList  = document.getElementById('pending-list');
  const pendingEmpty = document.getElementById('pending-empty');
  if (pending.length === 0) {
    pendingEmpty.style.display = 'block';
    pendingList.innerHTML = '';
  } else {
    pendingEmpty.style.display = 'none';
    pendingList.innerHTML = pending.map(r => renderReviewCard(r, 'pending')).join('');
  }

  // Render approved
  const approvedList  = document.getElementById('approved-list');
  const approvedEmpty = document.getElementById('approved-empty');
  if (approved.length === 0) {
    approvedEmpty.style.display = 'block';
    approvedList.innerHTML = '';
  } else {
    approvedEmpty.style.display = 'none';
    approvedList.innerHTML = approved.map(r => renderReviewCard(r, 'approved')).join('');
  }

}

function renderReviewCard(review, section) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const date = new Date(review.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Admin always sees the real name; anon badge indicates hidden on homepage
  const displayName = escapeHtml(review.reviewer_name || '—');
  const typeBadge = review.order_type === 'store'
    ? `<span class="badge badge-green text-xs"><i class="fa-solid fa-store"></i> Store</span>`
    : review.order_type === 'online'
    ? `<span class="badge badge-blue text-xs"><i class="fa-solid fa-globe"></i> Online</span>`
    : '';

  const bodyHtml = review.body
    ? `<p style="margin:4px 0 0;font-size:0.76rem;color:#64748b;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${escapeHtml(review.body)}"</p>`
    : '';
  const productHtml = review.product_name
    ? `<span style="font-size:0.7rem;color:#0891b2;background:#ecfeff;padding:1px 7px;border-radius:20px;margin-left:6px;"><i class="fa-solid fa-fish"></i> ${escapeHtml(review.product_name)}</span>`
    : '';
  let actions = '';
  if (section === 'pending') {
    actions = `
      <div class="flex gap-2 mt-2">
        <button onclick="approveReview('${review.id}')" class="btn btn-sm btn-success flex-1">
          <i class="fa-solid fa-circle-check"></i> Approve
        </button>
        <button onclick="deleteReview('${review.id}')" class="btn btn-sm btn-danger">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`;
  } else {
    actions = `
      <button onclick="deleteReview('${review.id}')" class="btn btn-sm btn-danger" style="margin-top:4px;padding:2px 10px;font-size:0.7rem;">
        <i class="fa-solid fa-trash"></i> Remove
      </button>`;
  }

  return `
    <div id="review-card-${review.id}" style="padding:8px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="font-heading font-bold text-sm text-gray-800">${displayName}</span>
          ${typeBadge}
          ${review.is_anonymous ? '<span class="badge text-xs" style="background:#f1f5f9;color:#64748b;"><i class="fa-solid fa-user-secret"></i> Anon</span>' : ''}
          ${productHtml}
          <span style="font-size:0.72rem;color:#f59e0b;letter-spacing:1px;margin-left:auto;">${stars}</span>
        </div>
        ${bodyHtml}
        <div class="text-xs text-gray-400" style="margin-top:2px;">${review.reviewer_phone || ''} · ${date}</div>
      </div>
      <div style="flex-shrink:0;">${actions}</div>
    </div>
  `;
}

async function approveReview(id) {
  const btn = document.querySelector(`#review-card-${id} .btn-success`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

  const { error } = await db.from('reviews').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    showToast('Failed to approve review', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Approve'; }
    return;
  }
  showToast('Review approved — now visible on homepage', 'success');
  await loadReviews();
}

async function deleteReview(id) {
  if (!confirm('Delete this review permanently?')) return;
  const { error } = await db.from('reviews').delete().eq('id', id);
  if (error) { showToast('Failed to delete review', 'error'); return; }
  showToast('Review deleted', 'success');
  await loadReviews();
}

// ===== Add Review Modal =====
function openAddReviewModal() {
  _arRating = 0;
  document.getElementById('ar-name').value = '';
  document.getElementById('ar-product').value = '';
  document.getElementById('ar-body').value = '';
  document.getElementById('ar-error').style.display = 'none';
  setArStars(0);
  document.getElementById('add-review-modal').style.display = 'flex';
}

function closeAddReviewModal() {
  document.getElementById('add-review-modal').style.display = 'none';
}

function setArStars(n) {
  _arRating = n;
  document.querySelectorAll('.ar-star').forEach((s, i) => {
    s.style.color = i < n ? '#f59e0b' : '#cbd5e1';
  });
}

async function submitAdminReview() {
  const errEl = document.getElementById('ar-error');
  errEl.style.display = 'none';

  const name = document.getElementById('ar-name').value.trim();
  const product = document.getElementById('ar-product').value;
  const body = document.getElementById('ar-body').value.trim();

  if (!name) { errEl.textContent = 'Please enter a name.'; errEl.style.display = 'block'; return; }
  if (_arRating === 0) { errEl.textContent = 'Please select a star rating.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('ar-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  const { error } = await db.from('reviews').insert({
    reviewer_name: name,
    product_name: product || null,
    rating: _arRating,
    body: body || null,
    is_anonymous: false,
    status: 'approved'
  });

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Save & Publish';

  if (error) {
    errEl.textContent = 'Failed to save. Please try again.';
    errEl.style.display = 'block';
    return;
  }

  closeAddReviewModal();
  showToast('Review published successfully', 'success');
  await loadReviews();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

