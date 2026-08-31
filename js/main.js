// ============ Header scroll state ============
const header = document.querySelector('.site-header')
function onScrollHeader() {
  if (!header) return
  header.classList.toggle('is-scrolled', window.scrollY > 12)
}
window.addEventListener('scroll', onScrollHeader, { passive: true })
onScrollHeader()

// ============ Mobile nav drawer ============
const burger = document.querySelector('.nav-burger')
const drawer = document.querySelector('.nav-drawer')
if (burger && drawer) {
  burger.addEventListener('click', () => drawer.classList.toggle('is-open'))
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => drawer.classList.remove('is-open')))
}

// ============ Reveal on scroll ============
// Elements are visible by default (see CSS). Only elements not yet on
// screen at setup time are marked "pending" and get a fade/rise-in once
// scrolled into view. A timeout safety net guarantees everything ends up
// visible even if IntersectionObserver never fires for some reason.
const revealEls = document.querySelectorAll('[data-reveal]')
if (revealEls.length && 'IntersectionObserver' in window) {
  const pending = []
  revealEls.forEach((el, i) => {
    const rect = el.getBoundingClientRect()
    if (rect.top > window.innerHeight * 1.05) {
      el.classList.add('is-pending')
      el.style.transitionDelay = (i % 4) * 70 + 'ms'
      pending.push(el)
    }
  })

  if (pending.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          io.unobserve(entry.target)
        }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    pending.forEach(el => io.observe(el))

    setTimeout(() => pending.forEach(el => el.classList.add('is-visible')), 4000)
  }
}

// ============ Footer year ============
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear() })

// ============ Package calculator ============
const calc = document.querySelector('[data-calculator]')
if (calc) {
  const fmt = (n) => n.toLocaleString('de-DE')

  const TIERS = {
    online: [
      { label: 'Keine Website', once: 0, monthly: 0, features: [] },
      { label: 'Website-System', once: 500, monthly: 21, features: ['Responsive Website', 'Profi-E-Mail-Adresse', 'SSL-Zertifikat', 'Hosting inklusive'] },
      { label: 'Onlineshop', once: 900, monthly: 71, features: ['Shop-System mit Produktverwaltung', 'Profi-E-Mail-Adresse', 'Zahlungsanbindung', 'Hosting & SSL inklusive'] },
    ],
    branding: [
      { label: 'Ohne Branding', once: 0, monthly: 0, features: [] },
      { label: 'Startup-Set', once: 700, monthly: 0, features: ['Logo-Design', 'Visitenkarten', 'Flyer & Stempel'] },
      { label: 'Erweitert', once: 1100, monthly: 0, features: ['Logo-Design', 'Visitenkarten', 'Flyer & Stempel', 'Erweiterte Drucksachen (Banner, Verpackung)'] },
    ],
    marketing: [
      { label: 'Nicht gebucht', once: 0, monthly: 0, features: [] },
      { label: 'Basis', once: 400, monthly: 0, features: ['Google-Business-Eintrag', 'Social-Media-Konto-Setup'] },
      { label: 'Aktiv', once: 400, monthly: 49, features: ['Google-Business-Eintrag', 'Social-Media-Konto-Setup', 'Laufendes Social-Media-Management', 'Anzeigen-Betreuung'] },
    ],
    automation: [
      { label: 'Manuell', once: 0, monthly: 0, features: [] },
      { label: 'Inbox & Kalender', once: 300, monthly: 15, features: ['Zentrales Postfach', 'Online-Terminkalender'] },
      { label: 'Voll-KI', once: 900, monthly: 39, features: ['Zentrales Postfach', 'Online-Terminkalender', 'KI-Chat-Assistent', 'Automatisierte Erinnerungen'] },
    ],
  }

  const sliders = {
    online: calc.querySelector('[data-slider="online"]'),
    branding: calc.querySelector('[data-slider="branding"]'),
    marketing: calc.querySelector('[data-slider="marketing"]'),
    automation: calc.querySelector('[data-slider="automation"]'),
  }

  function recommendedName(o, b, m, a) {
    if (o === 0 && b === 0 && m === 0 && a === 0) return 'Noch kein Paket gewählt'
    if (o === 1 && b === 1 && m === 1 && a === 0) return 'VIP-Paket'
    if (o === 1 && b === 1 && m === 0 && a === 0) return 'Standard-Paket'
    if (o === 1 && b === 0 && m === 0 && a === 0) return 'Web-Paket'
    if (o === 2 && b === 0 && m === 0 && a === 0) return 'Onlineshop-Paket'
    return 'Individuelles Setup'
  }

  function update() {
    const vals = {
      online: Number(sliders.online.value),
      branding: Number(sliders.branding.value),
      marketing: Number(sliders.marketing.value),
      automation: Number(sliders.automation.value),
    }

    let once = 0, monthly = 0
    const features = []
    Object.keys(vals).forEach(key => {
      const tier = TIERS[key][vals[key]]
      once += tier.once
      monthly += tier.monthly
      features.push(...tier.features)
      const slider = sliders[key]
      slider.style.setProperty('--pct', (vals[key] / 2) * 100 + '%')
      const valueEl = calc.querySelector(`[data-value="${key}"]`)
      if (valueEl) valueEl.textContent = tier.label
      const dot = calc.querySelector(`[data-dot="${key}"]`)
      if (dot) dot.classList.toggle('is-active', vals[key] > 0)
    })

    calc.querySelector('[data-rec-name]').textContent = recommendedName(vals.online, vals.branding, vals.marketing, vals.automation)
    calc.querySelector('[data-price-once]').textContent = fmt(once) + ' €'
    calc.querySelector('[data-price-monthly]').textContent = monthly > 0 ? fmt(monthly) + ' €' : '0 €'

    const list = calc.querySelector('[data-feature-list]')
    const uniqueFeatures = [...new Set(features)]
    list.innerHTML = uniqueFeatures.length
      ? uniqueFeatures.map(f => `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>${f}</li>`).join('')
      : '<li>Wähle deine Anforderungen mit den Reglern oben.</li>'
  }

  Object.values(sliders).forEach(s => s.addEventListener('input', update))
  update()
}

