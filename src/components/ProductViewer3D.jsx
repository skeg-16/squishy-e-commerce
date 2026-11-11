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

function ProceduralSquishRig({
  pressedRef,
  pulseSignal,
  scaleBoost = 1,
  baseRotation = [0.2, -0.35, 0.03],
  halfHeight = 0.9,
  children,
}) {
  const squishGroupRef = useRef(null);
  const swayGroupRef = useRef(null);
  const springRef = useRef({ sq: 0, v: 0, lastPulse: 0 });
  const scaledHalf = halfHeight * scaleBoost;

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
      squishGroupRef.current.position.y = -scaledHalf * (1 - sy);
    }
    if (swayGroupRef.current) {
      swayGroupRef.current.rotation.y =
        baseRotation[1] + Math.sin(state.clock.elapsedTime * 1.15) * 0.28;
    }
  });

  return (
    <group ref={squishGroupRef}>
      <group
        ref={swayGroupRef}
        rotation={baseRotation}
        scale={1.06 * scaleBoost}
      >
        {children}
      </group>
    </group>
  );
}

function ProceduralSquishyModel({
  type,
  pressedRef,
  pulseSignal,
  scaleBoost = 1,
}) {
  switch (type) {
    case 'cheese': {
      const frontPockets = [
        [-0.42, 0.34, 0.778, 0.18],
        [0.36, 0.42, 0.778, 0.14],
        [0.4, -0.32, 0.778, 0.19],
        [-0.32, -0.34, 0.778, 0.14],
        [0.02, 0.04, 0.778, 0.16],
      ];
      const sidePockets = [
        [0.778, 0.28, 0.28, 0.17],
        [0.778, -0.28, -0.22, 0.15],
        [0.778, 0.05, -0.38, 0.12],
      ];
      const topPockets = [
        [-0.26, 0.738, 0.2, 0.16],
        [0.3, 0.738, -0.24, 0.14],
      ];
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.22, -0.38, 0.04]}
        >
          <RoundedBox args={[1.56, 1.48, 1.56]} radius={0.26} smoothness={5}>
            <meshStandardMaterial
              color="#ffd84d"
              roughness={0.34}
              metalness={0.02}
            />
          </RoundedBox>
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
        </ProceduralSquishRig>
      );
    }

    case 'strawberry-mochi':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.18, -0.32, 0]}
        >
          {/* Plump Daifuku Mochi Dome */}
          <mesh position={[0, -0.18, 0]} scale={[1.18, 0.78, 1.18]}>
            <sphereGeometry args={[0.88, 32, 28]} />
            <meshStandardMaterial color="#ffd6e6" roughness={0.42} />
          </mesh>
          {/* White Cream Collar Ring */}
          <mesh position={[0, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.32, 0.11, 16, 28]} />
            <meshStandardMaterial color="#fff9fc" roughness={0.35} />
          </mesh>
          {/* Sculpted Ruby Strawberry Crown */}
          <mesh position={[0, 0.62, 0]} scale={[0.88, 1.12, 0.88]}>
            <coneGeometry args={[0.36, 0.62, 24]} />
            <meshStandardMaterial color="#eb3b62" roughness={0.28} />
          </mesh>
          <mesh position={[0, 0.42, 0]} scale={[1, 0.65, 1]}>
            <sphereGeometry args={[0.34, 24, 20]} />
            <meshStandardMaterial color="#eb3b62" roughness={0.28} />
          </mesh>
          {/* Leaf Calyx */}
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i * Math.PI * 2) / 5;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(angle) * 0.22,
                  0.38,
                  Math.sin(angle) * 0.22,
                ]}
                rotation={[0.2, -angle, 0]}
                scale={[1.4, 0.25, 0.65]}
              >
                <sphereGeometry args={[0.12, 12, 12]} />
                <meshStandardMaterial color="#58b86c" roughness={0.4} />
              </mesh>
            );
          })}
        </ProceduralSquishRig>
      );

    case 'matcha-roll':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.24, -0.42, 0.04]}
        >
          {/* Outer Uji Matcha Sponge Cylinder */}
          <RoundedBox args={[1.64, 1.38, 1.16]} radius={0.46} smoothness={5}>
            <meshStandardMaterial color="#8bc474" roughness={0.48} />
          </RoundedBox>
          {/* Cream Fill Core Front & Back */}
          {[0.585, -0.585].map((z, idx) => (
            <group key={idx} position={[0, 0, z]}>
              <mesh scale={[1.05, 0.88, 0.08]}>
                <sphereGeometry args={[0.56, 24, 24]} />
                <meshStandardMaterial color="#fff9f0" roughness={0.35} />
              </mesh>
              <mesh rotation={[0, 0, 0.4]} scale={[1.05, 0.88, 0.1]}>
                <torusGeometry args={[0.28, 0.065, 14, 28, Math.PI * 1.65]} />
                <meshStandardMaterial color="#73ae5c" roughness={0.45} />
              </mesh>
              <mesh position={[0.04, 0.02, 0]} scale={[1, 0.9, 0.12]}>
                <sphereGeometry args={[0.14, 16, 16]} />
                <meshStandardMaterial color="#fffdf9" roughness={0.3} />
              </mesh>
            </group>
          ))}
          {/* Top Cream Rosette Dollop */}
          <mesh position={[0, 0.72, 0]} scale={[1.1, 0.65, 1.1]}>
            <sphereGeometry args={[0.22, 20, 16]} />
            <meshStandardMaterial color="#fff9f2" roughness={0.3} />
          </mesh>
        </ProceduralSquishRig>
      );

    case 'boba-cup': {
      const pearls = [
        [-0.36, -0.62, 0.42],
        [-0.08, -0.66, 0.52],
        [0.24, -0.62, 0.46],
        [0.44, -0.58, 0.24],
        [-0.45, -0.56, 0.16],
        [0.12, -0.52, 0.49],
        [-0.22, -0.49, 0.47],
      ];
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.16, -0.32, 0.02]}
        >
          {/* Milk Tea Cup Body */}
          <mesh position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.72, 0.54, 1.38, 32]} />
            <meshStandardMaterial color="#f3cfa8" roughness={0.32} />
          </mesh>
          {/* Brown Sugar Syrup Wave Band */}
          <mesh position={[0, -0.48, 0]}>
            <cylinderGeometry args={[0.62, 0.545, 0.62, 32]} />
            <meshStandardMaterial color="#b97a45" roughness={0.36} />
          </mesh>
          {/* Cup Rim Ring */}
          <mesh position={[0, 0.54, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.73, 0.065, 16, 36]} />
            <meshStandardMaterial color="#fff7f0" roughness={0.25} />
          </mesh>
          {/* Frosted Dome Lid */}
          <mesh position={[0, 0.54, 0]}>
            <sphereGeometry
              args={[0.71, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.48]}
            />
            <meshStandardMaterial
              color="#fff6fa"
              roughness={0.18}
              transparent
              opacity={0.78}
            />
          </mesh>
          {/* Chunky Pastel Boba Straw */}
          <mesh position={[0.14, 0.88, 0.06]} rotation={[0.08, 0, -0.18]}>
            <cylinderGeometry args={[0.13, 0.13, 0.95, 24]} />
            <meshStandardMaterial color="#ff85b3" roughness={0.28} />
          </mesh>
          {/* Tapioca Pearls */}
          {pearls.map(([x, y, z], idx) => (
            <mesh key={idx} position={[x, y, z]}>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial color="#3b2316" roughness={0.22} />
            </mesh>
          ))}
        </ProceduralSquishRig>
      );
    }

    case 'macaron':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.28, -0.35, 0.05]}
        >
          {/* Top Almond Shell */}
          <mesh position={[0, 0.28, 0]} scale={[1.15, 0.52, 1.15]}>
            <sphereGeometry args={[0.86, 32, 24]} />
            <meshStandardMaterial color="#ff9ec4" roughness={0.34} />
          </mesh>
          {/* Top Ruffled Pied Foot */}
          <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.88, 0.095, 16, 32]} />
            <meshStandardMaterial color="#ffb3d1" roughness={0.48} />
          </mesh>
          {/* Thick Vanilla Buttercream Filling */}
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.78, 0.16, 20, 32]} />
            <meshStandardMaterial color="#fff8ee" roughness={0.28} />
          </mesh>
          {/* Bottom Ruffled Pied Foot */}
          <mesh position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.88, 0.095, 16, 32]} />
            <meshStandardMaterial color="#ffb3d1" roughness={0.48} />
          </mesh>
          {/* Bottom Almond Shell */}
          <mesh position={[0, -0.28, 0]} scale={[1.15, 0.48, 1.15]}>
            <sphereGeometry args={[0.86, 32, 24]} />
            <meshStandardMaterial color="#ff9ec4" roughness={0.34} />
          </mesh>
        </ProceduralSquishRig>
      );

    case 'croissant': {
      const segments = [
        { pos: [0, 0.12, 0.18], scale: [0.62, 0.56, 0.56], rot: [0, 0, 0] },
        {
          pos: [-0.46, 0.06, 0.06],
          scale: [0.5, 0.46, 0.46],
          rot: [0, 0.35, 0.22],
        },
        {
          pos: [0.46, 0.06, 0.06],
          scale: [0.5, 0.46, 0.46],
          rot: [0, -0.35, -0.22],
        },
        {
          pos: [-0.82, -0.08, -0.18],
          scale: [0.38, 0.36, 0.38],
          rot: [0, 0.72, 0.48],
        },
        {
          pos: [0.82, -0.08, -0.18],
          scale: [0.38, 0.36, 0.38],
          rot: [0, -0.72, -0.48],
        },
        {
          pos: [-1.02, -0.22, -0.46],
          scale: [0.25, 0.24, 0.28],
          rot: [0, 1.1, 0.68],
        },
        {
          pos: [1.02, -0.22, -0.46],
          scale: [0.25, 0.24, 0.28],
          rot: [0, -1.1, -0.68],
        },
      ];
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.42, -0.28, 0.04]}
        >
          {segments.map((seg, idx) => (
            <mesh
              key={idx}
              position={seg.pos}
              rotation={seg.rot}
              scale={seg.scale}
            >
              <sphereGeometry args={[1, 24, 24]} />
              <meshStandardMaterial
                color={idx === 0 ? '#e89d42' : idx < 3 ? '#f0ac54' : '#f7be6d'}
                roughness={0.34}
              />
            </mesh>
          ))}
        </ProceduralSquishRig>
      );
    }

    case 'melon-bun':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.32, -0.35, 0.02]}
        >
          {/* Golden Cookie Dome */}
          <mesh position={[0, -0.05, 0]} scale={[1.16, 0.82, 1.16]}>
            <sphereGeometry args={[0.88, 32, 28]} />
            <meshStandardMaterial color="#f8c96b" roughness={0.42} />
          </mesh>
          {/* Criss-Cross Cookie Grooves */}
          {[-0.36, 0, 0.36].map((offset, idx) => (
            <group key={idx}>
              <mesh
                position={[offset, 0.14, 0]}
                rotation={[0, Math.PI / 4, 0]}
                scale={[0.92, 0.68, 0.92]}
              >
                <torusGeometry args={[0.84, 0.026, 12, 32, Math.PI]} />
                <meshStandardMaterial color="#d99535" roughness={0.5} />
              </mesh>
              <mesh
                position={[offset, 0.14, 0]}
                rotation={[0, -Math.PI / 4, 0]}
                scale={[0.92, 0.68, 0.92]}
              >
                <torusGeometry args={[0.84, 0.026, 12, 32, Math.PI]} />
                <meshStandardMaterial color="#d99535" roughness={0.5} />
              </mesh>
            </group>
          ))}
        </ProceduralSquishRig>
      );

    case 'taiyaki':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.18, -0.3, 0.04]}
        >
          {/* Sculpted Waffle Fish Body */}
          <mesh position={[-0.14, 0.04, 0]} scale={[1.28, 0.88, 0.56]}>
            <sphereGeometry args={[0.78, 28, 24]} />
            <meshStandardMaterial color="#e8a24a" roughness={0.42} />
          </mesh>
          {/* Dorsal Crest */}
          <mesh
            position={[-0.08, 0.56, 0]}
            rotation={[0, 0, -0.18]}
            scale={[0.95, 0.42, 0.32]}
          >
            <sphereGeometry args={[0.52, 20, 18]} />
            <meshStandardMaterial color="#d88c32" roughness={0.46} />
          </mesh>
          {/* Tail Fin */}
          <RoundedBox
            position={[0.82, 0.06, 0]}
            rotation={[0, 0, 0.78]}
            args={[0.68, 0.68, 0.34]}
            radius={0.14}
            smoothness={4}
          >
            <meshStandardMaterial color="#e8a24a" roughness={0.42} />
          </RoundedBox>
          {/* Belly Waffle Ribs */}
          {[-0.38, -0.12, 0.14].map((x, idx) => (
            <mesh
              key={idx}
              position={[x, -0.04, 0.42]}
              rotation={[0, 0, 0.2]}
              scale={[0.18, 0.85, 0.15]}
            >
              <capsuleGeometry args={[0.18, 0.45, 8, 12]} />
              <meshStandardMaterial color="#c97d28" roughness={0.5} />
            </mesh>
          ))}
        </ProceduralSquishRig>
      );

    case 'onigiri':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.18, -0.32, 0]}
        >
          {/* Plump Triangular Rice Cushion built from 3 rounded lobes + center */}
          <mesh position={[0, 0.44, 0]} scale={[0.92, 0.88, 0.76]}>
            <sphereGeometry args={[0.58, 24, 24]} />
            <meshStandardMaterial color="#fffaf5" roughness={0.42} />
          </mesh>
          <mesh position={[-0.44, -0.26, 0]} scale={[0.95, 0.82, 0.76]}>
            <sphereGeometry args={[0.58, 24, 24]} />
            <meshStandardMaterial color="#fffaf5" roughness={0.42} />
          </mesh>
          <mesh position={[0.44, -0.26, 0]} scale={[0.95, 0.82, 0.76]}>
            <sphereGeometry args={[0.58, 24, 24]} />
            <meshStandardMaterial color="#fffaf5" roughness={0.42} />
          </mesh>
          <mesh position={[0, -0.04, 0]} scale={[1.15, 0.96, 0.78]}>
            <sphereGeometry args={[0.68, 24, 24]} />
            <meshStandardMaterial color="#fffaf5" roughness={0.42} />
          </mesh>
          {/* Crisp Dark Nori Seaweed Wrap */}
          <RoundedBox
            position={[0, -0.34, 0]}
            args={[0.88, 0.74, 1.12]}
            radius={0.18}
            smoothness={4}
          >
            <meshStandardMaterial color="#253829" roughness={0.55} />
          </RoundedBox>
        </ProceduralSquishRig>
      );

    case 'pudding':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.2, -0.36, 0]}
        >
          {/* Custard Body */}
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.68, 0.92, 1.12, 32]} />
            <meshStandardMaterial color="#ffe074" roughness={0.28} />
          </mesh>
          {/* Glossy Dark Caramel Cap */}
          <mesh position={[0, 0.34, 0]} scale={[1, 0.34, 1]}>
            <sphereGeometry args={[0.7, 32, 20]} />
            <meshStandardMaterial color="#6e3219" roughness={0.18} />
          </mesh>
          {/* Caramel Drips */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i * Math.PI * 2) / 6;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(angle) * 0.67,
                  0.18,
                  Math.sin(angle) * 0.67,
                ]}
                scale={[0.8, 1.35, 0.8]}
              >
                <sphereGeometry args={[0.13, 14, 14]} />
                <meshStandardMaterial color="#6e3219" roughness={0.18} />
              </mesh>
            );
          })}
          {/* Whipped Cream & Cherry */}
          <mesh position={[0, 0.56, 0]} scale={[1.1, 0.68, 1.1]}>
            <sphereGeometry args={[0.26, 20, 16]} />
            <meshStandardMaterial color="#fff9f4" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.16, 20, 20]} />
            <meshStandardMaterial color="#e02f4e" roughness={0.2} />
          </mesh>
        </ProceduralSquishRig>
      );

    case 'donut': {
      const sprinkles = [
        [0.48, 0.28, 0.28, '#ffe36e', 0.4],
        [-0.52, 0.28, 0.22, '#7ce0f8', -0.5],
        [0.18, 0.3, 0.54, '#ffffff', 0.9],
        [-0.22, 0.3, -0.52, '#9ef0b4', 0.2],
        [0.54, 0.28, -0.24, '#c8a6ff', -0.7],
        [-0.48, 0.28, -0.28, '#ffe36e', 1.1],
      ];
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.58, -0.28, 0.06]}
        >
          {/* Golden Yeast Donut Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.64, 0.36, 24, 40]} />
            <meshStandardMaterial color="#f2b86b" roughness={0.38} />
          </mesh>
          {/* Glossy Strawberry Glaze */}
          <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.64, 0.34, 24, 40]} />
            <meshStandardMaterial color="#ff7eb6" roughness={0.22} />
          </mesh>
          {/* Rainbow Pill Sprinkles */}
          {sprinkles.map(([x, y, z, color, rot], idx) => (
            <mesh
              key={idx}
              position={[x, y, z]}
              rotation={[Math.PI / 2, 0, rot]}
            >
              <capsuleGeometry args={[0.04, 0.12, 8, 12]} />
              <meshStandardMaterial color={color} roughness={0.25} />
            </mesh>
          ))}
        </ProceduralSquishRig>
      );
    }

    case 'waffle':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.52, -0.32, 0.04]}
        >
          {/* Thick Rounded Belgian Waffle Base */}
          <RoundedBox args={[1.68, 0.56, 1.68]} radius={0.22} smoothness={5}>
            <meshStandardMaterial color="#f0ae54" roughness={0.4} />
          </RoundedBox>
          {/* Recessed Waffle Pockets */}
          {[-0.44, 0, 0.44].map((x) =>
            [-0.44, 0, 0.44].map((z) => (
              <RoundedBox
                key={`${x}-${z}`}
                position={[x, 0.25, z]}
                args={[0.3, 0.1, 0.3]}
                radius={0.05}
              >
                <meshStandardMaterial color="#cf862e" roughness={0.5} />
              </RoundedBox>
            ))
          )}
          {/* Melting Golden Butter Pat */}
          <RoundedBox
            position={[0, 0.36, 0]}
            rotation={[0, 0.35, 0]}
            args={[0.54, 0.2, 0.54]}
            radius={0.07}
          >
            <meshStandardMaterial color="#fff099" roughness={0.24} />
          </RoundedBox>
        </ProceduralSquishRig>
      );

    case 'dango':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.16, -0.28, -0.38]}
        >
          {/* Bamboo Skewer */}
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 2.25, 16]} />
            <meshStandardMaterial color="#e5c287" roughness={0.45} />
          </mesh>
          {/* Sakura Pink Mochi Top */}
          <mesh position={[0, 0.62, 0]} scale={[1.08, 0.94, 1.08]}>
            <sphereGeometry args={[0.42, 28, 28]} />
            <meshStandardMaterial color="#ffa8cb" roughness={0.34} />
          </mesh>
          {/* Snowy White Mochi Middle */}
          <mesh position={[0, 0.02, 0]} scale={[1.08, 0.94, 1.08]}>
            <sphereGeometry args={[0.42, 28, 28]} />
            <meshStandardMaterial color="#fff9fc" roughness={0.34} />
          </mesh>
          {/* Matcha Green Mochi Bottom */}
          <mesh position={[0, -0.58, 0]} scale={[1.08, 0.94, 1.08]}>
            <sphereGeometry args={[0.42, 28, 28]} />
            <meshStandardMaterial color="#95cf82" roughness={0.34} />
          </mesh>
        </ProceduralSquishRig>
      );

    case 'cloud-puff': {
      const puffs = [
        [0, 0.16, 0, 0.62],
        [-0.52, -0.04, 0.06, 0.48],
        [0.52, -0.04, 0.06, 0.48],
        [-0.26, 0.34, -0.06, 0.46],
        [0.28, 0.32, -0.06, 0.45],
        [0, -0.16, 0.16, 0.5],
      ];
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.16, -0.3, 0]}
        >
          {puffs.map(([x, y, z, r], idx) => (
            <mesh key={idx} position={[x, y, z]}>
              <sphereGeometry args={[r, 26, 26]} />
              <meshStandardMaterial color="#e8f2ff" roughness={0.36} />
            </mesh>
          ))}
        </ProceduralSquishRig>
      );
    }

    case 'star-jelly':
      return (
        <ProceduralSquishRig
          pressedRef={pressedRef}
          pulseSignal={pulseSignal}
          scaleBoost={scaleBoost}
          baseRotation={[0.2, -0.32, 0.08]}
        >
          {/* Plump Central Star Cushion */}
          <mesh scale={[1.05, 1.05, 0.68]}>
            <sphereGeometry args={[0.68, 28, 28]} />
            <meshStandardMaterial color="#ffdf6b" roughness={0.3} />
          </mesh>
          {/* 5 Rounded Star Arms */}
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i * Math.PI * 2) / 5;
            return (
              <mesh
                key={i}
                position={[
                  Math.sin(angle) * 0.56,
                  Math.cos(angle) * 0.56,
                  0,
                ]}
                rotation={[0, 0, -angle]}
                scale={[0.88, 1.18, 0.64]}
              >
                <sphereGeometry args={[0.44, 24, 24]} />
                <meshStandardMaterial color="#ffdf6b" roughness={0.3} />
              </mesh>
            );
          })}
        </ProceduralSquishRig>
      );

    default:
      return null;
  }
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
  url = '',
  alt,
  fallbackImage,
  compact = false,
  hideHint = false,
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

  const isProcedural = typeof url === 'string' && url.startsWith('procedural:');
  const proceduralType = isProcedural ? url.slice('procedural:'.length) : '';

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
            {isProcedural ? (
              <ProceduralSquishyModel
                type={proceduralType}
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
        {!hideHint && (
          <span className="viewer-3d-hint" aria-hidden="true">
            {compact ? '3D · Drag or press to squish' : '3D · Drag to rotate'}
          </span>
        )}
      </div>
    </ViewerErrorBoundary>
  );
}
