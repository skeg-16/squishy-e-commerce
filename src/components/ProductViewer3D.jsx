import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getPerfProfile } from '../utils/devicePerf';

const TARGET_SIZE = 2.15; // the model's largest dimension gets scaled to this

function getModelPose(url = '', size) {
  const lower = url.toLowerCase();
  if (lower.includes('catpaw')) {
    return {
      rotation: [0.14, Math.PI - 0.28, 0],
      sizeBoost: 1.06,
    };
  }
  if (lower.includes('toast')) {
    return {
      rotation: [0.88, 0.28, -0.1],
      sizeBoost: 1.12,
    };
  }
  if (lower.includes('butter')) {
    return {
      rotation: [0.84, -0.34, 0.1],
      sizeBoost: 1.15,
    };
  }
  if (lower.includes('peanut')) {
    return {
      rotation: [0.32, 0.38, 0.18],
      sizeBoost: 1.14,
    };
  }
  // Fallback: if a model is flat on Y, tilt it toward the camera
  if (size && size.y < Math.min(size.x, size.z) * 0.6) {
    return {
      rotation: [0.82, 0.25, 0],
      sizeBoost: 1.1,
    };
  }
  return {
    rotation: [0.08, 0.22, 0],
    sizeBoost: 1.0,
  };
}

function StudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    gl.toneMappingExposure = 0.92;
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envMap = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envMap;

    return () => {
      scene.environment = null;
      envMap.dispose();
      roomEnv.dispose?.();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
}

function Model({ url, pressedRef, pulseSignal }) {
  const { scene } = useGLTF(url);
  const squishGroupRef = useRef(null);
  const springRef = useRef({ sq: 0, v: 0, lastPulse: 0 });

  // Clone so the cached scene isn't mutated, then center and normalize once.
  const { object, scale, offset, halfHeight, poseRotation } = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(cloned, true);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const pose = getModelPose(url, size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const normScale = (TARGET_SIZE * pose.sizeBoost) / maxDim;

    return {
      object: cloned,
      scale: normScale,
      offset: center.multiplyScalar(-1),
      halfHeight: (Math.max(size.y, size.z * 0.5) * normScale) / 2,
      poseRotation: pose.rotation,
    };
  }, [scene, url]);

  useFrame((_, delta) => {
    const dt = Math.min(0.04, delta);
    const st = springRef.current;
    if (pulseSignal && pulseSignal !== st.lastPulse) {
      st.lastPulse = pulseSignal;
      st.sq = 0.85;
      st.v = 1.2;
    }
    const isPressed = pressedRef?.current;
    const target = isPressed ? 1 : 0;
    const k = isPressed ? 130 : 34;
    const d = isPressed ? 14 : 3.4;
    st.v += (k * (target - st.sq) - d * st.v) * dt;
    st.sq += st.v * dt;

    if (squishGroupRef.current) {
      const sx = 1 + 0.28 * st.sq;
      const sy = Math.max(0.45, 1 - 0.36 * st.sq);
      squishGroupRef.current.scale.set(sx, sy, sx);
      squishGroupRef.current.position.y = -halfHeight * (1 - sy);
    }
  });

  return (
    <group ref={squishGroupRef}>
      <group rotation={poseRotation} scale={scale}>
        <group position={offset}>
          <primitive object={object} />
        </group>
      </group>
    </group>
  );
}

class ViewerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}

export default function ProductViewer3D({
  url,
  alt,
  fallbackImage,
  compact = false,
  pulseSignal = 0,
  onSquish,
}) {
  const perf = useMemo(() => getPerfProfile(), []);
  const stageRef = useRef(null);
  const pressedRef = useRef(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(Boolean(entry?.isIntersecting));
      },
      { rootMargin: '120px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fallback = fallbackImage ? (
    <img src={fallbackImage} alt={alt} width="420" height="420" loading="lazy" />
  ) : null;

  return (
    <ViewerErrorBoundary fallback={fallback}>
      <div
        ref={stageRef}
        role="img"
        aria-label={alt}
        className={`viewer-3d-stage${compact ? ' viewer-3d-stage--compact' : ''}`}
        onPointerDown={() => {
          pressedRef.current = true;
          if (onSquish) onSquish();
        }}
        onPointerUp={() => {
          pressedRef.current = false;
        }}
        onPointerLeave={() => {
          pressedRef.current = false;
        }}
        onPointerCancel={() => {
          pressedRef.current = false;
        }}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          aspectRatio: compact ? '4 / 3.1' : '1 / 1',
          touchAction: 'pan-y',
        }}
      >
        <Canvas
          frameloop={isVisible ? 'always' : 'never'}
          dpr={[1, perf.maxDpr || 1.5]}
          camera={{ fov: compact ? 36 : 40, position: [0, 0.2, 4.8] }}
        >
          <ambientLight intensity={compact || !perf.enableEnvMap ? 0.68 : 0.48} />
          <hemisphereLight args={['#fff8f4', '#e8d5c4', 0.65]} />
          <directionalLight position={[5, 5, 5]} intensity={0.95} />
          <directionalLight position={[-4, 3, -3]} intensity={0.42} />
          {!compact && perf.enableEnvMap ? <StudioEnvironment /> : null}

          <Suspense fallback={null}>
            <Model url={url} pressedRef={pressedRef} pulseSignal={pulseSignal} />
          </Suspense>

          <OrbitControls
            target={[0, 0, 0]}
            autoRotate={isVisible && !perf.prefersReducedMotion}
            autoRotateSpeed={compact ? 1.8 : 1.5}
            enablePan={false}
            enableZoom={!compact}
            minDistance={3}
            maxDistance={8}
          />
        </Canvas>
        <span className="viewer-3d-hint" aria-hidden="true">
          {compact ? '3D · Drag or press to squish' : '3D · Drag to rotate'}
        </span>
      </div>
    </ViewerErrorBoundary>
  );
}