// ============ Contact form ============
const form = document.querySelector('[data-contact-form]')
if (form) {
  const status = form.querySelector('[data-form-status]')

  function setError(field, message) {
    const wrap = field.closest('.field')
    wrap.classList.toggle('has-error', Boolean(message))
    const err = wrap.querySelector('.field-error')
    if (err) err.textContent = message || ''
  }

  function validate() {
    let ok = true
    const name = form.querySelector('#name')
    const email = form.querySelector('#email')
    const branche = form.querySelector('#branche')

    if (!name.value.trim()) { setError(name, 'Bitte gib deinen Namen an.'); ok = false } else setError(name, '')

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())
    if (!emailOk) { setError(email, 'Bitte gib eine gültige E-Mail-Adresse an.'); ok = false } else setError(email, '')

    if (!branche.value) { setError(branche, 'Bitte wähle deine Branche.'); ok = false } else setError(branche, '')

    return ok
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    status.classList.remove('is-visible', 'ok', 'err')

    if (!validate()) {
      status.textContent = 'Bitte prüfe deine Angaben.'
      status.classList.add('is-visible', 'err')
      return
    }

    const data = Object.fromEntries(new FormData(form).entries())
    const subject = encodeURIComponent(`Anfrage über die Website – ${data.name}`)
    const bodyLines = [
      `Name: ${data.name}`,
      `E-Mail: ${data.email}`,
      `Telefon: ${data.telefon || '–'}`,
      `Branche: ${data.branche}`,
      '',
      'Nachricht:',
      data.nachricht || '–',
    ]
    const body = encodeURIComponent(bodyLines.join('\n'))
    window.location.href = `mailto:info@luxartig.de?subject=${subject}&body=${body}`

    status.textContent = 'Dein E-Mail-Programm öffnet sich gleich mit deiner Anfrage. Alternativ erreichst du uns direkt unter info@luxartig.de.'
    status.classList.add('is-visible', 'ok')
    form.reset()
  })
}
