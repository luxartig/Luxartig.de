import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

const CONFIG = {
  bgColor: '#140a19',
  flameColor: '#1f989a',
  flameColor2: '#5fe8e9',
  flameAmt: 0.16,
  atmoColor: '#5fe8e9',
  atmoCount: 260,
  atmoSize: 26,
  atmoSpeed: 1.0,
  coreColor: '#3a1f42',
  midColor: '#1f989a',
  rimColor: '#8ff0ea',
  opacity: 2,
  pointSize: 76,
  brightness: 1.5,
  spin: 0.013,
  blowUp: 0,
  repelRadius: 1.4,
  repelStrength: 4,
  scrollDive: 2,
  scrollGrow: 0.35,
  scrollSpin: 0.4,
  parallax: 0.5,
}

// Lighter particle counts and capped pixel ratio on small/touch screens —
// the full-page storm runs behind the whole site, and phone GPUs need a
// much lighter load than desktop to stay smooth.
const IS_MOBILE = window.matchMedia('(max-width: 780px), (pointer: coarse)').matches
const QUALITY = {
  particleCount: IS_MOBILE ? 18000 : 50000,
  atmoCount: IS_MOBILE ? 120 : CONFIG.atmoCount,
  maxPixelRatio: IS_MOBILE ? 1.5 : 2,
}

