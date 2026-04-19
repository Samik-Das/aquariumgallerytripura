(function () {
  // Inject style: only show on tablet/mobile (max 1024px)
  const style = document.createElement('style');
  style.textContent = '#wa-floater{display:none!important;}@media(max-width:1024px){#wa-floater.wa-visible{display:flex!important;}}';
  document.head.appendChild(style);

  const btn = document.createElement('a');
  btn.id = 'wa-floater';
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.title = 'Chat on WhatsApp';
  btn.style.cssText = [
    'display:none',
    'position:fixed',
    'bottom:72px',
    'right:20px',
    'z-index:9998',
    'width:54px',
    'height:54px',
    'background:#25D366',
    'border-radius:50%',
    'align-items:center',
    'justify-content:center',
    'box-shadow:0 4px 18px rgba(37,211,102,0.45)',
    'font-size:1.6rem',
    'color:white',
    'text-decoration:none',
    'transition:transform 0.18s,box-shadow 0.18s'
  ].join(';');
  btn.innerHTML = '<i class="fa-brands fa-whatsapp"></i>';
  btn.addEventListener('mouseenter', function () {
    btn.style.transform = 'scale(1.12)';
    btn.style.boxShadow = '0 6px 26px rgba(37,211,102,0.6)';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 18px rgba(37,211,102,0.45)';
  });

  function show(href) {
    btn.href = href;
    btn.classList.add('wa-visible');
  }

  async function init() {
    // 1. Try social links (title = 'WhatsApp')
    const { data: socials } = await db
      .from('homepage_content')
      .select('title,link')
      .eq('type', 'social_link');
    const waEntry = socials && socials.find(function (s) {
      return s.title === 'WhatsApp' && s.link;
    });
    if (waEntry) { show(waEntry.link); return; }

    // 2. Fallback: contact info whatsapp number
    const { data: contactRow } = await db
      .from('homepage_content')
      .select('description')
      .eq('type', 'contact')
      .maybeSingle();
    if (contactRow && contactRow.description) {
      try {
        const info = JSON.parse(contactRow.description);
        if (info.whatsapp) {
          const num = info.whatsapp.replace(/\D/g, '');
          show('https://wa.me/' + num);
        }
      } catch (e) {}
    }
  }

  // Append button then initialise
  if (document.body) {
    document.body.appendChild(btn);
    init();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(btn);
      init();
    });
  }
})();
