import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type CameraMode = 'overview' | 'substrate' | 'evm';

interface Props {
  cameraMode: CameraMode;
  warpTrigger: number; // Incrementing counter to trigger warp
  reducedMotion?: boolean;
}

export const ThreeCanvas: React.FC<Props> = ({ cameraMode, warpTrigger, reducedMotion = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetCamRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 13 });
  const warpSpeedRef = useRef<number>(0.04);
  const evmMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Update target camera position when cameraMode prop changes
  useEffect(() => {
    if (cameraMode === 'overview') {
      targetCamRef.current = { x: 0, y: 0, z: 13 };
    } else if (cameraMode === 'substrate') {
      targetCamRef.current = { x: -2.2, y: 1.2, z: 8.5 };
    } else if (cameraMode === 'evm') {
      targetCamRef.current = { x: -1.5, y: 0, z: 5.5 };
    }
  }, [cameraMode]);

  // Handle Hyperspace Warp trigger
  useEffect(() => {
    if (warpTrigger === 0) return;
    warpSpeedRef.current = 0.85;
    if (evmMatRef.current) {
      evmMatRef.current.color.setHex(0xa855f7);
    }
    const timeout = setTimeout(() => {
      warpSpeedRef.current = 0.04;
      if (evmMatRef.current) {
        evmMatRef.current.color.setHex(0x06b6d4);
      }
    }, 1800);
    return () => clearTimeout(timeout);
  }, [warpTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Scene, Camera, Fog, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.035);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 13);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Portal Group
    const portalGroup = new THREE.Group();
    portalGroup.position.set(-1.5, 0.2, 0);
    scene.add(portalGroup);

    // A. Substrate / WASM Outer Ring (Emerald Wireframe)
    const substrateGeo = new THREE.TorusGeometry(4.2, 0.18, 24, 120);
    const substrateMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.55
    });
    const substrateRing = new THREE.Mesh(substrateGeo, substrateMat);
    portalGroup.add(substrateRing);

    // Secondary Orbital Gyro Ring
    const gyroGeo = new THREE.TorusGeometry(5.1, 0.04, 16, 100);
    const gyroMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.35
    });
    const gyroRing = new THREE.Mesh(gyroGeo, gyroMat);
    gyroRing.rotation.x = Math.PI / 3;
    portalGroup.add(gyroRing);

    // B. Frontier EVM Execution Layer Core (Cyan TorusKnot)
    const evmGeo = new THREE.TorusKnotGeometry(1.85, 0.42, 140, 24, 2, 3);
    const evmMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.65
    });
    evmMatRef.current = evmMat;
    const evmCore = new THREE.Mesh(evmGeo, evmMat);
    portalGroup.add(evmCore);

    // C. Cross-VM Particle Tunnel (2,400 Particles streaming between WASM & EVM)
    const particleCount = 2400;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorEmerald = new THREE.Color(0x10b981);
    const colorCyan = new THREE.Color(0x22d3ee);
    const colorPurple = new THREE.Color(0xa855f7);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.2 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * 40;

      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.sin(theta) * radius;
      positions[i * 3 + 2] = z;

      const mixRatio = Math.random();
      const c = mixRatio < 0.45 ? colorEmerald : mixRatio < 0.85 ? colorCyan : colorPurple;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.075,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    const particleTunnel = new THREE.Points(particleGeo, particleMat);
    scene.add(particleTunnel);

    // Mouse movement parallax
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      if (reducedMotion) return;
      mouseX = (e.clientX / window.innerWidth - 0.5) * 1.5;
      mouseY = -(e.clientY / window.innerHeight - 0.5) * 1.5;
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!reducedMotion) {
        // Rotate Dual-VM Rings
        substrateRing.rotation.z += 0.003;
        substrateRing.rotation.y += 0.002;
        gyroRing.rotation.y -= 0.005;
        evmCore.rotation.x += 0.008;
        evmCore.rotation.y += 0.01;

        // Stream Particles through the Portal Tunnel
        const posArr = particleGeo.attributes.position.array as Float32Array;
        const currentSpeed = warpSpeedRef.current;
        for (let i = 0; i < particleCount; i++) {
          posArr[i * 3 + 2] += currentSpeed;
          if (posArr[i * 3 + 2] > 18) {
            posArr[i * 3 + 2] = -22;
          }
        }
        particleGeo.attributes.position.needsUpdate = true;
      }

      // Smooth Camera Lerp
      const target = targetCamRef.current;
      camera.position.x += (target.x + mouseX - camera.position.x) * 0.05;
      camera.position.y += (target.y + mouseY - camera.position.y) * 0.05;
      camera.position.z += (target.z - camera.position.z) * 0.05;
      camera.lookAt(portalGroup.position);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      // Clean up Three.js resources
      substrateGeo.dispose();
      substrateMat.dispose();
      gyroGeo.dispose();
      gyroMat.dispose();
      evmGeo.dispose();
      evmMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      id="webgl-canvas"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
};

export default ThreeCanvas;
