// ============================================================================
// The hero scene. Three acts, all driven by how far the hero has scrolled:
//
//   1. the logo, extruded in 3D, floating over the particle core
//   2. it leaves quickly and "Lass uns deinen Auftritt bauen" takes over,
//      built out of particles, growing as you scroll
//   3. the sentence bursts into the same storm the core is made of
//
// Everything reads its own scroll position, so nothing here depends on GSAP.
// ============================================================================
import * as THREE from 'three'

const canvas = document.getElementById('coreCv')
const heroSec = document.querySelector('[data-hero]')

if (canvas && heroSec && window.WebGLRenderingContext) {
  const SMALL = window.matchMedia('(max-width: 780px), (pointer: coarse)').matches
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const CFG = {
    count: SMALL ? 16000 : 46000,
    radius: 2.5,
    pointSize: SMALL ? 62 : 78,
    maxPR: SMALL ? 1.5 : 2,
    core: '#0b4a50',
    mid: '#19b3b0',
    rim: '#a9f4ee',
    brightness: 1.15,
    opacity: 1.05,
    spin: 0.05,
    repelRadius: 1.4,
    repelStrength: 3.6,
    textStep: SMALL ? 4 : 3,
  }

  // Act boundaries, as a fraction of the hero's scrollable length.
  const ACT = { logoOut: 0.22, textIn: [0.24, 0.72], textOut: [0.74, 1.0] }

  const hexv = (h) => {
    const n = parseInt(h.slice(1), 16)
    return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const lerp = (a, b, t) => a + (b - a) * t
  const track = (p, [a, b]) => clamp((p - a) / (b - a), 0, 1)
  const easeOut = (t) => 1 - Math.pow(1 - t, 3)

  const renderer = new THREE.WebGL1Renderer({ canvas, antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.autoClear = false

  const scene = new THREE.Scene()
  let w = 0, h = 0, PR = 1
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80)
  scene.add(camera)

  // Text particles live in their own orthographic overlay measured in CSS pixels.
  const textScene = new THREE.Scene()
  const textCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100)
  textScene.add(textCam)

  const VIEW = { z: 9.8, x: 1.5 }
  function fitView() {
    const aspect = w / h
    VIEW.z = aspect < 1 ? 13.5 : aspect < 1.35 ? 11.2 : 9.8
    VIEW.x = aspect < 1.35 ? 0 : 1.5
  }

  // ---- pointer ----------------------------------------------------------
  const P = { ndc: new THREE.Vector2(), world: new THREE.Vector3(), act: 0, on: false, last: performance.now() }
  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect()
    P.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
    P.ndc.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
    P.on = true
    P.last = performance.now()
  }, { passive: true })

  // Tilt is tracked separately from the repel pointer and listens to
  // `pointermove`, so a finger on a phone drives the logo exactly like a
  // mouse does — `mousemove` alone never fires on touch, which is why the
  // logo sat perfectly flat on mobile.
  const TILT = { x: 0, y: 0, tx: 0, ty: 0, touched: false }
  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return
    TILT.tx = ((e.clientX - r.left) / r.width) * 2 - 1
    TILT.ty = -(((e.clientY - r.top) / r.height) * 2 - 1)
    if (e.pointerType !== 'mouse') TILT.touched = true
  }, { passive: true })

  const _n = new THREE.Vector3(), _dv = new THREE.Vector3(), _t = new THREE.Vector3()
  function pointer() {
    _t.set(0, 0, 0)
    if (P.on) {
      _n.set(P.ndc.x, P.ndc.y, 0.5).unproject(camera)
      _dv.copy(_n).sub(camera.position).normalize()
      if (Math.abs(_dv.z) > 1e-4) {
        const k = -camera.position.z / _dv.z
        if (k > 0 && Number.isFinite(k)) _t.copy(camera.position).addScaledVector(_dv, k)
      }
    }
    P.world.lerp(_t, 0.12)
    const idle = (performance.now() - P.last) / 1000
    P.act += ((P.on && idle < 3 ? 1 : 0) - P.act) * 0.06
  }

  // ---- drag to spin / click to burst ------------------------------------
  const DRAG = { down: false, x: 0, y: 0, vx: 0, vy: 0, moved: 0 }
  let burst = 0, burstTarget = 0
  canvas.addEventListener('pointerdown', (e) => {
    DRAG.down = true; DRAG.x = e.clientX; DRAG.y = e.clientY; DRAG.moved = 0
    canvas.setPointerCapture?.(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!DRAG.down) return
    const dx = e.clientX - DRAG.x, dy = e.clientY - DRAG.y
    DRAG.x = e.clientX; DRAG.y = e.clientY
    DRAG.moved += Math.abs(dx) + Math.abs(dy)
    DRAG.vx += dx * 0.00035
    DRAG.vy += dy * 0.00028
  })
  const release = () => { DRAG.down = false }
  canvas.addEventListener('pointerup', () => {
    if (DRAG.down && DRAG.moved < 6) { burstTarget = 1; setTimeout(() => { burstTarget = 0 }, 260) }
    release()
  })
  canvas.addEventListener('pointercancel', release)
  canvas.addEventListener('pointerleave', release)

  // ---- the particle core ------------------------------------------------
  const count = CFG.count
  const pos = new Float32Array(count * 3)
  const scl = new Float32Array(count)
  const nse = new Float32Array(count)
  const psh = new Float32Array(count)
  const mixv = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    let u, v, s
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v } while (s >= 1 || s === 0)
    const f = 2 * Math.sqrt(1 - s)
    const rN = Math.pow(Math.random(), 0.4)
    const r = CFG.radius * (0.56 + rN * 0.44)
    pos[i3] = u * f * r; pos[i3 + 1] = v * f * r; pos[i3 + 2] = (1 - 2 * s) * r
    mixv[i] = rN
    scl[i] = 0.45 + Math.random() * 0.8
    nse[i] = Math.random()
    psh[i] = 0.4 + rN * 1.1
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aScale', new THREE.Float32BufferAttribute(scl, 1))
  geo.setAttribute('aNoise', new THREE.Float32BufferAttribute(nse, 1))
  geo.setAttribute('aPush', new THREE.Float32BufferAttribute(psh, 1))
  geo.setAttribute('aMix', new THREE.Float32BufferAttribute(mixv, 1))

  const uniforms = {
    uTime: { value: 0 }, uSize: { value: CFG.pointSize }, uOpacity: { value: 0 },
    uBurst: { value: 0 }, uCursor: { value: new THREE.Vector3() },
    uRepelR: { value: CFG.repelRadius }, uRepelS: { value: CFG.repelStrength }, uAct: { value: 0 },
    uCore: { value: hexv(CFG.core) }, uMid: { value: hexv(CFG.mid) }, uRim: { value: hexv(CFG.rim) },
    uBright: { value: CFG.brightness },
  }

  const coreMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uSize, uBurst, uRepelR, uRepelS, uAct;
      uniform vec3 uCursor, uCore, uMid, uRim;
      attribute float aScale, aNoise, aPush, aMix;
      varying vec3 vColor; varying float vBurst;
      void main() {
        vec3 p = position;
        float t = uTime * 0.7 + aNoise * 6.2831;
        p *= 1.0 + sin(t) * 0.1 * aPush;
        float a = uTime * 0.025 + aNoise * 6.2831;
        mat2 sw = mat2(cos(a), -sin(a), sin(a), cos(a));
        p.xz = sw * p.xz;
        vec3 outw = normalize(p + vec3(0.0001));
        p += outw * (uBurst * uBurst) * (9.0 + aNoise * 16.0) * aPush;
        vec4 mp = modelMatrix * vec4(p, 1.0);
        vec3 toP = mp.xyz - uCursor;
        float fall = smoothstep(uRepelR, 0.0, length(toP));
        mp.xyz += normalize(toP + vec3(0.0001)) * fall * uRepelS * uAct;
        vec4 vp = viewMatrix * mp;
        gl_Position = projectionMatrix * vp;
        gl_PointSize = uSize * aScale * (1.0 / -vp.z);
        vec3 c = mix(uCore, uMid, smoothstep(0.25, 0.85, aMix));
        vColor = mix(c, uRim, clamp((aMix - 0.7) * 3.0, 0.0, 1.0));
        vBurst = uBurst;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity, uBright;
      varying vec3 vColor; varying float vBurst;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float st = pow(1.0 - d * 2.0, 4.5);
        float fade = 1.0 - smoothstep(0.15, 1.0, vBurst);
        gl_FragColor = vec4(mix(vec3(0.0), vColor, st) * uBright, st * uOpacity * fade);
      }
    `,
  })

  const group = new THREE.Group()
  group.add(new THREE.Points(geo, coreMat))
  scene.add(group)

  // ---- the logo, extruded ------------------------------------------------
  const LOGO_ASPECT = 2.188
  // Phones need MORE layers, not fewer: the mark is smaller on screen, so the
  // extrusion has fewer pixels to read in.
  const LAYERS = SMALL ? 14 : 12
  const LAYER_STEP = SMALL ? 0.0105 : 0.0075
  const logo = new THREE.Group()
  scene.add(logo)
  const logoMats = []
  let logoReady = false

  new THREE.TextureLoader().load('assets/logo-hero.png', (tex) => {
    tex.minFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    const planeGeo = new THREE.PlaneGeometry(1, 1 / LOGO_ASPECT)

    // Back layers give the mark its thickness. They must be transparent from
    // the start — flipping `transparent` later needs a shader recompile, and
    // without it these dark planes stayed fully opaque and left a black
    // silhouette hanging in the air after the logo had "faded" out.
    for (let i = LAYERS - 1; i >= 1; i--) {
      const k = i / (LAYERS - 1)
      const m = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, alphaTest: 0.42,
        color: new THREE.Color().setHSL(0.49, 0.62, 0.09 + (1 - k) * 0.24),
      })
      const mesh = new THREE.Mesh(planeGeo, m)
      mesh.position.z = -i * LAYER_STEP
      mesh.renderOrder = 1
      logoMats.push(m)
      logo.add(mesh)
    }

    // Front face reads as the brand navy; the teal depth layers behind it
    // (the "blue edges" of the extrusion) are untouched.
    const front = new THREE.MeshBasicMaterial({ map: tex, color: 0x081a44, transparent: true, depthWrite: false })
    const frontMesh = new THREE.Mesh(planeGeo, front)
    frontMesh.renderOrder = 2
    logoMats.push(front)
    logo.add(frontMesh)

    logoReady = true
    layoutLogo()
  })

  function layoutLogo() {
    if (!logoReady || !w || !h) return
    const vh = 2 * VIEW.z * Math.tan((45 * Math.PI / 180) / 2)
    const vw = vh * (w / h)
    const width = vw * (w / h < 1 ? 0.82 : 0.52)
    logo.scale.setScalar(width)
    logo.position.set(0, vh * 0.04, 0)
  }

  // ---- the sentence, made of particles -----------------------------------
  const TEXT_LINES = ['Lass uns deinen', 'Auftritt bauen']
  const TEXT_W = 1400
  let textPoints = null
  const textUniforms = {
    uScale: { value: 0 }, uOut: { value: 0 }, uOpacity: { value: 0 },
    uPR: { value: 1 }, uStep: { value: CFG.textStep }, uTime: { value: 0 },
    uColor: { value: hexv('#edece6') }, uAccent: { value: hexv('#5fe8e9') },
  }

  function buildText() {
    const c = document.createElement('canvas')
    const fs = 190
    const lineH = fs * 1.02
    c.width = TEXT_W
    c.height = Math.ceil(lineH * TEXT_LINES.length + fs * 0.35)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Shrink to fit so the sentence never runs off the sampling canvas.
    let size = fs
    ctx.font = `900 ${size}px 'Inter Tight', 'Inter', system-ui, sans-serif`
    const widest = Math.max(...TEXT_LINES.map((l) => ctx.measureText(l).width))
    if (widest > TEXT_W * 0.96) {
      size = Math.floor(size * (TEXT_W * 0.96) / widest)
      ctx.font = `900 ${size}px 'Inter Tight', 'Inter', system-ui, sans-serif`
    }

    TEXT_LINES.forEach((line, i) => {
      ctx.fillText(line, c.width / 2, (i + 0.5) * lineH + fs * 0.16)
    })

    const img = ctx.getImageData(0, 0, c.width, c.height).data
    const step = CFG.textStep
    const px = [], seeds = []
    for (let y = 0; y < c.height; y += step) {
      for (let x = 0; x < c.width; x += step) {
        if (img[(y * c.width + x) * 4 + 3] > 130) {
          px.push(x - c.width / 2, -(y - c.height / 2), 0)
          seeds.push(Math.random(), Math.random(), Math.random())
        }
      }
    }
    if (!px.length) return

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(px), 3))
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Float32Array(seeds), 3))

    textPoints = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: textUniforms, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uScale, uOut, uPR, uStep, uTime;
        attribute vec3 aSeed;
        varying float vFade; varying float vSeed;
        void main() {
          vec3 p = position * uScale;
          // burst: every particle takes its own direction out of the sentence
          float ang = aSeed.x * 6.2831;
          float rise = (aSeed.y - 0.35);
          vec3 dir = normalize(vec3(cos(ang), sin(ang) * 0.55 + rise, 0.0) + vec3(0.0001));
          float travel = uOut * uOut * (140.0 + aSeed.z * 620.0) * max(uScale, 0.35);
          p += dir * travel;
          p.x += sin(uTime * 1.4 + aSeed.z * 6.2831) * uOut * 26.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = max(1.0, uStep * uScale * uPR * 1.08);
          vFade = 1.0 - smoothstep(0.0, 0.85, uOut);
          vSeed = aSeed.z;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uOpacity, uOut;
        uniform vec3 uColor, uAccent;
        varying float vFade; varying float vSeed;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          if (length(uv) > 0.5) discard;
          vec3 c = mix(uColor, uAccent, clamp(uOut * 1.6 * (0.35 + vSeed), 0.0, 1.0));
          gl_FragColor = vec4(c, vFade * uOpacity);
        }
      `,
    }))
    textPoints.frustumCulled = false
    textScene.add(textPoints)
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(buildText).catch(buildText)
  } else {
    buildText()
  }

  // ---- sizing -----------------------------------------------------------
  function resize() {
    const nw = canvas.clientWidth || window.innerWidth
    const nh = canvas.clientHeight || window.innerHeight
    if (!nw || !nh || (nw === w && nh === h)) return
    w = nw; h = nh
    PR = Math.min(window.devicePixelRatio, CFG.maxPR)
    renderer.setPixelRatio(PR)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    textCam.left = -w / 2; textCam.right = w / 2
    textCam.top = h / 2; textCam.bottom = -h / 2
    textCam.updateProjectionMatrix()
    textUniforms.uPR.value = PR
    fitView()
    group.position.x = VIEW.x
    layoutLogo()
  }
  w = 0; h = 0
  resize()
  window.addEventListener('resize', resize, { passive: true })
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas)

  // ---- hero scroll progress ---------------------------------------------
  let progress = 0
  function readProgress() {
    const r = heroSec.getBoundingClientRect()
    const span = r.height - window.innerHeight
    progress = span > 0 ? clamp(-r.top / span, 0, 1) : (r.top <= 0 ? 1 : 0)
  }
  window.addEventListener('scroll', readProgress, { passive: true })
  window.addEventListener('resize', readProgress, { passive: true })
  readProgress()

  const heroSub = document.querySelector('[data-hero-fade]')
  const heroHint = document.querySelector('.core-hint')

  // Start where the page actually is: reloading halfway down the hero should
  // not replay the whole intro from the top.
  let smooth = progress
  const born = performance.now()
  let t0 = performance.now() / 1000

  function frame() {
    requestAnimationFrame(frame)
    if (!w || !h) return

    const now = performance.now()
    const t = now / 1000
    const dt = Math.min(0.05, t - t0); t0 = t
    uniforms.uTime.value = t
    textUniforms.uTime.value = t

    smooth = REDUCED ? progress : lerp(smooth, progress, 0.1)
    const intro = clamp((now - born - 250) / 1200, 0, 1)

    // --- act 1: the logo leaves, fast
    const outL = easeOut(track(smooth, [0, ACT.logoOut]))
    if (logoReady) {
      // Fades out well before it reaches the camera, so it never blows up into
      // a full-screen blur on the way past.
      const a = intro * Math.pow(1 - outL, 1.8)
      logo.visible = a > 0.004
      logo.position.z = outL * 3.4

      TILT.x += (TILT.tx - TILT.x) * 0.07
      TILT.y += (TILT.ty - TILT.y) * 0.07

      // A short automatic sweep on load so the depth is obvious immediately,
      // including on touch devices where nothing hovers. It fades out and
      // hands over to the finger/cursor.
      const age = (now - born) / 1000
      const sweep = REDUCED ? 0 : Math.max(0, 1 - age / 2.8)
      const auto = Math.sin(age * 2.1) * 0.5 * sweep * sweep

      logo.rotation.y = (REDUCED ? 0 : TILT.x * 0.34) + auto + outL * 0.3
      logo.rotation.x = (REDUCED ? 0 : -TILT.y * 0.2) + Math.cos(age * 1.7) * 0.16 * sweep * sweep + Math.sin(t * 0.6) * 0.025
      logoMats.forEach((m) => { m.opacity = a })
    }

    if (heroSub) heroSub.style.opacity = String(intro * (1 - clamp(smooth / 0.15, 0, 1)))
    if (heroHint) heroHint.style.opacity = String(intro * (1 - clamp(smooth / 0.1, 0, 1)))

    // --- act 2 + 3: the sentence grows, then bursts
    if (textPoints) {
      const inT = track(smooth, ACT.textIn)
      const outT = track(smooth, ACT.textOut)
      const endScale = (w * (w / h < 1 ? 0.86 : 0.72)) / TEXT_W
      textUniforms.uScale.value = endScale * lerp(0.16, 1, easeOut(inT))
      textUniforms.uOut.value = outT
      textUniforms.uOpacity.value = intro * clamp(inT * 4, 0, 1)
      textPoints.visible = textUniforms.uOpacity.value > 0.01 && outT < 0.999
    }

    // --- the core behind everything
    pointer()
    camera.position.set(P.ndc.x * 0.3, P.ndc.y * 0.24, VIEW.z - smooth * 3.2)
    camera.lookAt(0, 0, 0)
    group.scale.setScalar(1 + smooth * 0.3)

    burst = lerp(burst, burstTarget, burstTarget > burst ? 0.22 : 0.05)
    uniforms.uBurst.value = burst
    uniforms.uOpacity.value = intro * CFG.opacity * (1 - smooth * 0.4)
    uniforms.uCursor.value.copy(P.world)
    uniforms.uAct.value = P.act

    DRAG.vx *= 0.94; DRAG.vy *= 0.94
    if (!REDUCED) {
      group.rotation.y += dt * (CFG.spin + smooth * 0.4) + DRAG.vx
      group.rotation.x += dt * CFG.spin * 0.3 + DRAG.vy
    }

    renderer.clear()
    renderer.render(scene, camera)
    renderer.clearDepth()
    renderer.render(textScene, textCam)
  }
  frame()
}
