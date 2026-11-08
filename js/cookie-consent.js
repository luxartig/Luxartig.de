// ============ Cookie consent ============
// Necessary storage (the consent choice itself) needs no permission.
// The booking-calendar embed sets cookies from leadconnectorhq.com / msgsndr.com
// and only loads after the visitor accepts. (The website chat is our own
// system.luxartig.de widget and is included directly in each page.)
;(function () {
  const KEY = 'luxartig_cookie_consent'

  function getConsent() {
    try { return localStorage.getItem(KEY) } catch (e) { return null }
  }
  function setConsent(value) {
    try { localStorage.setItem(KEY, value) } catch (e) {}
  }

  function loadScript(src, attrs) {
    if (document.querySelector('script[src="' + src + '"]')) return
    const s = document.createElement('script')
    s.src = src
    if (attrs) Object.keys(attrs).forEach((k) => s.setAttribute(k, attrs[k]))
    document.body.appendChild(s)
  }

  function loadExternalServices() {
    document.querySelectorAll('[data-calendar-placeholder]').forEach((el) => {
      const src = el.getAttribute('data-src')
      const iframe = document.createElement('iframe')
      iframe.src = src
      iframe.style.cssText = 'width:100%;border:none;overflow:hidden;min-height:650px;'
      iframe.scrolling = 'no'
      el.replaceWith(iframe)
      loadScript('https://link.msgsndr.com/js/form_embed.js')
    })
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  ready(function () {
    const banner = document.querySelector('[data-cookie-banner]')

    function showBanner() { if (banner) banner.classList.add('is-visible') }
    function hideBanner() { if (banner) banner.classList.remove('is-visible') }

    const consent = getConsent()
    if (consent === 'all') {
      loadExternalServices()
    } else if (consent !== 'necessary') {
      showBanner()
    }

    if (banner) {
      const acceptBtn = banner.querySelector('[data-cookie-accept]')
      const necessaryBtn = banner.querySelector('[data-cookie-necessary]')
      if (acceptBtn) acceptBtn.addEventListener('click', () => {
        setConsent('all'); loadExternalServices(); hideBanner()
      })
      if (necessaryBtn) necessaryBtn.addEventListener('click', () => {
        setConsent('necessary'); hideBanner()
      })
    }

    document.querySelectorAll('[data-cookie-settings]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.preventDefault(); showBanner() })
    })

    document.querySelectorAll('[data-cookie-load-calendar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setConsent('all'); loadExternalServices(); hideBanner()
      })
    })
  })
})()
