import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getPerfProfile } from '../utils/devicePerf';

const TARGET_SIZE = 2.08; // the model's largest dimension gets scaled to this

function getModelPose(url = '', size) {
  const lower = url.toLowerCase();
  if (lower.includes('catpaw')) {
    return {
      rotation: [0.14, -0.22, 0],
      sizeBoost: 0.98,
    };
  }
  if (lower.includes('toast')) {
    return {
      rotation: [0.88, 0.24, -0.08],
      sizeBoost: 1.02,
    };
  }
  if (lower.includes('butter')) {
    return {
      rotation: [0.84, -0.28, 0.08],
      sizeBoost: 1.04,
    };
  }
  if (lower.includes('peanut')) {
    return {
      rotation: [0.3, 0.34, 0.16],
      sizeBoost: 1.04,
    };
  }
  // Fallback: if a model is flat on Y, tilt it toward the camera
  if (size && size.y < Math.min(size.x, size.z) * 0.6) {
    return {
      rotation: [0.82, 0.25, 0],
      sizeBoost: 1.0,
    };
  }
  return {
    rotation: [0.08, 0.2, 0],
    sizeBoost: 0.94,
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

function ProceduralCheeseModel({ pressedRef, pulseSignal, scaleBoost = 1 }) {
  const squishGroupRef = useRef(null);
  const swayGroupRef = useRef(null);
  const springRef = useRef({ sq: 0, v: 0, lastPulse: 0 });
  const halfHeight = 0.9 * scaleBoost;

  useFrame((state, delta) => {
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
    if (swayGroupRef.current) {
      swayGroupRef.current.rotation.y =
        -0.38 + Math.sin(state.clock.elapsedTime * 1.15) * 0.28;
    }
  });

  const frontPockets = [
    [-0.44, 0.36, 0.778, 0.17],
    [0.38, 0.44, 0.778, 0.13],
    [0.44, -0.34, 0.778, 0.18],
    [-0.36, -0.38, 0.778, 0.12],
  ];
  const sidePockets = [
    [0.778, 0.28, 0.28, 0.17],
    [0.778, -0.28, -0.22, 0.15],
    [0.778, 0.05, -0.38, 0.11],
  ];
  const topPockets = [
    [-0.26, 0.738, 0.2, 0.16],
    [0.3, 0.738, -0.24, 0.14],
  ];

  return (
    <group ref={squishGroupRef}>
      <group
        ref={swayGroupRef}
        rotation={[0.22, -0.38, 0.04]}
        scale={1.08 * scaleBoost}
      >
        {/* Main Soft Rounded Swiss Cheese Cube */}
        <RoundedBox args={[1.56, 1.48, 1.56]} radius={0.26} smoothness={5}>
          <meshStandardMaterial
            color="#ffd84d"
            roughness={0.36}
            metalness={0.02}
          />
        </RoundedBox>

        {/* Flush Swiss Cheese Pockets (Front, Side, Top) */}
        {frontPockets.map(([x, y, z, r], idx) => (
          <mesh key={`f-${idx}`} position={[x, y, z]} scale={[1, 1, 0.12]}>
            <sphereGeometry args={[r, 20, 20]} />
            <meshStandardMaterial color="#d9920f" roughness={0.55} />
          </mesh>
        ))}
        {sidePockets.map(([x, y, z, r], idx) => (
          <mesh key={`s-${idx}`} position={[x, y, z]} scale={[0.12, 1, 1]}>
            <sphereGeometry args={[r, 20, 20]} />
            <meshStandardMaterial color="#d9920f" roughness={0.55} />
          </mesh>
        ))}
        {topPockets.map(([x, y, z, r], idx) => (
          <mesh key={`t-${idx}`} position={[x, y, z]} scale={[1, 0.12, 1]}>
            <sphereGeometry args={[r, 20, 20]} />
            <meshStandardMaterial color="#d9920f" roughness={0.55} />
          </mesh>
        ))}

        {/* Cute Kawaii Face on Front Face */}
        <mesh position={[-0.26, 0.04, 0.79]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color="#3b1d2e" roughness={0.2} />
        </mesh>
        <mesh position={[-0.28, 0.065, 0.85]}>
          <sphereGeometry args={[0.024, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        <mesh position={[0.26, 0.04, 0.79]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color="#3b1d2e" roughness={0.2} />
        </mesh>
        <mesh position={[0.24, 0.065, 0.85]}>
          <sphereGeometry args={[0.024, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Rosy Cheeks */}
        <mesh position={[-0.42, -0.06, 0.78]} scale={[1.3, 0.85, 0.5]}>
          <sphereGeometry args={[0.075, 14, 14]} />
          <meshBasicMaterial color="#ff85ad" transparent opacity={0.75} />
        </mesh>
        <mesh position={[0.42, -0.06, 0.78]} scale={[1.3, 0.85, 0.5]}>
          <sphereGeometry args={[0.075, 14, 14]} />
          <meshBasicMaterial color="#ff85ad" transparent opacity={0.75} />
        </mesh>

        {/* Cute Smile Arc */}
        <mesh position={[0, -0.05, 0.79]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.085, 0.024, 12, 24, Math.PI]} />
          <meshStandardMaterial color="#3b1d2e" roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function GlbModel({ url, pressedRef, pulseSignal, scaleBoost = 1 }) {
  const { scene } = useGLTF(url);
  const squishGroupRef = useRef(null);
  const swayGroupRef = useRef(null);
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
    const normScale = (TARGET_SIZE * pose.sizeBoost * scaleBoost) / maxDim;

    return {
      object: cloned,
      scale: normScale,
      offset: center.multiplyScalar(-1),
      halfHeight: (Math.max(size.y, size.z * 0.5) * normScale) / 2,
      poseRotation: pose.rotation,
    };
  }, [scene, url, scaleBoost]);

  useFrame((state, delta) => {
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

    if (swayGroupRef.current) {
      swayGroupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 1.1) * 0.34;
    }
  });

  return (
    <group ref={squishGroupRef}>
      <group ref={swayGroupRef}>
        <group rotation={poseRotation} scale={scale}>
          <group position={offset}>
            <primitive object={object} />
          </group>
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
  scaleBoost = 1,
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

  const isProceduralCheese = url === 'procedural:cheese';

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
          camera={{ fov: compact ? 37 : 40, position: [0, 0.16, 4.75] }}
        >
          <ambientLight intensity={compact || !perf.enableEnvMap ? 0.72 : 0.52} />
          <hemisphereLight args={['#fff8f4', '#e8d5c4', 0.68]} />
          <directionalLight position={[5, 5, 5]} intensity={0.95} />
          <directionalLight position={[-4, 3, -3]} intensity={0.45} />
          {!compact && perf.enableEnvMap ? <StudioEnvironment /> : null}

          <Suspense fallback={null}>
            {isProceduralCheese ? (
              <ProceduralCheeseModel
                pressedRef={pressedRef}
                pulseSignal={pulseSignal}
                scaleBoost={scaleBoost}
              />
            ) : (
              <GlbModel
                url={url}
                pressedRef={pressedRef}
                pulseSignal={pulseSignal}
                scaleBoost={scaleBoost}
              />
            )}
          </Suspense>

          <OrbitControls
            target={[0, 0, 0]}
            autoRotate={false}
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
