// ===== Homepage Admin Logic =====

let bannerData = null;
let categoryCards = [];
let socialLinks = [];
let carouselInterval = null;
let carouselPosition = 0;
let cardImageFile = null;

// Initialize
(async () => {
  await checkAuth();
  buildNavbar('Home');
  await loadBanner();
  await loadTicker();
  await loadCategoryCards();
  await loadProductCarousel();
  await loadSocialLinks();
  await loadContact();
})();

// ===== Ticker / Running Text =====
let tickerData = null;

async function loadTicker() {
  const { data } = await db.from('homepage_content').select('*').eq('type', 'ticker').maybeSingle();
  tickerData = data;
  const el = document.getElementById('ticker-text');
  if (data && data.description) {
    el.textContent = data.description;
  } else {
    el.textContent = 'No announcement set yet';
  }
}

function editTicker() {
  document.getElementById('ticker-input').value = tickerData?.description || '';
  document.getElementById('ticker-modal').style.display = 'flex';
}

async function saveTicker() {
  const text = document.getElementById('ticker-input').value.trim();
  if (!text) { showToast('Please enter announcement text', 'error'); return; }

  try {
    if (tickerData) {
      await db.from('homepage_content').update({ description: text, updated_at: new Date().toISOString() }).eq('id', tickerData.id);
    } else {
      await db.from('homepage_content').insert({ type: 'ticker', title: 'Ticker', description: text, sort_order: 0 });
    }
    document.getElementById('ticker-modal').style.display = 'none';
    showToast('Announcement updated!');
    await loadTicker();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== Banner =====
async function loadBanner() {
  const { data } = await db.from('homepage_content').select('*').eq('type', 'banner').single();
  bannerData = data;
  if (data) {
    document.getElementById('banner-title').textContent = data.title || 'AquariumGalleryTripura';
    document.getElementById('banner-slogan').textContent = data.description || 'Your one-stop destination for all aquarium needs';
    if (data.image_url) {
      const img = document.getElementById('banner-image');
      img.src = data.image_url;
      img.style.display = 'block';
    }
  }
}

function editBanner() {
  document.getElementById('banner-title-input').value = bannerData?.title || '';
  document.getElementById('banner-slogan-input').value = bannerData?.description || '';
  document.getElementById('banner-modal').style.display = 'flex';
}

function closeBannerModal() {
  document.getElementById('banner-modal').style.display = 'none';
}

async function saveBanner() {
  const title = document.getElementById('banner-title-input').value.trim();
  const description = document.getElementById('banner-slogan-input').value.trim();

  if (!title) { showToast('Please enter a title', 'error'); return; }

  try {
    if (bannerData?.id) {
      await db.from('homepage_content').update({ title, description, updated_at: new Date().toISOString() }).eq('id', bannerData.id);
    } else {
      await db.from('homepage_content').insert({ type: 'banner', title, description, sort_order: 0 });
    }
    closeBannerModal();
    showToast('Banner updated successfully!');
    await loadBanner();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function uploadBannerImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    showToast('Uploading image...', 'info');
    const url = await uploadImage(file);
    if (bannerData?.id) {
      await db.from('homepage_content').update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', bannerData.id);
    } else {
      await db.from('homepage_content').insert({ type: 'banner', title: 'AquariumGalleryTripura', image_url: url, sort_order: 0 });
    }
    showToast('Banner image updated!');
    await loadBanner();
  } catch (err) {
    showToast('Failed to upload image: ' + err.message, 'error');
  }
}

// ===== Category Cards (from categories table) =====
async function loadCategoryCards() {
  const { data } = await db.from('categories').select('*').order('name');
  categoryCards = data || [];
  renderCategoryCards();
}

function renderCategoryCards() {
  const container = document.getElementById('category-cards');
  const empty = document.getElementById('category-empty');

  if (categoryCards.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = categoryCards.map(card => `
    <div class="relative group rounded-xl overflow-hidden shadow-md border border-gray-100 transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer" style="min-height:240px;" onclick="window.location.href='catalogue.html?category=${encodeURIComponent(card.name)}'">
      <div class="h-40 bg-gradient-to-br from-cyan-50 to-amber-50 flex items-center justify-center overflow-hidden">
        ${card.image_url
          ? `<img src="${card.image_url}" alt="${card.name}" class="w-full h-full object-cover">`
          : `<i class="fa-solid fa-image text-4xl text-cyan-200"></i>`
        }
      </div>
      <div class="p-4">
        <h3 class="font-heading font-bold text-aqua-800 text-lg">${card.name || 'Untitled'}</h3>
        <p class="text-sm text-gray-500 mt-1 line-clamp-2">${card.description || ''}</p>
      </div>
      <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
        <button onclick="editCard('${card.id}')" class="w-8 h-8 rounded-lg bg-white/90 shadow flex items-center justify-center text-aqua-600 hover:bg-aqua-50">
          <i class="fa-solid fa-pen text-xs"></i>
        </button>
        <button onclick="deleteCard('${card.id}')" class="w-8 h-8 rounded-lg bg-white/90 shadow flex items-center justify-center text-red-500 hover:bg-red-50">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function addCategoryCard() {
  document.getElementById('card-modal-title').textContent = 'Add Card';
  document.getElementById('card-title-input').value = '';
  document.getElementById('card-desc-input').value = '';
  document.getElementById('card-edit-id').value = '';
  document.getElementById('card-image-preview').style.display = 'none';
  cardImageFile = null;
  document.getElementById('card-modal').style.display = 'flex';
}

function editCard(id) {
  const card = categoryCards.find(c => c.id === id);
  if (!card) return;
  document.getElementById('card-modal-title').textContent = 'Edit Card';
  document.getElementById('card-title-input').value = card.name || '';
  document.getElementById('card-desc-input').value = card.description || '';
  document.getElementById('card-edit-id').value = id;
  if (card.image_url) {
    document.getElementById('card-image-preview').src = card.image_url;
    document.getElementById('card-image-preview').style.display = 'block';
  } else {
    document.getElementById('card-image-preview').style.display = 'none';
  }
  cardImageFile = null;
  document.getElementById('card-modal').style.display = 'flex';
}

function closeCardModal() {
  document.getElementById('card-modal').style.display = 'none';
}

document.getElementById('card-image-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    cardImageFile = file;
    const preview = document.getElementById('card-image-preview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  }
});

async function saveCard() {
  const title = document.getElementById('card-title-input').value.trim();
  const description = document.getElementById('card-desc-input').value.trim();
  const editId = document.getElementById('card-edit-id').value;

  if (!title) { showToast('Please enter a title', 'error'); return; }

  try {
    let image_url = null;
    if (cardImageFile) {
      showToast('Uploading image...', 'info');
      image_url = await uploadImage(cardImageFile);
    }

    if (editId) {
      const updates = { name: title, description };
      if (image_url) updates.image_url = image_url;
      await db.from('categories').update(updates).eq('id', editId);
    } else {
      const newCard = { name: title, description };
      if (image_url) newCard.image_url = image_url;
      await db.from('categories').insert(newCard);
    }

    closeCardModal();
    showToast(editId ? 'Card updated!' : 'Card added!');
    await loadCategoryCards();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCard(id) {
  const yes = await showConfirm('Delete Card', 'Are you sure you want to delete this card?');
  if (!yes) return;

  try {
    await db.from('categories').delete().eq('id', id);
    showToast('Category deleted');
    await loadCategoryCards();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== Product Carousel =====
async function loadProductCarousel() {
  const { data } = await db.from('products').select('*').gt('quantity', 0).order('created_at', { ascending: false }).limit(20);
  const container = document.getElementById('product-carousel');
  const empty = document.getElementById('carousel-empty');

  if (!data || data.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  // Duplicate items for infinite scroll effect (only if more than 3 products)
  const items = data.length > 3 ? [...data, ...data] : data;
  container.innerHTML = items.map(p => `
    <div class="flex-shrink-0 w-64 bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
      <div class="h-36 bg-gradient-to-br from-cyan-50 to-amber-50 flex items-center justify-center overflow-hidden">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover">`
          : `<i class="fa-solid fa-fish text-3xl text-cyan-200"></i>`
        }
      </div>
      <div class="p-3">
        <h4 class="font-heading font-semibold text-sm text-aqua-800">${p.name}</h4>
        <p class="text-xs text-gray-400 uppercase">${p.category}</p>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="font-heading font-bold text-green-600">₹${Number(p.selling_price).toLocaleString('en-IN')}</span>
          <span class="text-xs ${p.quantity < 5 ? 'text-red-500 font-bold' : 'text-gray-400'}">${p.quantity} in stock</span>
        </div>
      </div>
    </div>
  `).join('');

  // Auto-scroll carousel
  startCarousel(data.length);
}

function startCarousel(totalItems) {
  if (carouselInterval) clearInterval(carouselInterval);
  const cardWidth = 272; // 256px card + 16px gap
  let position = 0;

  carouselInterval = setInterval(() => {
    position++;
    if (position >= totalItems) position = 0;
    const track = document.getElementById('product-carousel');
    if (track) {
      track.style.transform = `translateX(-${position * cardWidth}px)`;
    }
  }, 5000);
}

// ===== Social Links =====
const socialIcons = {
  'Facebook': 'fa-facebook',
  'Instagram': 'fa-instagram',
  'WhatsApp': 'fa-whatsapp',
  'YouTube': 'fa-youtube',
  'Twitter': 'fa-x-twitter',
  'Telegram': 'fa-telegram',
  'Other': 'fa-link'
};

const socialColors = {
  'Facebook': '#1877F2',
  'Instagram': '#E4405F',
  'WhatsApp': '#25D366',
  'YouTube': '#FF0000',
  'Twitter': '#000000',
  'Telegram': '#0088cc',
  'Other': '#0891b2'
};

async function loadSocialLinks() {
  const { data } = await db.from('homepage_content').select('*').eq('type', 'social_link').order('sort_order');
  socialLinks = data || [];
  renderSocialLinks();
}

function renderSocialLinks() {
  const container = document.getElementById('social-links');
  container.innerHTML = socialLinks.map(link => `
    <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl group hover:bg-white hover:shadow-md transition-all">
      <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl"
           style="background: ${socialColors[link.title] || '#0891b2'};">
        <i class="fa-brands ${socialIcons[link.title] || 'fa-solid fa-link'}"></i>
      </div>
      <div class="flex-1">
        <h4 class="font-heading font-semibold text-sm">${link.title}</h4>
        <p class="text-xs text-gray-400 truncate max-w-xs">${link.link || 'No link set'}</p>
      </div>
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="editSocialLink('${link.id}')" class="btn btn-sm btn-outline" style="padding:4px 10px;">
          <i class="fa-solid fa-pen text-xs"></i>
        </button>
        <button onclick="deleteSocialLink('${link.id}')" class="btn btn-sm btn-danger" style="padding:4px 10px;">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function addSocialLink() {
  document.getElementById('social-modal-title').textContent = 'Add Social Link';
  document.getElementById('social-platform-input').value = 'Facebook';
  document.getElementById('social-url-input').value = '';
  document.getElementById('social-edit-id').value = '';
  document.getElementById('social-modal').style.display = 'flex';
}

function editSocialLink(id) {
  const link = socialLinks.find(l => l.id === id);
  if (!link) return;
  document.getElementById('social-modal-title').textContent = 'Edit Social Link';
  document.getElementById('social-platform-input').value = link.title || 'Other';
  document.getElementById('social-url-input').value = link.link || '';
  document.getElementById('social-edit-id').value = id;
  document.getElementById('social-modal').style.display = 'flex';
}

function closeSocialModal() {
  document.getElementById('social-modal').style.display = 'none';
}

async function saveSocialLink() {
  const title = document.getElementById('social-platform-input').value;
  const link = document.getElementById('social-url-input').value.trim();
  const editId = document.getElementById('social-edit-id').value;

  try {
    if (editId) {
      await db.from('homepage_content').update({ title, link, updated_at: new Date().toISOString() }).eq('id', editId);
    } else {
      await db.from('homepage_content').insert({ type: 'social_link', title, link, sort_order: socialLinks.length + 1 });
    }
    closeSocialModal();
    showToast(editId ? 'Link updated!' : 'Link added!');
    await loadSocialLinks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSocialLink(id) {
  const yes = await showConfirm('Delete Link', 'Are you sure?');
  if (!yes) return;
  try {
    await db.from('homepage_content').delete().eq('id', id);
    showToast('Link deleted');
    await loadSocialLinks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== Contact Us =====
let contactData = null;

async function loadContact() {
  const { data } = await db.from('homepage_content').select('*').eq('type', 'contact').maybeSingle();
  contactData = data;
  const info = contactData ? JSON.parse(contactData.description || '{}') : {};
  document.getElementById('contact-address-preview').textContent = info.address || 'Not set';
  document.getElementById('contact-map-preview').textContent = info.map_link || 'Not set';
  document.getElementById('contact-phone-preview').textContent = info.phone || 'Not set';
  document.getElementById('contact-whatsapp-preview').textContent = info.whatsapp || 'Not set';
  document.getElementById('contact-hours-preview').textContent = info.hours || 'Not set';
  document.getElementById('contact-email-preview').textContent = info.email || 'Not set';
}

function editContact() {
  const info = contactData ? JSON.parse(contactData.description || '{}') : {};
  document.getElementById('contact-address-input').value = info.address || '';
  document.getElementById('contact-map-input').value = info.map_link || '';
  document.getElementById('contact-phone-input').value = info.phone || '';
  document.getElementById('contact-whatsapp-input').value = info.whatsapp || '';
  document.getElementById('contact-email-input').value = info.email || '';
  document.getElementById('contact-hours-input').value = info.hours || '';
  document.getElementById('contact-modal').style.display = 'flex';
}

async function saveContact() {
  const info = {
    address: document.getElementById('contact-address-input').value.trim(),
    map_link: document.getElementById('contact-map-input').value.trim(),
    phone: document.getElementById('contact-phone-input').value.trim(),
    whatsapp: document.getElementById('contact-whatsapp-input').value.trim(),
    email: document.getElementById('contact-email-input').value.trim(),
    hours: document.getElementById('contact-hours-input').value.trim()
  };

  try {
    if (contactData) {
      await db.from('homepage_content').update({
        description: JSON.stringify(info),
        updated_at: new Date().toISOString()
      }).eq('id', contactData.id);
    } else {
      await db.from('homepage_content').insert({
        type: 'contact',
        title: 'Contact Info',
        description: JSON.stringify(info),
        sort_order: 0
      });
    }
    document.getElementById('contact-modal').style.display = 'none';
    showToast('Contact info saved!');
    await loadContact();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
