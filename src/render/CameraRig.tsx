import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export const INITIAL_CAMERA_POSITION: [number, number, number] = [6.5, 6, 8];
export const INITIAL_TARGET: [number, number, number] = [0, 1.2, 0];

/** resetSignal が増えるたびに、カメラを初期の視点へ戻す */
export function CameraRig({ resetSignal }: { resetSignal: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const last = useRef(resetSignal);

  useEffect(() => {
    if (last.current === resetSignal) return;
    last.current = resetSignal;
    if (!controls) {
      camera.position.set(...INITIAL_CAMERA_POSITION);
      return;
    }
    // 慣性（ダンピング）で残っている回転量を先に消化する。残したままだと、リセット後に視点が動いてしまう
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    camera.position.set(...INITIAL_CAMERA_POSITION);
    controls.target.set(...INITIAL_TARGET);
    controls.update();
    controls.enableDamping = damping;
  }, [resetSignal, camera, controls]);

  return null;
}
