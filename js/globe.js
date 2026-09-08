// ============================================================================
// Chapter "Standort" — a particle planet you descend onto.
// Scrolling the chapter rotates Salzweg into view and flies the camera down
// from orbit to street level, where the contact details take over.
//
// This module owns its whole chapter (camera, marker, HUD readouts and the
// arrival state) and deliberately does not depend on GSAP: if the animation
// library ever fails to load, the address block still appears.
// ============================================================================
import * as THREE from 'three'

const canvas = document.getElementById('globeCv')
const section = document.querySelector('[data-globe]')

if (canvas && section && window.WebGLRenderingContext) {
  const SMALL = window.matchMedia('(max-width: 780px), (pointer: coarse)').matches
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Salzweg, just north of Passau.
  const LAT = 48.63, LON = 13.47
  const R = 3

  const CFG = {
    count: SMALL ? 22000 : 60000,
    maxPR: SMALL ? 1.5 : 2,
    land: '#8ef0e6',
    sea: '#0d5b60',
    far: 12.4,   // camera distance in orbit
    near: 3.24,  // camera distance on touchdown (globe radius is 3)
  }

  const hex = (h) => {
    const n = parseInt(h.slice(1), 16)
    return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const lerp = (a, b, t) => a + (b - a) * t
  // smooth, slightly front-loaded descent
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

  function latLonToVec(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    )
  }

  const renderer = new THREE.WebGL1Renderer({ canvas, antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  let w = 0, h = 0
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200)
  scene.add(camera)

  const globe = new THREE.Group()
  scene.add(globe)

  // ---- landmasses -------------------------------------------------------
  // A handful of blob centres produce organic-looking continents without
  // shipping a map texture.
  const BLOBS = []
  for (let i = 0; i < 16; i++) {
    let u, v, s
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v } while (s >= 1 || s === 0)
    const f = 2 * Math.sqrt(1 - s)
    BLOBS.push({
      dir: new THREE.Vector3(u * f, v * f, 1 - 2 * s).normalize(),
      cos: Math.cos(0.28 + Math.random() * 0.42),
      wob: 0.4 + Math.random() * 1.6,
    })
  }
  function isLand(dir) {
    for (const b of BLOBS) {
      const d = dir.dot(b.dir)
      const wobble = Math.sin(dir.x * 9 * b.wob) * Math.cos(dir.y * 7 * b.wob) * 0.05
      if (d > b.cos + wobble) return true
    }
    return false
  }

  const count = CFG.count
  const pos = new Float32Array(count * 3)
  const aLand = new Float32Array(count)
  const aScale = new Float32Array(count)
  const aSeed = new Float32Array(count)
  const _d = new THREE.Vector3()

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    let u, v, s
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v } while (s >= 1 || s === 0)
    const f = 2 * Math.sqrt(1 - s)
    _d.set(u * f, v * f, 1 - 2 * s).normalize()
    pos[i3] = _d.x * R; pos[i3 + 1] = _d.y * R; pos[i3 + 2] = _d.z * R
    const land = isLand(_d)
    aLand[i] = land ? 1 : 0
    aScale[i] = land ? 0.75 + Math.random() * 0.65 : 0.3 + Math.random() * 0.35
    aSeed[i] = Math.random()
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aLand', new THREE.Float32BufferAttribute(aLand, 1))
  geo.setAttribute('aScale', new THREE.Float32BufferAttribute(aScale, 1))
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(aSeed, 1))

  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: SMALL ? 150 : 190 },
    uOpacity: { value: 0 },
    uLand: { value: hex(CFG.land) },
    uSea: { value: hex(CFG.sea) },
  }

  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uSize;
      uniform vec3 uLand, uSea;
      attribute float aLand, aScale, aSeed;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec4 mp = modelMatrix * vec4(position, 1.0);
        vec4 vp = viewMatrix * mp;
        gl_Position = projectionMatrix * vp;
        // Clamped: without a ceiling the points balloon to hundreds of pixels
        // once the camera drops close to the surface and blow the image out.
        gl_PointSize = clamp(uSize * aScale * (1.0 / -vp.z), 1.0, 5.0);
        // fade the limb so the sphere reads as a globe, not a flat disc
        vec3 n = normalize(mat3(modelMatrix) * normalize(position));
        vec3 toCam = normalize(cameraPosition - mp.xyz);
        float facing = clamp(dot(n, toCam), 0.0, 1.0);
        float twinkle = 0.82 + 0.18 * sin(uTime * 1.6 + aSeed * 6.2831);
        vColor = mix(uSea, uLand, aLand);
        vAlpha = pow(facing, 0.7) * twinkle * mix(0.5, 1.0, aLand);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float st = pow(1.0 - d * 2.0, 3.0);
        gl_FragColor = vec4(vColor * st, st * vAlpha * uOpacity);
      }
    `,
  }))
  globe.add(points)

  // ---- graticule --------------------------------------------------------
  const gratPts = []
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = -180; lon < 180; lon += 4) {
      gratPts.push(latLonToVec(lat, lon, R * 1.002), latLonToVec(lat, lon + 4, R * 1.002))
    }
  }
  for (let lon = -180; lon < 180; lon += 30) {
    for (let lat = -86; lat < 86; lat += 4) {
      gratPts.push(latLonToVec(lat, lon, R * 1.002), latLonToVec(lat + 4, lon, R * 1.002))
    }
  }
  const gratGeo = new THREE.BufferGeometry().setFromPoints(gratPts)
  const gratMat = new THREE.LineBasicMaterial({ color: 0x19b3b0, transparent: true, opacity: 0 })
  globe.add(new THREE.LineSegments(gratGeo, gratMat))

  // ---- atmosphere -------------------------------------------------------
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.13, 48, 48),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uColor: { value: hex('#19b3b0') } },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN; varying vec3 vP;
        void main(){ vN = normalize(normalMatrix * normal); vec4 mp = modelViewMatrix * vec4(position,1.0); vP = mp.xyz; gl_Position = projectionMatrix * mp; }`,
      fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying vec3 vN; varying vec3 vP;
        void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(-vP))), 0.0, 1.0), 3.2);
          gl_FragColor = vec4(uColor * f, f * uOpacity); }`,
    })
  )
  globe.add(atmo)

  // ---- the marker -------------------------------------------------------
  const markerLocal = latLonToVec(LAT, LON, R)
  const markerDir = markerLocal.clone().normalize()
  const markerEl = document.querySelector('[data-globe-marker]')

  // Rotation that brings Salzweg round to face the camera, and the wider
  // starting rotation we descend from.
  const qEnd = new THREE.Quaternion().setFromUnitVectors(markerDir, new THREE.Vector3(0, 0, 1))
  const qStart = qEnd.clone().multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, -1.65, 0.12))
  )

  // ---- HUD --------------------------------------------------------------
  const elAlt = document.querySelector('[data-globe-alt]')
  const elMode = document.querySelector('[data-globe-mode]')
  const elClock = document.querySelector('[data-globe-clock]')
  function updateClock() {
    if (!elClock) return
    elClock.textContent = new Date().toLocaleTimeString('de-DE', {
      timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit',
    })
  }
  updateClock()
  setInterval(updateClock, 20000)

  // ---- sizing -----------------------------------------------------------
  function resize() {
    const nw = canvas.clientWidth || window.innerWidth
    const nh = canvas.clientHeight || window.innerHeight
    if (!nw || !nh || (nw === w && nh === h)) return
    w = nw; h = nh
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CFG.maxPR))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize, { passive: true })
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas)

  // ---- scroll progress through the chapter ------------------------------
  let progress = 0
  function readProgress() {
    const r = section.getBoundingClientRect()
    const span = r.height - window.innerHeight
    progress = span > 0 ? clamp(-r.top / span, 0, 1) : (r.top <= 0 ? 1 : 0)
  }
  window.addEventListener('scroll', readProgress, { passive: true })
  window.addEventListener('resize', readProgress, { passive: true })
  readProgress()

  const _v = new THREE.Vector3()
  // Start where the page actually is, so a reload mid-chapter doesn't replay
  // the whole descent.
  let smooth = progress
  const born = performance.now()

  function frame() {
    requestAnimationFrame(frame)
    if (!w || !h) return

    const t = performance.now() / 1000
    uniforms.uTime.value = t

    smooth = REDUCED ? progress : lerp(smooth, progress, 0.09)

    // Descent happens over the first 75% of the chapter; the rest is arrival.
    const flight = easeInOut(clamp(smooth / 0.75, 0, 1))
    // NB: do not touch globe.rotation here — assigning any Euler component
    // rebuilds the quaternion from scratch and throws this slerp away, which
    // left the globe pointing somewhere other than Salzweg.
    globe.quaternion.slerpQuaternions(qStart, qEnd, flight)

    // Come in on a slight angle rather than straight down: the horizon tilts
    // into view, which is what makes it read as a landing.
    const bank = Math.sin(flight * Math.PI) * 0.16
    camera.position.set(
      Math.sin(bank) * 1.4,
      Math.sin(bank) * 0.9,
      lerp(CFG.far, CFG.near, flight)
    )
    camera.lookAt(0, 0, 0)
    camera.rotation.z = bank * 0.5

    const fade = clamp((performance.now() - born - 200) / 1200, 0, 1)
    // Dim the planet as the contact block comes in, so the text stays readable.
    const dim = clamp((smooth - 0.55) / 0.3, 0, 1)
    uniforms.uOpacity.value = fade * (1 - dim * 0.45)
    gratMat.opacity = fade * 0.16 * (1 - flight * 0.5)
    atmo.material.uniforms.uOpacity.value = fade * 0.85

    // Project the marker to screen space for the HTML label.
    if (markerEl) {
      _v.copy(markerLocal).applyQuaternion(globe.quaternion)
      const facing = _v.clone().normalize().z
      _v.project(camera)
      const x = (_v.x * 0.5 + 0.5) * w
      const y = (-_v.y * 0.5 + 0.5) * h
      // The pin grows as we drop onto it, so the landing has a target.
      const grow = 1 + flight * 0.9
      markerEl.style.transform = `translate(${x}px, ${y}px) scale(${grow})`
      const show = facing > 0.15 && smooth > 0.12 ? 1 : 0
      markerEl.style.opacity = String(show)
    }

    if (elAlt) elAlt.textContent = Math.round(lerp(240, 0, flight)) + ' km'
    if (elMode) elMode.textContent = smooth < 0.08 ? 'im Orbit' : flight < 0.985 ? 'im Anflug' : 'gelandet'
    // NB: `is-arrived` is deliberately NOT set here. The address and phone
    // number must never depend on WebGL or on this loop running, so that
    // toggle lives in the plain scroll handler in experience.js.

    renderer.render(scene, camera)
  }
  frame()
}
