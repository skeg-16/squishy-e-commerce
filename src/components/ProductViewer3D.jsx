import { Component, Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const TARGET_SIZE = 2.1; // the model's largest dimension gets scaled to this

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

function Model({ url }) {
  const { scene } = useGLTF(url);

  // Clone so the cached scene isn't mutated, then center and normalize once.
  const { object, scale, offset } = useMemo(() => {
    const object = scene.clone(true);
    object.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(object, true);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = TARGET_SIZE / maxDim;

    return { object, scale, offset: center.multiplyScalar(-1) };
  }, [scene]);

  return (
    <group scale={scale}>
      <group position={offset}>
        <primitive object={object} />
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

export default function ProductViewer3D({ url, alt, fallbackImage }) {
  const fallback = fallbackImage ? (
    <img src={fallbackImage} alt={alt} width="420" height="420" />
  ) : null;

  return (
    <ViewerErrorBoundary fallback={fallback}>
      <div
        role="img"
        aria-label={alt}
        className="viewer-3d-stage"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          aspectRatio: '1 / 1',
          touchAction: 'none',
        }}
      >
        <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [0, 0, 5] }}>
          <ambientLight intensity={0.45} />
          <hemisphereLight args={['#fff8f4', '#e8d5c4', 0.5]} />
          <directionalLight position={[5, 5, 5]} intensity={0.85} />
          <directionalLight position={[-4, 3, -3]} intensity={0.35} />
          <StudioEnvironment />

          <Suspense fallback={null}>
            <Model url={url} />
          </Suspense>

          <OrbitControls
            target={[0, 0, 0]}
            autoRotate
            autoRotateSpeed={1.5}
            enablePan={false}
            minDistance={3}
            maxDistance={8}
          />
        </Canvas>
        <span className="viewer-3d-hint" aria-hidden="true">
          3D · Drag to rotate
        </span>
      </div>
    </ViewerErrorBoundary>
  );
}
