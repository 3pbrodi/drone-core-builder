import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect } from "react";
import type { BuildSelection } from "@/lib/build-data";
import { byId } from "@/lib/build-data";

const ink = "#17263c", carbon = "#293745", metal = "#8c9baa", accent = "#2271e6";
const cameraPositions: [number,number,number][] = [[5,5,6],[0,9,0.01],[0,2,9],[9,2,0]];
function CameraController({ view, resetToken }: { view:number; resetToken:number }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const position = cameraPositions[view] ?? cameraPositions[0]!;
    camera.position.set(...position);
    camera.lookAt(0,0,0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, resetToken, view]);
  return null;
}
function DroneShape({ selection }: { selection: BuildSelection }) {
  const frame = byId[selection.frame ?? ""];
  const radius = frame?.frameInches === 7 ? 2.05 : frame?.frameInches === 3 ? 1.15 : 1.6;
  const propSize = (byId[selection.propellers ?? ""]?.propInches ?? 5) / 5 * 0.66;
  const positions: [number, number, number][] = [[-radius,0,-radius],[radius,0,-radius],[-radius,0,radius],[radius,0,radius]];
  return <group rotation-y={Math.PI / 6}>
    {frame && <>
      <mesh castShadow position={[0,0,0]}><boxGeometry args={[0.95,0.2,1.45]}/><meshStandardMaterial color={carbon} metalness={0.38} roughness={0.57}/></mesh>
      <mesh castShadow position={[0,0.16,0]}><boxGeometry args={[0.73,0.12,1.12]}/><meshStandardMaterial color={ink} metalness={0.55} roughness={0.36}/></mesh>
      {positions.map(([x,,z],i) => <group key={i} rotation-y={(x*z>0 ? -1 : 1)*Math.PI/4}>
        <mesh castShadow position={[x/2,-0.04,z/2]}><boxGeometry args={[0.22,0.09,Math.hypot(x,z)*1.35]}/><meshStandardMaterial color={carbon} metalness={0.55} roughness={0.42}/></mesh>
      </group>)}
      <mesh position={[0,0.24,-0.16]}><boxGeometry args={[0.48,0.04,0.17]}/><meshStandardMaterial color={accent} metalness={0.6} roughness={0.28}/></mesh>
    </>}
    {selection.motors && positions.map(([x,,z],i) => <group key={i} position={[x,0.13,z]}>
      <mesh castShadow><cylinderGeometry args={[0.27,0.29,0.31,24]}/><meshStandardMaterial color={ink} metalness={0.75} roughness={0.3}/></mesh>
      <mesh position-y={0.18}><cylinderGeometry args={[0.22,0.22,0.05,24]}/><meshStandardMaterial color={accent} metalness={0.55} roughness={0.27}/></mesh>
    </group>)}
    {selection.propellers && selection.motors && positions.map(([x,,z],i) => <group key={i} position={[x,0.39,z]}>
      <mesh rotation-y={i*Math.PI/3}><boxGeometry args={[propSize*2,0.028,0.16]}/><meshStandardMaterial color={metal} metalness={0.65} roughness={0.32} side={2}/></mesh>
      <mesh rotation-y={i*Math.PI/3 + Math.PI/2}><boxGeometry args={[propSize*2,0.028,0.16]}/><meshStandardMaterial color={metal} metalness={0.65} roughness={0.32} side={2}/></mesh>
      <mesh position-y={0.03}><cylinderGeometry args={[0.09,0.09,0.06,16]}/><meshStandardMaterial color={ink}/></mesh>
    </group>)}
    {selection.flightController && <mesh position={[0,0.3,0.12]} castShadow><boxGeometry args={[0.48,0.13,0.5]}/><meshStandardMaterial color={accent} metalness={0.35} roughness={0.45}/></mesh>}
    {selection.esc && <mesh position={[0,-0.19,0]} castShadow><boxGeometry args={[0.55,0.1,0.65]}/><meshStandardMaterial color={carbon}/></mesh>}
    {selection.battery && <mesh position={[0,0.48,0.36]} castShadow><boxGeometry args={[0.62,0.27,0.9]}/><meshStandardMaterial color={ink} metalness={0.15} roughness={0.8}/></mesh>}
    {selection.camera && <group position={[0,-0.03,0.85]}><mesh castShadow><boxGeometry args={[0.38,0.32,0.3]}/><meshStandardMaterial color={carbon} metalness={0.4}/></mesh><mesh position-z={0.17} rotation-x={Math.PI/2}><cylinderGeometry args={[0.13,0.13,0.08,24]}/><meshStandardMaterial color={ink} metalness={0.7}/></mesh><mesh position-z={0.22}><sphereGeometry args={[0.07,16,12]}/><meshStandardMaterial color={accent} metalness={0.8} roughness={0.12}/></mesh></group>}
    {selection.receiver && <mesh position={[0,0.26,-0.68]} rotation-x={-0.35} castShadow><cylinderGeometry args={[0.026,0.026,0.7,8]}/><meshStandardMaterial color={ink}/></mesh>}
  </group>;
}
export function DroneViewer({ selection, view, resetToken }: { selection: BuildSelection; view: number; resetToken: number }) {
  const position = cameraPositions[view] ?? cameraPositions[0]!;
  return <Canvas frameloop="demand" dpr={[1,1.5]} camera={{ position, fov: 40, near: 0.1, far: 100 }} shadows>
    <ambientLight intensity={1.5}/><directionalLight position={[4,9,5]} intensity={2.5} castShadow shadow-mapSize={[1024,1024]}/>
    <Environment><Lightformer intensity={2} position={[0,5,0]} scale={[10,10,1]}/><Lightformer intensity={1} color="#a8cdeb" position={[-5,1,-1]} rotation-y={Math.PI/2} scale={[20,1,1]}/></Environment>
    <DroneShape selection={selection}/>
    <OrbitControls key={`${view}-${resetToken}`} ref={controls} makeDefault enablePan={false} enableDamping minDistance={3.2} maxDistance={16} target={[0,0,0]}/>
  </Canvas>;
}
