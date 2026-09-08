// ============================================================================
// Scroll choreography, chapter HUD, menu, cursor and the small "diorama"
// demos next to the service list. Everything degrades gracefully: if GSAP
// fails to load, the page is still fully readable and navigable.
// ============================================================================
;(function () {
  const $ = (s, r) => (r || document).querySelector(s)
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)]
  const HAS_GSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined'
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const FINE = window.matchMedia('(pointer: fine)').matches

  if (HAS_GSAP) gsap.registerPlugin(ScrollTrigger)

  // ---------------------------------------------------------------- year --
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear() })

  // --------------------------------------------------------------- clock --
  const clockEl = $('[data-clock]')
  if (clockEl) {
    const tick = () => {
      const t = new Date().toLocaleTimeString('de-DE', {
        timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
      clockEl.textContent = t
    }
    tick()
    setInterval(tick, 1000)
  }

  // ---------------------------------------------------------------- menu --
  const menuBtn = $('[data-menu-btn]')
  if (menuBtn) {
    const label = $('[data-menu-label]', menuBtn)
    const setLabel = () => { if (label) label.textContent = document.body.classList.contains('menu-open') ? 'CLOSE' : 'MENU' }
    menuBtn.addEventListener('click', () => {
      document.body.classList.toggle('menu-open')
      setLabel()
    })
    $$('.menu-ov a').forEach((a) => a.addEventListener('click', () => {
      document.body.classList.remove('menu-open')
      setLabel()
    }))
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
        document.body.classList.remove('menu-open'); setLabel()
      }
    })
  }

  // -------------------------------------------------------------- cursor --
  if (FINE && !REDUCED) {
    const cur = document.createElement('div')
    cur.className = 'cur'
    document.body.appendChild(cur)
    let cx = 0, cy = 0, tx = 0, ty = 0
    window.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY
      document.body.classList.add('cur-on')
    }, { passive: true })
    const loop = () => {
      cx += (tx - cx) * 0.18
      cy += (ty - cy) * 0.18
      cur.style.transform = `translate(${cx}px, ${cy}px)`
      requestAnimationFrame(loop)
    }
    loop()
    const hot = 'a, button, summary, .srow, #coreCv'
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hot)) document.body.classList.add('cur-hot')
    })
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hot)) document.body.classList.remove('cur-hot')
    })
  }

  // ----------------------------------------------- chapter HUD + theming --
  const chapters = $$('[data-sec]')
  const hudNo = $('[data-hud-no]')
  const hudName = $('[data-hud-name]')
  const hudBar = $('[data-hud-bar]')
  const total = String(chapters.length).padStart(2, '0')
  const globeSec = $('[data-globe]')

  // Reading seven rects per scroll event is cheap, and doing it synchronously
  // keeps the header/HUD correct even where rAF is throttled to a standstill.
  function readChapters() {
    // The chapter under the header line owns the HUD and the header colour.
    let current = chapters[0]
    for (const c of chapters) {
      const r = c.getBoundingClientRect()
      if (r.top <= 80 && r.bottom > 80) { current = c; break }
      if (r.top > 80) break
      current = c
    }
    if (current) {
      if (hudNo) hudNo.textContent = `${current.dataset.sec} / ${total}`
      if (hudName) hudName.textContent = current.dataset.name || ''
      document.body.classList.toggle('is-light', current.hasAttribute('data-light'))
    }
    if (hudBar) {
      const max = document.documentElement.scrollHeight - window.innerHeight
      hudBar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`
    }

    // Arrival on the "Standort" chapter. Driven purely by scroll position so
    // the address and phone number appear even without WebGL or animation.
    if (globeSec) {
      const r = globeSec.getBoundingClientRect()
      const span = r.height - window.innerHeight
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : (r.top <= 0 ? 1 : 0)
      globeSec.classList.toggle('is-arrived', p > 0.74)
    }
  }
  window.addEventListener('scroll', readChapters, { passive: true })
  window.addEventListener('resize', readChapters, { passive: true })
  readChapters()

  // --------------------------------------------------------------- rise ---
  const rise = $$('[data-rise]')
  if (rise.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target) }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' })
    rise.forEach((el, i) => { el.style.transitionDelay = (i % 5) * 60 + 'ms'; io.observe(el) })
    setTimeout(() => rise.forEach((el) => el.classList.add('in')), 4500)
  } else {
    rise.forEach((el) => el.classList.add('in'))
  }

  // ----------------------------------------------------------- odometers --
  // Each digit is a column 0-9 that rolls up to its final value. The digits
  // are written out immediately, so the number is correct and readable even
  // if the roll never plays.
  $$('[data-odo]').forEach((el) => {
    const pad = el.dataset.pad ? parseInt(el.dataset.pad, 10) : 0
    let digits = String(Math.round(parseFloat(el.dataset.odo) || 0))
    while (digits.length < pad) digits = '0' + digits

    const cols = []
    el.textContent = ''
    digits.split('').forEach((d) => {
      const wrap = document.createElement('span')
      wrap.className = 'odo-d'
      const strip = document.createElement('b')
      // 0-9 twice over, so every digit gets a full turn before it lands
      for (let r = 0; r < 2; r++) {
        for (let n = 0; n <= 9; n++) {
          const i = document.createElement('i')
          i.textContent = String(n)
          strip.appendChild(i)
        }
      }
      const final = document.createElement('i')
      final.textContent = d
      strip.appendChild(final)
      wrap.appendChild(strip)
      el.appendChild(wrap)
      cols.push({ strip, total: 21 })
    })

    // Land on the last cell straight away; the roll is the animation back
    // from the top, added only once the cell is on screen.
    const settle = () => cols.forEach(({ strip, total }) => {
      strip.style.transform = `translateY(${-(total - 1) * 100}%)`
    })
    const roll = () => {
      cols.forEach(({ strip }, i) => {
        strip.style.transition = 'none'
        strip.style.transform = 'translateY(0)'
        void strip.offsetWidth
        strip.style.transition = `transform ${1.5 + i * 0.18}s cubic-bezier(.16,1,.3,1)`
      })
      requestAnimationFrame(settle)
    }

    settle()
    if (REDUCED || !('IntersectionObserver' in window)) return
    const cell = el.closest('.why-cell')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return
        io.unobserve(el)
        if (cell) cell.classList.add('is-counted')
        roll()
      })
    }, { threshold: 0.5 })
    io.observe(el)
    setTimeout(() => { if (cell) cell.classList.add('is-counted') }, 6000)
  })

  // ------------------------------------------------- service + dioramas ---
  const rows = $$('[data-srow]')
  const dios = $$('[data-dio]')
  function activate(i) {
    rows.forEach((r, k) => r.classList.toggle('is-active', k === i))
    dios.forEach((d, k) => {
      if (k === i) {
        // restart the CSS keyframes so the demo replays on every switch
        d.classList.remove('is-on')
        void d.offsetWidth
        d.classList.add('is-on')
      } else {
        d.classList.remove('is-on')
      }
    })
  }
  if (rows.length) {
    rows.forEach((r, i) => {
      r.addEventListener('mouseenter', () => activate(i))
      r.addEventListener('focusin', () => activate(i))
    })
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) activate(rows.indexOf(en.target))
        })
      }, { threshold: 0.6 })
      rows.forEach((r) => io.observe(r))
    }
    activate(0)
  }

  // ------------------------------------------------------------ spotlight --
  const spot = $('[data-spot]')
  const glow = $('[data-spot-glow]')
  if (spot && glow && FINE) {
    spot.addEventListener('mousemove', (e) => {
      const r = spot.getBoundingClientRect()
      glow.style.opacity = '1'
      glow.style.transform = `translate(${e.clientX - r.left - r.width / 2}px, ${e.clientY - r.top - r.height / 2}px)`
    })
    spot.addEventListener('mouseleave', () => { glow.style.opacity = '0' })
  } else if (glow) {
    glow.style.opacity = '.55'
  }

  // ------------------------------------------------- scroll-driven FAQ ----
  // The question nearest the reading line opens itself; clicking one pins it
  // until you scroll on again. Works entirely without GSAP.
  const qas = $$('[data-qa]')
  if (qas.length) {
    const rail = $('[data-qa-rail]')
    let pinned = null
    let pinnedAt = 0

    function setOpen(target) {
      qas.forEach((q, i) => {
        const a = $('.qa-a', q)
        const btn = $('.qa-q', q)
        const on = q === target
        q.classList.toggle('is-open', on)
        if (a) a.style.maxHeight = on ? $('.qa-a-inner', a).offsetHeight + 'px' : '0px'
        if (btn) btn.setAttribute('aria-expanded', String(on))
        if (on && rail) rail.style.transform = `scaleX(${(i + 1) / qas.length})`
      })
    }

    function pick() {
      if (pinned) {
        if (Math.abs(window.scrollY - pinnedAt) < 140) return
        pinned = null
      }
      const line = window.innerHeight * 0.42
      let best = null, bestD = Infinity
      qas.forEach((q) => {
        const r = q.getBoundingClientRect()
        if (r.bottom < 0 || r.top > window.innerHeight) return
        const d = Math.abs(r.top - line)
        if (d < bestD) { bestD = d; best = q }
      })
      if (best) setOpen(best)
    }

    qas.forEach((q) => {
      const btn = $('.qa-q', q)
      if (!btn) return
      btn.addEventListener('click', () => {
        pinned = q
        pinnedAt = window.scrollY
        setOpen(q.classList.contains('is-open') ? null : q)
      })
    })

    window.addEventListener('scroll', pick, { passive: true })
    window.addEventListener('resize', () => {
      const open = qas.find((q) => q.classList.contains('is-open'))
      if (open) setOpen(open)
      pick()
    }, { passive: true })
    pick()
  }

  // ------------------------------------------------------ text scramble ---
  const SCRAMBLE = '▓▒░/\\|<>-_+*#0123456789'
  function scramble(el) {
    const final = el.dataset.final || el.textContent
    el.dataset.final = final
    let frame = 0
    const steps = Math.min(34, final.length + 14)
    const id = setInterval(() => {
      frame++
      const shown = Math.floor((frame / steps) * final.length)
      el.textContent = final.slice(0, shown) +
        final.slice(shown).replace(/\S/g, () => SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0])
      if (frame >= steps) { clearInterval(id); el.textContent = final }
    }, 30)
  }
  if (!REDUCED && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return
        io.unobserve(en.target)
        scramble(en.target)
      })
    }, { threshold: 0.9 })
    $$('.tag').forEach((el) => io.observe(el))
  }

  // --------------------------------------------------- magnetic buttons ---
  if (FINE && !REDUCED) {
    $$('[data-magnet], .btn').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect()
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height
        el.style.transform = `translate(${dx * 12}px, ${dy * 8}px)`
      })
      el.addEventListener('mouseleave', () => { el.style.transform = '' })
    })
  }

  // ------------------------------------------------------------ parallax --
  const parEls = $$('[data-par]')
  if (parEls.length && !REDUCED) {
    const runPar = () => {
      parEls.forEach((el) => {
        const r = el.getBoundingClientRect()
        const mid = r.top + r.height / 2 - window.innerHeight / 2
        el.style.transform = `translateY(${(mid / window.innerHeight) * -(parseFloat(el.dataset.par) || 30)}px)`
      })
    }
    window.addEventListener('scroll', runPar, { passive: true })
    runPar()
  }

  // ------------------------------------------------------ intro curtain ---
  // Built in JS so a script failure can never leave a panel covering the site.
  if (!REDUCED && !sessionStorage.getItem('lux_seen')) {
    const cur = document.createElement('div')
    cur.className = 'curtain'
    cur.innerHTML = '<div class="curtain-inner"><div class="curtain-word">Luxartig</div><div class="curtain-bar"><i></i></div></div>'
    document.body.appendChild(cur)
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => { const b = $('.curtain-bar i', cur); if (b) b.style.transform = 'scaleX(1)' })
    const lift = () => {
      cur.classList.add('is-up')
      document.body.style.overflow = ''
      try { sessionStorage.setItem('lux_seen', '1') } catch (e) {}
      setTimeout(() => cur.remove(), 1400)
    }
    setTimeout(lift, 1150)
    // hard stop: never hold the page hostage
    setTimeout(() => { document.body.style.overflow = ''; cur.remove() }, 4000)
  }

  // -------------------------------------------------------- contact form --
  const form = $('[data-contact-form]')
  if (form) {
    const statusEl = $('[data-form-status]', form)
    const WEB3FORMS_ACCESS_KEY = 'b44bb61c-45ac-4bf5-8669-89d6aa9a4fc3'

    const setError = (field, message) => {
      const wrap = field.closest('.field')
      wrap.classList.toggle('has-error', Boolean(message))
      const err = $('.field-error', wrap)
      if (err) err.textContent = message || ''
    }

    function validate() {
      let ok = true
      const name = $('#name', form), email = $('#email', form)
      const telefon = $('#telefon', form), branche = $('#branche', form)
      if (!name.value.trim()) { setError(name, 'Bitte gib deinen Namen an.'); ok = false } else setError(name, '')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setError(email, 'Bitte gib eine gültige E-Mail-Adresse an.'); ok = false } else setError(email, '')
      if (!telefon.value.trim()) { setError(telefon, 'Bitte gib deine Telefonnummer an.'); ok = false } else setError(telefon, '')
      if (!branche.value) { setError(branche, 'Bitte wähle deine Branche.'); ok = false } else setError(branche, '')
      return ok
    }

    function mailtoFallback(data) {
      const subject = encodeURIComponent(`Anfrage über die Website – ${data.name}`)
      const body = encodeURIComponent([
        `Name: ${data.name}`, `E-Mail: ${data.email}`, `Telefon: ${data.telefon}`,
        `Branche: ${data.branche}`, '', 'Nachricht:', data.nachricht || '–',
      ].join('\n'))
      window.location.href = `mailto:info@luxartig.de?subject=${subject}&body=${body}`
      statusEl.textContent = 'Dein E-Mail-Programm öffnet sich gleich mit deiner Anfrage. Alternativ erreichst du uns direkt unter info@luxartig.de.'
      statusEl.classList.add('is-visible', 'ok')
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      statusEl.classList.remove('is-visible', 'ok', 'err')
      if (!validate()) {
        statusEl.textContent = 'Bitte prüfe deine Angaben.'
        statusEl.classList.add('is-visible', 'err')
        return
      }
      const data = Object.fromEntries(new FormData(form).entries())
      const btn = $('button[type="submit"]', form)
      btn.disabled = true
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_ACCESS_KEY,
            subject: `Anfrage über die Website – ${data.name}`,
            name: data.name, email: data.email, telefon: data.telefon,
            branche: data.branche, nachricht: data.nachricht || '–',
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.message || 'Unbekannter Fehler')
        statusEl.textContent = 'Danke! Deine Nachricht ist angekommen — wir melden uns meist innerhalb von 24 Stunden an Werktagen.'
        statusEl.classList.add('is-visible', 'ok')
        form.reset()
      } catch (err) {
        mailtoFallback(data)
      } finally {
        btn.disabled = false
      }
    })
  }

  // ============================ GSAP choreography ==========================
  if (!HAS_GSAP || REDUCED) {
    $$('.chx').forEach((c) => { c.style.transform = 'none' })
    // Still run the marquees with a plain CSS-free fallback: leave them static.
    return
  }

  // Some embedded/preview contexts report document.hidden even while painting,
  // which puts GSAP's ticker to sleep. Wake it explicitly.
  gsap.ticker.wake()

  // The hero (3D logo, the sentence, the core) is choreographed inside
  // core.js against its own scroll position — GSAP deliberately stays out of
  // it so the two never fight over the same inline styles.

  // Portal: SERVICES grows while a cream circle swallows the viewport and
  // hands over to the (light) services chapter.
  const portal = $('.portal')
  if (portal) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: portal, start: 'top top', end: 'bottom bottom', scrub: 0.5 } })
    tl.fromTo('.portal-word', { scale: 0.42 }, { scale: 1.5, duration: 0.55, ease: 'none' }, 0)
      .to('.portal-meta', { opacity: 0, duration: 0.35, ease: 'none' }, 0)
      .fromTo('.portal-fill', { scale: 0 }, { scale: 4, duration: 0.65, ease: 'power2.in' }, 0.40)
      .to('.portal-word', { scale: 4.6, duration: 0.65, ease: 'power2.in' }, 0.60)
      .to('.portal-word', { opacity: 0, duration: 0.35, ease: 'none' }, 1.05)
  }

  // Marquee rows. Neighbouring rows always travel in opposite directions, so
  // the words visibly slide against each other.
  const tracks = $$('[data-mq]')
  if (tracks.length) {
    const loops = tracks.map((track) => {
      const dir = track.dataset.mq === 'rev' ? 1 : -1
      const speed = parseFloat(track.dataset.mqSpeed || '26')
      gsap.set(track, { xPercent: dir === -1 ? 0 : -50 })
      return gsap.to(track, {
        xPercent: dir === -1 ? -50 : 0,
        duration: speed,
        ease: 'none',
        repeat: -1,
      })
    })

    // The skew goes on the row wrappers, never on the tracks themselves:
    // tweening the tracks here (especially with overwrite) would kill the
    // endless scroll the moment the visitor first scrolled.
    const rows = $$('.mq')
    let skew = 0
    ScrollTrigger.create({
      onUpdate: (self) => {
        const vel = self.getVelocity()
        const v = gsap.utils.clamp(-9, 9, vel / 190)
        if (rows.length && Math.abs(v - skew) > 0.1) {
          skew = v
          gsap.to(rows, { skewX: v, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })
        }
        // scrolling briefly speeds the words up, which reads as momentum
        const boost = gsap.utils.clamp(1, 3.4, 1 + Math.abs(vel) / 1400)
        loops.forEach((l) => l.timeScale(boost))
      },
    })
  }

  // Section headlines slide their lines up when they enter. The safety net
  // matters here: a headline hidden inside its mask is unreadable content, so
  // anything still displaced once it is on screen gets released.
  $$('[data-lines]').forEach((el) => {
    const lines = $$('.ln > span', el)
    if (!lines.length) return
    gsap.set(lines, { yPercent: 110 })
    gsap.to(lines, {
      yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 82%' },
    })
  })

  const releaseStuck = () => {
    $$('[data-lines] .ln > span').forEach((s) => {
      const r = s.closest('[data-lines]').getBoundingClientRect()
      const onScreen = r.top < window.innerHeight && r.bottom > 0
      if (onScreen && Math.abs(gsap.getProperty(s, 'yPercent')) > 1) {
        gsap.set(s, { clearProps: 'transform' })
      }
    })
  }
  window.addEventListener('scroll', () => { clearTimeout(releaseStuck._t); releaseStuck._t = setTimeout(releaseStuck, 1200) }, { passive: true })
  setTimeout(releaseStuck, 3000)

  ScrollTrigger.refresh()
})()
