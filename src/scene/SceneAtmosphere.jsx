import { useRef } from 'react';

export default function SceneAtmosphere() {
  return (
    <>
      {/* Soft ambient fill to avoid pitch black areas */}
      <ambientLight intensity={0.7} />
      
      {/* Primary directional light (Sun-like) for clear shadows and specular highlights */}
      <directionalLight
        position={[25, 45, 20]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
      />
      
      {/* Cool blue fill light from opposite angle to add dimension to metallic surfaces */}
      <directionalLight 
        position={[-25, 15, -20]} 
        intensity={0.6} 
        color="#3b82f6" 
      />
      
      {/* Soft warm uplight to illuminate bottom faces of floating platforms/floors */}
      <directionalLight 
        position={[0, -15, 0]} 
        intensity={0.35} 
        color="#fef08a" 
      />
    </>
  );
}
