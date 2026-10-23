import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';

const TARGET_SIZE = 2; // the model's largest dimension gets scaled to this

function Model({ url }) {
  const { scene } = useGLTF(url);

  // Clone so the cached scene isn't mutated, then center and normalize once.
  const { object, scale, offset } = useMemo(() => {
    const object = scene.clone(true);
    object.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(object, true); // true = precise, uses real vertices
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

function Loader() {
  const { progress } = useProgress();
  return <Html center>{Math.round(progress)}%</Html>;
}

export default function ProductViewer3D({ url, alt }) {
  return (
    <div
      role="img"
      aria-label={alt}
      style={{ width: '100%', aspectRatio: '1 / 1', touchAction: 'none' }}
    >
      <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [0, 0, 5] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment preset="city" />

        <Suspense fallback={<Loader />}>
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
    </div>
  );
}