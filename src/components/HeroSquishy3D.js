import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getPerfProfile } from '../utils/devicePerf';

const CHEESE_HOLES_3D = [
  [-0.36, 0.42, 0.82, 0.2, 0.18],
  [0.44, 0.34, 0.82, 0.25, 0.2],
  [-0.44, -0.36, 0.82, 0.22, 0.18],
  [0.42, -0.4, 0.82, 0.23, 0.19],
  [0.12, 0.24, 0.92, 0.14, 0.12],
  [0.82, 0.15, 0.35, 0.24, 0.18],
  [-0.82, -0.12, 0.35, 0.22, 0.17],
];

// Rich 3D PBR color palettes so studio lighting produces deep 3D shading without washing out
const CHAR_3D_PALETTES = {
  dumpling: ['#fff1e4', '#f6c5aa', '#c98268'],
  cheese: ['#fff099', '#f7c936', '#c28310'],
  catpaw: ['#fff2f8', '#ffbfd9', '#d16d98'],
  toast: ['#ffefd1', '#ecc07d', '#ad7231'],
  butter: ['#fff6c7', '#f7de7e', '#c7a132'],
  peanut: ['#f6dfc0', '#dcad74', '#9e6b34'],
};

export function createHeroSquishy3D(canvas) {
  const perf = getPerfProfile();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !perf.isLowEnd,
      alpha: true,
      powerPreference: perf.isLowEnd ? 'default' : 'high-performance',
    });
  } catch {
    return null;
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camZ = 6.5;
  const fov = 34;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 50);
  camera.position.set(0, 0, camZ);

  // Subtle studio environment reflections for 3D clearcoat speculars (skipped on low-end devices to avoid shader stall)
  let pmremGenerator = null;
  let roomEnv = null;
  let envMap = null;
  if (perf.enableEnvMap) {
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    roomEnv = new RoomEnvironment();
    envMap = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envMap;
  }

  // High-contrast 3D studio lighting for deep sculptural 3D volume
  const ambientLight = new THREE.AmbientLight('#ffeef8', perf.enableEnvMap ? 0.28 : 0.42);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight('#fff6fb', '#3d1948', 0.62);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#fff8ee', 1.55);
  keyLight.position.set(-3.8, 4.6, 4.4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#ff9ed2', 0.48);
  fillLight.position.set(4.5, -1.2, 2.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight('#f0d8ff', 1.35);
  rimLight.position.set(2.4, 3.8, -4.2);
  scene.add(rimLight);

  const bounceLight = new THREE.PointLight('#ffb8df', 0.75, 7);
  bounceLight.position.set(0, -2.4, 1.8);
  scene.add(bounceLight);

  // Adaptive UV texture size (384px on mobile/low-end, 512px on desktop) with dirty-checking
  const texSize = perf.heroTexSize || 512;
  const texScale = texSize / 1024;
  const texCanvas = document.createElement('canvas');
  texCanvas.width = texSize;
  texCanvas.height = texSize;
  const tctx = texCanvas.getContext('2d');
  const bodyTexture = new THREE.CanvasTexture(texCanvas);
  bodyTexture.colorSpace = THREE.SRGBColorSpace;
  bodyTexture.generateMipmaps = false;
  bodyTexture.minFilter = THREE.LinearFilter;
  bodyTexture.magFilter = THREE.LinearFilter;

  // Adaptive deformable sphere mesh resolution
  const [segW, segH] = perf.heroSegments || [64, 48];
  const geometry = new THREE.SphereGeometry(1, segW, segH);
  const posAttr = geometry.attributes.position;
  const uvAttr = geometry.attributes.uv;
  const vertexCount = posAttr.count;

  const unitDirs = new Float32Array(vertexCount * 3);
  const basePositions = new Float32Array(vertexCount * 3);
  const dentOffsets = new Float32Array(vertexCount);
  const dentVel = new Float32Array(vertexCount);

  for (let i = 0; i < vertexCount; i += 1) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    unitDirs[i * 3] = vx / len;
    unitDirs[i * 3 + 1] = vy / len;
    unitDirs[i * 3 + 2] = vz / len;
  }

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    map: bodyTexture,
    roughness: 0.36,
    metalness: 0.01,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
    sheen: 0.75,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color('#ffd4ea'),
    envMapIntensity: 0.36,
  });

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  // 3D Floor Pedestal & Contact Shadow (rendered behind/underneath the 3D squishy)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 512;
  shadowCanvas.height = 512;
  const sctx = shadowCanvas.getContext('2d');
  const sg = sctx.createRadialGradient(256, 256, 10, 256, 256, 250);
  sg.addColorStop(0, 'rgba(52, 18, 56, 0.52)');
  sg.addColorStop(0.42, 'rgba(58, 22, 62, 0.28)');
  sg.addColorStop(0.75, 'rgba(255, 215, 238, 0.22)');
  sg.addColorStop(1, 'rgba(255, 215, 238, 0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 512, 512);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(3.4, 0.82);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  scene.add(shadowMesh);

  const bodyMesh = new THREE.Mesh(geometry, bodyMaterial);
  rootGroup.add(bodyMesh);

  // 3D Extra attachments group (Dumpling pleats, Cat Paw toe beans, Peanut cream puff)
  const decoGroup = new THREE.Group();
  rootGroup.add(decoGroup);

  // Dumpling 3D top pleated dough knots
  const dumplingGroup = new THREE.Group();
  const knotGeo = new THREE.SphereGeometry(0.15, 24, 18);
  knotGeo.scale(0.95, 1.28, 0.88);
  const knotMat = new THREE.MeshPhysicalMaterial({
    color: '#f5c4a8',
    roughness: 0.34,
    clearcoat: 0.6,
    sheen: 0.7,
    sheenColor: new THREE.Color('#fff0e5'),
    envMapIntensity: 0.35,
  });
  [-0.24, 0, 0.24].forEach((ax, idx) => {
    const m = new THREE.Mesh(knotGeo, knotMat);
    m.position.set(ax, 0.96 + (idx === 1 ? 0.05 : 0), 0.05);
    m.rotation.z = -ax * 1.15;
    dumplingGroup.add(m);
  });
  decoGroup.add(dumplingGroup);

  // Cat Paw 3D puffy toe beans + raised 3D pink jelly pads
  const catpawGroup = new THREE.Group();
  const toeWhiteGeo = new THREE.SphereGeometry(0.22, 28, 22);
  toeWhiteGeo.scale(0.94, 1.14, 0.76);
  const toePinkGeo = new THREE.SphereGeometry(0.13, 24, 18);
  toePinkGeo.scale(0.94, 1.12, 0.58);
  const toeWhiteMat = new THREE.MeshPhysicalMaterial({
    color: '#ffd4e6',
    roughness: 0.34,
    clearcoat: 0.65,
    sheen: 0.8,
    sheenColor: new THREE.Color('#fff0f7'),
    envMapIntensity: 0.35,
  });
  const toePinkMat = new THREE.MeshPhysicalMaterial({
    color: '#ff78ad',
    roughness: 0.22,
    clearcoat: 0.85,
    envMapIntensity: 0.45,
  });
  const toeCoords = [
    [-0.58, 0.76, -0.36],
    [-0.21, 0.96, -0.12],
    [0.21, 0.96, 0.12],
    [0.58, 0.76, 0.36],
  ];
  toeCoords.forEach(([tx, ty, rotZ]) => {
    const tg = new THREE.Group();
    tg.position.set(tx, ty, 0.05);
    tg.rotation.z = -rotZ;
    const whiteMesh = new THREE.Mesh(toeWhiteGeo, toeWhiteMat);
    const pinkMesh = new THREE.Mesh(toePinkGeo, toePinkMat);
    pinkMesh.position.set(0, -0.02, 0.12);
    tg.add(whiteMesh);
    tg.add(pinkMesh);
    catpawGroup.add(tg);
  });
  decoGroup.add(catpawGroup);

  // Peanut 3D cream puff top
  const peanutGroup = new THREE.Group();
  const puffGeo = new THREE.SphereGeometry(0.23, 24, 18);
  puffGeo.scale(1.18, 0.64, 0.88);
  const puffMat = new THREE.MeshPhysicalMaterial({
    color: '#fff4e2',
    roughness: 0.36,
    clearcoat: 0.5,
    envMapIntensity: 0.35,
  });
  const puffMesh = new THREE.Mesh(puffGeo, puffMat);
  puffMesh.position.set(0, 1.01, 0.06);
  peanutGroup.add(puffMesh);
  decoGroup.add(peanutGroup);

  let sculptedCharIdx = -1;
  let rotX = 0;
  let rotY = 0;
  let lastTexKey = '';
  let lastTexUpdateTime = -1;

  function sculptCharacterGeometry(chIdx, charObj) {
    sculptedCharIdx = chIdx;
    const deco = charObj.deco;
    const n = charObj.n;

    dumplingGroup.visible = deco === 'dumpling';
    catpawGroup.visible = deco === 'catpaw';
    peanutGroup.visible = deco === 'peanut';

    const depthScale =
      deco === 'toast'
        ? 0.54
        : deco === 'butter'
          ? 0.68
          : deco === 'catpaw'
            ? 0.76
            : deco === 'peanut'
              ? 0.82
              : deco === 'cheese'
                ? 0.88
                : 0.94;
    const widthScale =
      deco === 'butter' ? 0.86 : deco === 'peanut' ? 0.84 : 1.0;
    const heightScale = deco === 'butter' ? 1.04 : 1.0;

    for (let i = 0; i < vertexCount; i += 1) {
      const nx = unitDirs[i * 3];
      const ny = unitDirs[i * 3 + 1];
      const nz = unitDirs[i * 3 + 2];

      const powSum =
        Math.pow(Math.abs(nx), n) +
        Math.pow(Math.abs(ny), n) +
        Math.pow(Math.abs(nz), n);
      let r = 1 / (Math.pow(powSum, 1 / n) || 1);

      if (deco === 'peanut') {
        const waist = 1 - Math.abs(ny);
        r *= 1 - 0.24 * Math.pow(waist, 2.6) + 0.08 * ny * ny;
        const angle = Math.atan2(nx, nz);
        r += 0.014 * Math.cos(angle * 16) * (1 - ny * ny);
      } else if (deco === 'toast') {
        if (ny > 0.12) {
          r *= 1 + 0.11 * Math.pow(Math.abs(nx), 1.5) * ny;
        }
        const frontDist = Math.hypot(nx, ny);
        if (Math.abs(nz) > 0.45 && frontDist > 0.72) {
          r += 0.03 * Math.sin(((frontDist - 0.72) / 0.28) * Math.PI);
        }
      } else if (deco === 'dumpling') {
        r *= 1 + 0.07 * Math.max(0, -ny);
        if (ny > 0.22) {
          const angle = Math.atan2(nx, nz);
          const pleatFactor = Math.pow((ny - 0.22) / 0.78, 1.3);
          r += 0.022 * pleatFactor * Math.cos(angle * 12);
        }
      } else if (deco === 'cheese') {
        for (let h = 0; h < CHEESE_HOLES_3D.length; h += 1) {
          const [hx, hy, hz, hr, hDepth] = CHEESE_HOLES_3D[h];
          const lenH = Math.hypot(hx, hy, hz) || 1;
          const d = Math.hypot(nx - hx / lenH, ny - hy / lenH, nz - hz / lenH);
          if (d < hr) {
            const tHole = 1 - (d / hr) * (d / hr);
            r -= hDepth * tHole * tHole;
          }
        }
      }

      const bx = nx * r * widthScale;
      const by = ny * r * heightScale;
      const bz = nz * r * depthScale;

      basePositions[i * 3] = bx;
      basePositions[i * 3 + 1] = by;
      basePositions[i * 3 + 2] = bz;

      posAttr.setXYZ(i, bx, by, bz);

      const u = 0.5 + clampVal(bx / (widthScale * 1.04), -0.98, 0.98) * 0.48;
      const v = 0.5 + clampVal(by / (heightScale * 1.04), -0.98, 0.98) * 0.48;
      uvAttr.setXY(i, u, v);
    }

    uvAttr.needsUpdate = true;
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  function updateTexture(charObj, sq, blink, lx, ly) {
    const W = 1024;
    const H = 1024;
    const deco = charObj.deco;
    const pal = CHAR_3D_PALETTES[deco] || [charObj.c1, charObj.c2, charObj.c3];

    tctx.setTransform(texScale, 0, 0, texScale, 0, 0);
    tctx.clearRect(0, 0, W, H);

    // Rich 3D spherical shading gradient baked into albedo to amplify 3D depth
    const bgGrad = tctx.createRadialGradient(
      W * 0.34,
      H * 0.26,
      W * 0.04,
      W * 0.54,
      H * 0.56,
      W * 0.66
    );
    bgGrad.addColorStop(0, pal[0]);
    bgGrad.addColorStop(0.52, pal[1]);
    bgGrad.addColorStop(1, pal[2]);
    tctx.fillStyle = bgGrad;
    tctx.fillRect(0, 0, W, H);

    // Subtle 3D ambient-occlusion rim darkening around outer perimeter
    const rimGrad = tctx.createRadialGradient(
      W * 0.5,
      H * 0.5,
      W * 0.32,
      W * 0.5,
      H * 0.5,
      W * 0.54
    );
    rimGrad.addColorStop(0, 'rgba(90, 28, 68, 0)');
    rimGrad.addColorStop(1, 'rgba(90, 28, 68, 0.24)');
    tctx.fillStyle = rimGrad;
    tctx.fillRect(0, 0, W, H);

    // Character-specific surface artwork
    if (deco === 'butter') {
      const capGrad = tctx.createLinearGradient(0, 0, W, H * 0.37);
      capGrad.addColorStop(0, '#ffe373');
      capGrad.addColorStop(0.6, '#ffd23f');
      capGrad.addColorStop(1, '#e8b51e');
      tctx.fillStyle = capGrad;
      tctx.fillRect(0, 0, W, H * 0.37);

      tctx.fillStyle = 'rgba(155, 108, 6, 0.26)';
      tctx.fillRect(0, H * 0.37, W, H * 0.013);

      tctx.fillStyle = '#7d5e00';
      tctx.font = '800 68px Nunito, Fredoka, sans-serif';
      tctx.textAlign = 'center';
      tctx.textBaseline = 'middle';
      tctx.fillText('BUTTER', W * 0.5, H * 0.24);

      tctx.fillStyle = '#997a1e';
      tctx.font = '800 38px Nunito, sans-serif';
      tctx.fillText('4oz', W * 0.5, H * 0.78);
      tctx.fillStyle = '#ab8f3a';
      tctx.font = '700 29px Nunito, sans-serif';
      tctx.fillText('NET WT. (113 G)', W * 0.5, H * 0.835);
    } else if (deco === 'toast') {
      tctx.strokeStyle = '#b87a30';
      tctx.lineWidth = 64;
      tctx.strokeRect(24, 24, W - 48, H - 48);

      tctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
      tctx.beginPath();
      tctx.roundRect(W * 0.22, H * 0.16, W * 0.56, H * 0.16, 48);
      tctx.fill();
    } else if (deco === 'cheese') {
      const craterSpots = [
        [0.33, 0.29, 0.068],
        [0.68, 0.33, 0.088],
        [0.29, 0.67, 0.075],
        [0.69, 0.69, 0.078],
        [0.54, 0.38, 0.048],
      ];
      craterSpots.forEach(([cx, cy, cr]) => {
        const cg = tctx.createRadialGradient(
          W * (cx - cr * 0.25),
          H * (cy - cr * 0.25),
          W * cr * 0.1,
          W * cx,
          H * cy,
          W * cr
        );
        cg.addColorStop(0, 'rgba(186, 116, 8, 0.68)');
        cg.addColorStop(0.75, 'rgba(212, 144, 20, 0.45)');
        cg.addColorStop(1, 'rgba(255, 232, 140, 0)');
        tctx.fillStyle = cg;
        tctx.beginPath();
        tctx.arc(W * cx, H * cy, W * cr, 0, Math.PI * 2);
        tctx.fill();
      });
    } else if (deco === 'dumpling') {
      // Subtle steamed bao pleat lines radiating from top + pink heart
      tctx.strokeStyle = 'rgba(198, 128, 102, 0.26)';
      tctx.lineWidth = 8;
      for (const ox of [-140, -65, 65, 140]) {
        tctx.beginPath();
        tctx.moveTo(W * 0.5 + ox * 0.35, H * 0.06);
        tctx.quadraticCurveTo(
          W * 0.5 + ox * 0.85,
          H * 0.15,
          W * 0.5 + ox,
          H * 0.24
        );
        tctx.stroke();
      }

      const hx = W * 0.5;
      const hy = H * 0.31;
      const hs = 33;
      tctx.fillStyle = '#e86496';
      tctx.beginPath();
      tctx.moveTo(hx, hy + hs);
      tctx.bezierCurveTo(
        hx - hs * 1.4,
        hy,
        hx - hs * 0.8,
        hy - hs * 1.1,
        hx,
        hy - hs * 0.35
      );
      tctx.bezierCurveTo(
        hx + hs * 0.8,
        hy - hs * 1.1,
        hx + hs * 1.4,
        hy,
        hx,
        hy + hs
      );
      tctx.fill();
    } else if (deco === 'catpaw') {
      // Soft pink central cushion blush behind face
      const pg = tctx.createRadialGradient(
        W * 0.5,
        H * 0.58,
        20,
        W * 0.5,
        H * 0.58,
        240
      );
      pg.addColorStop(0, 'rgba(255, 132, 182, 0.38)');
      pg.addColorStop(1, 'rgba(255, 132, 182, 0)');
      tctx.fillStyle = pg;
      tctx.beginPath();
      tctx.arc(W * 0.5, H * 0.58, 240, 0, Math.PI * 2);
      tctx.fill();
    } else if (deco === 'peanut') {
      tctx.strokeStyle = 'rgba(142, 88, 34, 0.28)';
      tctx.lineWidth = 11;
      tctx.beginPath();
      tctx.arc(W * 0.38, H * 0.34, W * 0.2, Math.PI * 0.75, Math.PI * 1.25);
      tctx.stroke();
      tctx.beginPath();
      tctx.arc(W * 0.62, H * 0.66, W * 0.2, -Math.PI * 0.25, Math.PI * 0.25);
      tctx.stroke();
    }

    // Kawaii face mapped onto the 3D surface
    const fx = W * 0.5 + clampVal(lx, -1, 1) * 44;
    const fy = H * 0.54 + clampVal(ly, -1, 1) * 24;
    const eyeSpan = 132;
    const ink = '#3b1c3b';

    // Rosy 3D cheeks
    tctx.fillStyle = 'rgba(255, 86, 130, 0.62)';
    for (const sd of [-1, 1]) {
      tctx.beginPath();
      tctx.ellipse(fx + sd * 208, fy + 58, 48, 31, 0, 0, Math.PI * 2);
      tctx.fill();
    }

    tctx.strokeStyle = ink;
    tctx.fillStyle = ink;
    tctx.lineWidth = 19;
    tctx.lineCap = 'round';
    tctx.lineJoin = 'round';

    for (const sd of [-1, 1]) {
      const ox = fx + sd * eyeSpan;
      if (sq > 0.32) {
        tctx.beginPath();
        tctx.moveTo(ox - sd * 32, fy - 32);
        tctx.lineTo(ox + sd * 32, fy);
        tctx.lineTo(ox - sd * 32, fy + 32);
        tctx.stroke();
      } else if (blink < 0) {
        tctx.beginPath();
        tctx.moveTo(ox - 28, fy);
        tctx.lineTo(ox + 28, fy);
        tctx.stroke();
      } else {
        tctx.beginPath();
        tctx.ellipse(
          ox,
          fy,
          24,
          sq < -0.22 ? 35 : 29,
          0,
          0,
          Math.PI * 2
        );
        tctx.fill();

        tctx.fillStyle = '#ffffff';
        tctx.beginPath();
        tctx.arc(ox - 7, fy - 9, 8.5, 0, Math.PI * 2);
        tctx.fill();
        tctx.beginPath();
        tctx.arc(ox + 6, fy + 8, 4, 0, Math.PI * 2);
        tctx.fill();
        tctx.fillStyle = ink;
      }
    }

    tctx.beginPath();
    if (sq > 0.32) {
      tctx.fillStyle = '#d94b78';
      tctx.ellipse(
        fx,
        fy + 84,
        32,
        40 * (1 + sq * 0.35),
        0,
        0,
        Math.PI * 2
      );
      tctx.fill();
      tctx.strokeStyle = ink;
      tctx.lineWidth = 14;
      tctx.stroke();
    } else if (sq < -0.22) {
      tctx.fillStyle = ink;
      tctx.ellipse(fx, fy + 78, 22, 27, 0, 0, Math.PI * 2);
      tctx.fill();
    } else {
      tctx.strokeStyle = ink;
      tctx.lineWidth = 18;
      tctx.arc(fx, fy + 42, 44, 0.15 * Math.PI, 0.85 * Math.PI);
      tctx.stroke();
    }

    bodyTexture.needsUpdate = true;
  }

  function renderFrame(state) {
    const {
      W,
      H,
      cx,
      floor,
      R,
      ch,
      charObj,
      sq,
      sqv,
      press,
      px,
      py,
      lx,
      ly,
      blink,
      t,
      dt,
    } = state;

    if (!W || !H) return;

    const dpr = Math.min(perf.maxDpr || 1.5, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }

    const charChanged = sculptedCharIdx !== ch;
    if (charChanged) {
      sculptCharacterGeometry(ch, charObj);
    }

    // Dirty-checked & rate-limited GPU texture upload
    const texKey = `${ch}:${Math.round(sq * 22)}:${blink < 0 ? 1 : 0}:${Math.round(
      clampVal(lx, -1, 1) * 12
    )}:${Math.round(clampVal(ly, -1, 1) * 12)}`;
    const minTexInterval = 1 / (perf.textureFps || 20);
    if (
      charChanged ||
      (texKey !== lastTexKey && t - lastTexUpdateTime >= minTexInterval)
    ) {
      lastTexKey = texKey;
      lastTexUpdateTime = t;
      updateTexture(charObj, sq, blink, lx, ly);
    }

    const visH = 2 * camZ * Math.tan((fov * Math.PI) / 360);
    const pxPerUnit = H / visH;
    const rWorld = R / pxPerUnit;

    const sx = 1 + 0.3 * sq;
    const sy = 1 - 0.42 * sq;
    const sz = 1 + 0.28 * sq;

    const cyPx = floor - R * sy;
    const worldX = (cx - W / 2) / pxPerUnit;
    const worldY = (H / 2 - cyPx) / pxPerUnit;
    const floorWorldY = (H / 2 - (floor + 6)) / pxPerUnit;

    shadowMesh.position.set(worldX, floorWorldY, -0.6);
    shadowMesh.scale.set(rWorld * (1 + 0.28 * sq), rWorld, 1);

    rootGroup.position.set(worldX, worldY, 0);
    rootGroup.scale.set(rWorld * sx, rWorld * sy, rWorld * sz);

    // Distinct 3/4 3D showcase angle + pointer tracking + soft-body wobble
    const baseYaw =
      charObj.deco === 'cheese' || charObj.deco === 'butter' || charObj.deco === 'toast'
        ? -0.22
        : -0.14;
    const targetRotY =
      baseYaw +
      clampVal(lx, -1.2, 1.2) * 0.4 +
      0.16 * Math.sin(t * 1.15) +
      sqv * 0.016;
    const targetRotX =
      0.08 +
      clampVal(ly, -1.2, 1.2) * 0.22 +
      0.05 * Math.cos(t * 0.9) -
      sq * 0.14;
    const lerpFactor = Math.min(1, dt * 8);
    rotY += (targetRotY - rotY) * lerpFactor;
    rotX += (targetRotX - rotX) * lerpFactor;

    rootGroup.rotation.set(rotX, rotY, Math.sin(t * 1.4) * 0.025 + sqv * 0.008);

    // 3D local vertex denting under the pointer when pressed
    const localPx = (px - cx) / (R * sx || 1);
    const localPy = (cyPx - py) / (R * sy || 1);
    let needsNormalUpdate = false;

    for (let i = 0; i < vertexCount; i += 1) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];

      let tgt = 0;
      if (press && bz > -0.1) {
        const dPointer = Math.hypot(bx - localPx, by - localPy);
        const falloff = Math.max(0, 1 - dPointer / 0.85);
        tgt = -0.35 * falloff * falloff;
      }

      const cur = dentOffsets[i];
      let vel = dentVel[i];
      vel += (180 * (tgt - cur) - 10 * vel) * dt;
      const next = cur + vel * dt;
      dentOffsets[i] = next;
      dentVel[i] = vel;

      if (Math.abs(next) > 0.0005 || Math.abs(cur) > 0.0005) {
        needsNormalUpdate = true;
        const nx = unitDirs[i * 3];
        const ny = unitDirs[i * 3 + 1];
        const nz = unitDirs[i * 3 + 2];
        posAttr.setXYZ(
          i,
          bx + nx * next * 0.7,
          by + ny * next * 0.7,
          bz + nz * next
        );
      }
    }

    if (needsNormalUpdate) {
      posAttr.needsUpdate = true;
      geometry.computeVertexNormals();
    }

    renderer.render(scene, camera);
  }

  function dispose() {
    scene.environment = null;
    if (envMap) envMap.dispose();
    if (roomEnv) roomEnv.dispose?.();
    if (pmremGenerator) pmremGenerator.dispose();
    shadowTex.dispose();
    shadowGeo.dispose();
    shadowMat.dispose();
    bodyTexture.dispose();
    geometry.dispose();
    bodyMaterial.dispose();
    knotGeo.dispose();
    knotMat.dispose();
    toeWhiteGeo.dispose();
    toePinkGeo.dispose();
    toeWhiteMat.dispose();
    toePinkMat.dispose();
    puffGeo.dispose();
    puffMat.dispose();
    renderer.dispose();
  }

  return { renderFrame, dispose };
}

function clampVal(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
