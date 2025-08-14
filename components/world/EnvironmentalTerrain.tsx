import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { generateTerrain } from '../../utils/noise';
import { simpleEnvironmentManager } from '../../systems/simpleGameManager';
import { eventBus } from '../../systems/eventBus';
import { TERRAIN_WIDTH, TERRAIN_HEIGHT, TERRAIN_SCALE } from '../../constants';

interface EnvironmentalTerrainProps {
    position?: [number, number, number];
}

/**
 * EnvironmentalTerrain - Dynamic terrain that adapts to the current environment
 * 
 * Features:
 * - Environment-specific terrain generation (volcanic, swamp, cave)
 * - Adaptive materials and textures
 * - Physics collision mesh
 * - Performance optimized
 */
const EnvironmentalTerrain: React.FC<EnvironmentalTerrainProps> = ({ 
    position = [0, 0, 0] 
}) => {
    const [currentEnvironment, setCurrentEnvironment] = useState<string>('volcanic');
    const [terrainSeed, setTerrainSeed] = useState<number>(42);
    
    // Listen for environment changes
    useEffect(() => {
        const handleEnvironmentLoaded = (data: { environmentId: string; environment: any }) => {
            setCurrentEnvironment(data.environment.terrainType);
            setTerrainSeed(data.environment.terrainSeed);
        };
        
        eventBus.on('ENVIRONMENT_LOADED', handleEnvironmentLoaded);
        
        return () => {
            eventBus.off('ENVIRONMENT_LOADED', handleEnvironmentLoaded);
        };
    }, []);
    
    // Generate terrain geometry
    const terrainGeometry = useMemo(() => {
        console.log(`Generating ${currentEnvironment} terrain with seed ${terrainSeed}`);
        
        // Generate height data
        const heightData = generateTerrain(currentEnvironment, terrainSeed);
        
        // Create geometry
        const geometry = new THREE.PlaneGeometry(
            TERRAIN_WIDTH * TERRAIN_SCALE,
            TERRAIN_HEIGHT * TERRAIN_SCALE,
            TERRAIN_WIDTH - 1,
            TERRAIN_HEIGHT - 1
        );
        
        // Apply heights to vertices
        const vertices = geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < vertices.length; i += 3) {
            const vertexIndex = i / 3;
            const x = Math.floor(vertexIndex % TERRAIN_WIDTH);
            const y = Math.floor(vertexIndex / TERRAIN_WIDTH);
            const heightIndex = y * TERRAIN_WIDTH + x;
            
            if (heightIndex < heightData.length) {
                vertices[i + 2] = heightData[heightIndex]; // Z is height in rotated plane
            }
        }
        
        // Update geometry
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        return geometry;
    }, [currentEnvironment, terrainSeed]);
    
    // Generate environment-specific material
    const terrainMaterial = useMemo(() => {
        const environment = simpleEnvironmentManager.getCurrentEnvironment();
        
        let materialProperties: any = {
            transparent: false,
            opacity: 1.0
        };
        
        switch (currentEnvironment) {
            case 'volcanic':
                materialProperties = {
                    ...materialProperties,
                    color: '#8b4513', // Brown volcanic rock
                    roughness: 0.9,
                    metalness: 0.1,
                    emissive: '#2d1b04', // Slight glow for volcanic heat
                    emissiveIntensity: 0.1
                };
                break;
                
            case 'swamp':
                materialProperties = {
                    ...materialProperties,
                    color: '#556b2f', // Dark olive green
                    roughness: 0.8,
                    metalness: 0.0,
                    emissive: '#0a0f05',
                    emissiveIntensity: 0.05
                };
                break;
                
            case 'cave':
                materialProperties = {
                    ...materialProperties,
                    color: '#2f4f4f', // Dark slate gray
                    roughness: 0.7,
                    metalness: 0.2,
                    emissive: '#4b0082', // Purple crystal glow
                    emissiveIntensity: 0.15
                };
                break;
                
            default:
                materialProperties = {
                    ...materialProperties,
                    color: '#8b4513',
                    roughness: 0.8,
                    metalness: 0.1
                };
        }
        
        return new THREE.MeshStandardMaterial(materialProperties);
    }, [currentEnvironment]);
    
    // Generate wireframe for debugging (optional)
    const wireframeMaterial = useMemo(() => {
        return new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.1
        });
    }, []);
    
    return (
        <group position={position}>
            {/* Main terrain mesh */}
            <mesh 
                geometry={terrainGeometry}
                material={terrainMaterial}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
                userData={{ type: 'terrain', environment: currentEnvironment }}
            />
            
            {/* Physics collision mesh (simplified) */}
            <mesh
                geometry={terrainGeometry}
                rotation={[-Math.PI / 2, 0, 0]}
                visible={false}
                userData={{ type: 'terrain_collision' }}
            >
                <meshBasicMaterial transparent opacity={0} />
            </mesh>
            
            {/* Environment-specific overlay effects */}
            {currentEnvironment === 'volcanic' && (
                <VolcanicOverlay />
            )}
            
            {currentEnvironment === 'swamp' && (
                <SwampOverlay />
            )}
            
            {currentEnvironment === 'cave' && (
                <CaveOverlay />
            )}
        </group>
    );
};

// Volcanic environment overlay effects
const VolcanicOverlay: React.FC = () => {
    return (
        <group>
            {/* Lava glow particles could go here */}
            {/* Ash particle systems */}
            {/* Heat shimmer effects */}
        </group>
    );
};

// Swamp environment overlay effects
const SwampOverlay: React.FC = () => {
    return (
        <group>
            {/* Mist/fog effects */}
            {/* Firefly particles */}
            {/* Water reflection planes */}
        </group>
    );
};

// Cave environment overlay effects
const CaveOverlay: React.FC = () => {
    return (
        <group>
            {/* Crystal glow effects */}
            {/* Stalactite shadows */}
            {/* Underground ambience */}
        </group>
    );
};

export default EnvironmentalTerrain;