function hexToVec3(hex) {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

const LAYERS = { ENTIRE_SCENE: 1 }

const canvas = document.getElementById('stormCanvas')
if (canvas && window.WebGLRenderingContext) {
  const renderer = new THREE.WebGL1Renderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.maxPixelRatio))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(CONFIG.bgColor)
  scene.fog = new THREE.Fog(0x000000, 0, 15)

  let w = window.innerWidth, h = window.innerHeight
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 80)
  camera.position.set(0, 0, 7)
  camera.layers.enable(LAYERS.ENTIRE_SCENE)
  scene.add(camera)

  const POINTER = { ndc: new THREE.Vector2(0, 0), world: new THREE.Vector3(), activity: 0, active: false, lastMove: performance.now() }
  window.addEventListener('mousemove', e => {
    POINTER.ndc.x = (e.clientX / window.innerWidth) * 2 - 1
    POINTER.ndc.y = -((e.clientY / window.innerHeight) * 2 - 1)
    POINTER.active = true; POINTER.lastMove = performance.now()
  }, { passive: true })
  window.addEventListener('mouseout', () => { POINTER.active = false }, { passive: true })

  const _ndc = new THREE.Vector3(), _dir = new THREE.Vector3(), _target = new THREE.Vector3()
  function updatePointer() {
    _target.set(0, 0, 0)
    if (POINTER.active) {
      _ndc.set(POINTER.ndc.x, POINTER.ndc.y, 0.5).unproject(camera)
      _dir.copy(_ndc).sub(camera.position).normalize()
      const denom = _dir.z
      if (Math.abs(denom) > 1e-4) {
        const t = -camera.position.z / denom
        if (t > 0 && Number.isFinite(t)) _target.copy(camera.position).addScaledVector(_dir, t)
      }
    }
    POINTER.world.lerp(_target, 0.12)
    const idle = (performance.now() - POINTER.lastMove) / 1000
    const want = (POINTER.active && idle < 3) ? 1 : 0
    POINTER.activity += (want - POINTER.activity) * 0.06
  }

  const stormVertexShader = /* glsl */`
    uniform float uTime; uniform float uSize; uniform float uBlowUp;
    uniform vec3 uCursor; uniform float uRepelRadius; uniform float uRepelStrength; uniform float uActivity;
    uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uRim;
    attribute float aScale; attribute float aNoise; attribute float aRadialPush; attribute float aMix;
    varying vec3 vColor; varying float vBlowUp;
    void main() {
      vec3 pos = position;
      float t = uTime * 0.7 + aNoise * 6.2831;
      float wobble = sin(t) * 0.1 * aRadialPush;
      pos *= 1.0 + wobble;
      float swirlAngle = uTime * 0.025 + aNoise * 6.2831;
      mat2 swirl = mat2(cos(swirlAngle), -sin(swirlAngle), sin(swirlAngle), cos(swirlAngle));
      pos.xz = swirl * pos.xz;
      vec3 outward = normalize(pos + vec3(0.0001));
      float blow = uBlowUp * uBlowUp;
      pos += outward * blow * (10.0 + aNoise * 18.0) * aRadialPush;
      vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
      vec3 toParticle = modelPosition.xyz - uCursor;
      float dist = length(toParticle);
      float falloff = smoothstep(uRepelRadius, 0.0, dist);
      modelPosition.xyz += normalize(toParticle + vec3(0.0001)) * falloff * uRepelStrength * uActivity;
      vec4 viewPosition = viewMatrix * modelPosition;
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = uSize * aScale;
      gl_PointSize *= (1.0 / -viewPosition.z);
      float t1 = smoothstep(0.25, 0.85, aMix);
      vec3 mix1 = mix(uCore, uMid, t1);
      float t2 = clamp((aMix - 0.7) * 3.0, 0.0, 1.0);
      vColor = mix(mix1, uRim, t2);
      vBlowUp = uBlowUp;
    }
  `

  const stormFragmentShader = /* glsl */`
    uniform float uOpacity; uniform float uBrightness;
    varying vec3 vColor; varying float vBlowUp;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float strength = pow(1.0 - d * 2.0, 4.5);
      vec3 color = mix(vec3(0.0), vColor, strength);
      float blowFade = 1.0 - smoothstep(0.15, 1.0, vBlowUp);
      gl_FragColor = vec4(color * uBrightness, strength * uOpacity * blowFade);
    }
  `

  class Storm {
    constructor(parent) {
      this.group = new THREE.Group()
      parent.add(this.group)

      const count = QUALITY.particleCount, radius = 2.5
      const positions = new Float32Array(count * 3)
      const scales = new Float32Array(count)
      const noises = new Float32Array(count)
      const radialPush = new Float32Array(count)
      const mixv = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        let u, v, s
        do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v } while (s >= 1 || s === 0)
        const factor = 2 * Math.sqrt(1 - s)
        const dx = u * factor, dy = v * factor, dz = 1 - 2 * s
        const rN = Math.pow(Math.random(), 0.4)
        const r = radius * (0.55 + rN * 0.45)
        positions[i3] = dx * r; positions[i3 + 1] = dy * r; positions[i3 + 2] = dz * r
        mixv[i] = rN
        scales[i] = 0.45 + Math.random() * 0.8
        noises[i] = Math.random()
        radialPush[i] = 0.4 + rN * 1.1
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1))
      geometry.setAttribute('aNoise', new THREE.Float32BufferAttribute(noises, 1))
      geometry.setAttribute('aRadialPush', new THREE.Float32BufferAttribute(radialPush, 1))
      geometry.setAttribute('aMix', new THREE.Float32BufferAttribute(mixv, 1))

      this.uniforms = {
        uTime: { value: 0 },
        uSize: { value: CONFIG.pointSize },
        uOpacity: { value: 0 },
        uBlowUp: { value: CONFIG.blowUp },
        uCursor: { value: new THREE.Vector3() },
        uRepelRadius: { value: CONFIG.repelRadius },
        uRepelStrength: { value: CONFIG.repelStrength },
        uActivity: { value: 0 },
        uCore: { value: hexToVec3(CONFIG.coreColor) },
        uMid: { value: hexToVec3(CONFIG.midColor) },
        uRim: { value: hexToVec3(CONFIG.rimColor) },
        uBrightness: { value: CONFIG.brightness },
      }

      const material = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: stormVertexShader,
        fragmentShader: stormFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })

      this.points = new THREE.Points(geometry, material)
      this.points.layers.enable(LAYERS.ENTIRE_SCENE)
      this.group.add(this.points)

      this.appearStart = performance.now()
      this.t0 = performance.now() / 1000
    }

    render(scroll, m) {
      const t = performance.now() / 1000
      const dt = Math.min(0.05, t - this.t0); this.t0 = t
      this.uniforms.uTime.value = t

      camera.position.set(m.x * CONFIG.parallax, m.y * CONFIG.parallax, 7 - scroll * CONFIG.scrollDive)
      camera.lookAt(0, 0, 0)

      this.group.scale.setScalar(1 + scroll * CONFIG.scrollGrow)

      const elapsed = performance.now() - this.appearStart
      const fade = Math.max(0, Math.min(1, (elapsed - 200) / 1200))
      this.uniforms.uOpacity.value = fade * CONFIG.opacity
      this.uniforms.uBlowUp.value = CONFIG.blowUp
      this.uniforms.uCursor.value.copy(POINTER.world)
      this.uniforms.uActivity.value = POINTER.activity

      this.group.rotation.y += dt * (CONFIG.spin + scroll * CONFIG.scrollSpin)
      this.group.rotation.x += dt * CONFIG.spin * 0.33
    }
  }

  const storm = new Storm(scene)

  const atmoVertexShader = /* glsl */`
    attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
    varying float vA;
    vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
      p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
      p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
      return cos(p+vec3(1,2,4)); }
    void main(){
      vec3 v = position*4.0 + warp(position, uTime)*1.2;
      vec4 mv = modelViewMatrix * vec4(v, 1.0);
      float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
      vA = farF * nearF;
      gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
      gl_Position = projectionMatrix * mv;
    }
  `

  const atmoFragmentShader = /* glsl */`
    uniform vec3 uColor; varying float vA;
    void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
      float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.55); }
  `

  const N = Math.round(QUALITY.atmoCount)
  const atmoPositions = new Float32Array(N * 3), atmoSizes = new Float32Array(N), atmoSeeds = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    atmoPositions[i * 3] = 2 * Math.random() - 1
    atmoPositions[i * 3 + 1] = 2 * Math.random() - 1
    atmoPositions[i * 3 + 2] = 2 * Math.random() - 1
    atmoSizes[i] = CONFIG.atmoSize * (0.4 + Math.random())
    atmoSeeds[i] = Math.random()
  }

  const atmoGeometry = new THREE.BufferGeometry()
  atmoGeometry.setAttribute('position', new THREE.Float32BufferAttribute(atmoPositions, 3))
  atmoGeometry.setAttribute('size', new THREE.Float32BufferAttribute(atmoSizes, 1))
  atmoGeometry.setAttribute('seed', new THREE.Float32BufferAttribute(atmoSeeds, 1))

  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: hexToVec3(CONFIG.atmoColor) },
      uRes: { value: new THREE.Vector2(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()) }
    },
    vertexShader: atmoVertexShader,
    fragmentShader: atmoFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  })

  const atmoPoints = new THREE.Points(atmoGeometry, atmoMat)
  atmoPoints.frustumCulled = false
  atmoPoints.layers.enable(LAYERS.ENTIRE_SCENE)
  atmoPoints.onBeforeRender = () => {
    const t = performance.now() / 1000
    atmoMat.uniforms.uTime.value = t * CONFIG.atmoSpeed * 8.0
    atmoPoints.position.copy(camera.position)
    finalPass.uniforms.iTime.value = t
  }
  scene.add(atmoPoints)

  const renderScene = new RenderPass(scene, camera)

  const finalPassFragmentShader = /* glsl */`
    uniform float iTime; uniform sampler2D tDiffuse;
    uniform vec3 uBg; uniform vec3 uFlameA; uniform vec3 uFlameB; uniform float uFlameAmt;
    varying vec2 vUv;
    vec3 warp3d(vec3 pos, float t){ float curv=.8,a=1.9,b=0.7; pos*=2.;
      pos.x+=curv*sin(t+a*pos.y)+t*b; pos.y+=curv*cos(t+a*pos.x);
      pos.y+=curv*sin(t+a*pos.z)+t*b; pos.z+=curv*cos(t+a*pos.y);
      pos.z+=curv*sin(t+a*pos.x)+t*b; pos.x+=curv*cos(t+a*pos.z);
      return 0.5+0.5*cos(pos.xyz+vec3(1,2,4)); }
    void main(){
      vec2 uv = 2.*vUv - 1.;
      vec3 w2 = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime*1.5), vec3(1.5));
      vec3 flame = 1.5*uFlameA*w2.x; flame*=w2.y; flame += uFlameB*w2.z;
      flame *= smoothstep(0.25, 1., abs(uv.y));
      float md = smoothstep(-0.7, 1., -uv.y*uv.x); flame *= md*md;
      vec3 bg = uBg * (1.0 - 0.4 * length(uv));
      vec3 diffuseC = texture2D(tDiffuse, vUv).xyz;
      gl_FragColor = vec4(diffuseC + bg + flame*uFlameAmt, 1.);
    }
  `

  const FinalPass = {
    uniforms: {
      iTime: { value: 0 },
      tDiffuse: { value: null },
      uBg: { value: hexToVec3(CONFIG.bgColor) },
      uFlameA: { value: hexToVec3(CONFIG.flameColor) },
      uFlameB: { value: hexToVec3(CONFIG.flameColor2) },
      uFlameAmt: { value: CONFIG.flameAmt }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: finalPassFragmentShader
  }

  const finalPass = new ShaderPass(FinalPass)

  const finalComposer = new EffectComposer(renderer)
  finalComposer.addPass(renderScene)
  finalComposer.addPass(finalPass)

  function setSize(nw, nh) {
    if (!nw || !nh) return
    w = nw; h = nh
    const pr = Math.min(window.devicePixelRatio, QUALITY.maxPixelRatio)
    renderer.setPixelRatio(pr)
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    finalComposer.setPixelRatio(pr); finalComposer.setSize(w, h)
    atmoMat.uniforms.uRes.value.set(w * pr, h * pr)
  }
  setSize(window.innerWidth, window.innerHeight)

  window.addEventListener('resize', () => setSize(window.innerWidth, window.innerHeight), { passive: true })

  const Lerp = (a, b, t) => a + (b - a) * t
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  let scrollTarget = 0, scrollSmooth = 0, scrollCurrent = 0
  const mouseSmooth = { x: 0, y: 0 }

  // The dive/zoom completes within the first ~2.2 screens of scroll, then
  // holds steady — a long page would otherwise keep zooming forever.
  function updateScroll() {
    const diveSpan = window.innerHeight * 2.2
    scrollTarget = clamp(window.scrollY / diveSpan, 0, 1)
  }
  window.addEventListener('scroll', updateScroll, { passive: true })
  updateScroll()

  let visible = document.visibilityState !== 'hidden'
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState !== 'hidden' })

  let rafId = null
  function render() {
    rafId = requestAnimationFrame(render)
    if (!visible || !w || !h) return
    scrollSmooth  = Lerp(scrollSmooth, scrollTarget, 0.10)
    scrollCurrent = Lerp(scrollCurrent, scrollSmooth, 0.06)
    mouseSmooth.x = Lerp(mouseSmooth.x, POINTER.ndc.x, 0.06)
    mouseSmooth.y = Lerp(mouseSmooth.y, POINTER.ndc.y, 0.06)
    updatePointer()
    storm.render(scrollCurrent, mouseSmooth)
    finalComposer.render()
  }
  render()
}
