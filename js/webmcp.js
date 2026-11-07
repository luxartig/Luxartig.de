// WebMCP: exposes a few read-only tools (and page navigation) to in-browser AI agents.
// Nothing here submits forms or sends data anywhere.
;(function () {
  const mc = navigator.modelContext
  if (!mc || typeof mc.registerTool !== 'function') return

  const LANG = (document.documentElement.lang || 'de').slice(0, 2)
  const PRE = LANG === 'en' ? '/en' : LANG === 'ar' ? '/ar' : ''

  const T = {
    de: {
      info: 'Liefert Basisdaten zu Luxartig: wer, wo, wofür, Erreichbarkeit.',
      services: 'Listet die fünf Leistungen von Luxartig.',
      contact: 'Liefert alle Kontaktwege (Telefon, E-Mail, Adresse, Kontaktseite).',
      nav: 'Öffnet eine Seite der Website von Luxartig.',
      navPage: 'Zielseite',
      about: 'Luxartig ist der digitale Komplettpartner für Handwerk und Gastronomie in Passau und Umgebung, geführt von Aladin Almadhoun. Persönliche Betreuung mit festem Ansprechpartner, Antwort meist innerhalb von 24 Stunden an Werktagen, kostenloses unverbindliches Erstgespräch.',
      services_list: [
        'Design & Branding: Logo, Flyer, Visitenkarte, Stempel',
        'Social Media Management: Beiträge, Reels, Redaktionsplan, Community',
        'Website & Onlineshop: Hosting, Domain, SEO, GEO (Sichtbarkeit in Google und KI-Antworten)',
        'Digitale Visitenkarte: QR-Code, NFC',
        'Automatisierung: Chat, Kalender, Postfach, Follow-up',
      ],
      country: 'Deutschland',
    },
    en: {
      info: 'Returns basic facts about Luxartig: who, where, what, how to reach.',
      services: "Lists Luxartig's five services.",
      contact: 'Returns all ways to get in touch (phone, email, address, contact page).',
      nav: "Opens a page on Luxartig's website.",
      navPage: 'Target page',
      about: 'Luxartig is the digital all-in-one partner for trades and hospitality businesses in and around Passau, Germany, run by Aladin Almadhoun. Personal support with one fixed contact, usually a reply within 24 hours on business days, free no-obligation initial consultation.',
      services_list: [
        'Design & Branding: logo, flyer, business card, stamp',
        'Social Media Management: posts, reels, content calendar, community',
        'Website & Online Shop: hosting, domain, SEO, GEO (visibility in Google and AI answers)',
        'Digital Business Card: QR code, NFC',
        'Automation: chat, calendar, inbox, follow-up',
      ],
      country: 'Germany',
    },
    ar: {
      info: 'يعيد معلومات أساسية عن Luxartig: من نحن وأين ولأي غرض وكيف تصل إلينا.',
      services: 'يعرض خدمات Luxartig الخمس.',
      contact: 'يعيد جميع وسائل التواصل (الهاتف والبريد الإلكتروني والعنوان وصفحة التواصل).',
      nav: 'يفتح صفحة من موقع Luxartig.',
      navPage: 'الصفحة المطلوبة',
      about: 'Luxartig شريك رقمي متكامل لأصحاب الحرف والمطاعم في باساو وضواحيها، يديرها Aladin Almadhoun. دعم شخصي مع جهة اتصال ثابتة، ورد عادةً خلال 24 ساعة في أيام العمل، واستشارة أولى مجانية وبلا التزام.',
      services_list: [
        'التصميم والهوية البصرية: شعار، مطوية، بطاقة عمل، ختم',
        'إدارة وسائل التواصل الاجتماعي: منشورات، Reels، خطة محتوى، مجتمع',
        'الموقع الإلكتروني والمتجر: استضافة، نطاق، SEO، GEO (الظهور في جوجل وفي إجابات الذكاء الاصطناعي)',
        'البطاقة الرقمية: رمز QR، NFC',
        'الأتمتة: محادثة، تقويم، صندوق وارد، متابعة',
      ],
      country: 'ألمانيا',
    },
  }[LANG] || null
  if (!T) return

  const text = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] })
  const pages = {
    home: PRE + '/',
    services: PRE + '/#leistungen',
    contact: PRE + '/kontakt/',
    industries: PRE + '/branchen/',
    blog: PRE + '/blog/',
    about: PRE + '/ueber-uns/',
    imprint: PRE + '/impressum/',
    privacy: PRE + '/datenschutz/',
    terms: PRE + '/agb/',
  }
  const none = { type: 'object', properties: {} }

  const tools = [
    {
      name: 'get_business_info',
      description: T.info,
      inputSchema: none,
      annotations: { readOnlyHint: true },
      execute: async () => text({
        name: 'Luxartig',
        description: T.about,
        owner: 'Aladin Almadhoun',
        address: 'Am Sportfeld 10, 94121 Salzweg, ' + T.country,
        telephone: '+49 851 20153569',
        email: 'info@luxartig.de',
        website: 'https://luxartig.de' + PRE + '/',
      }),
    },
    {
      name: 'list_services',
      description: T.services,
      inputSchema: none,
      annotations: { readOnlyHint: true },
      execute: async () => text(T.services_list),
    },
    {
      name: 'get_contact_options',
      description: T.contact,
      inputSchema: none,
      annotations: { readOnlyHint: true },
      execute: async () => text({
        telephone: '+49 851 20153569',
        email: 'info@luxartig.de',
        address: 'Am Sportfeld 10, 94121 Salzweg, ' + T.country,
        contactPage: 'https://luxartig.de' + pages.contact,
      }),
    },
    {
      name: 'navigate_to_page',
      description: T.nav,
      inputSchema: {
        type: 'object',
        properties: { page: { type: 'string', enum: Object.keys(pages), description: T.navPage } },
        required: ['page'],
      },
      execute: async ({ page }) => {
        const href = pages[page]
        if (!href) return text('Unknown page: ' + page)
        window.location.href = href
        return text('Navigating to ' + href)
      },
    },
  ]

  tools.forEach((t) => {
    try { mc.registerTool(t) } catch (e) { /* tool already registered */ }
  })
})()
