import React, { useState, useEffect } from 'react';
import { useFBX } from '@react-three/drei';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import * as THREE from 'three';
import type { UserData } from '../../types';

interface FBXTerrainLoaderProps {
    onMapLoaded?: (heightData: Float32Array) => void;
    fbxPath?: string;
}

const FBXTerrainLoader: React.FC<FBXTerrainLoaderProps> = ({ 
    onMapLoaded, 
    fbxPath = '/swamp.fbx'  // Default to swamp.fbx
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Load the FBX terrain with proper error handling
    const fbx = useFBX(fbxPath);
    
    console.log('FBX Loading - scene:', fbx);
    
    // Extract terrain mesh for collision and height data
    const terrainMesh = React.useMemo(() => {
        if (!fbx) return null;
        
        let terrainGeometry: THREE.BufferGeometry | null = null;
        let terrainMaterial: THREE.Material | null = null;
        
        // Find the largest mesh (likely the terrain)
        let largestMesh: THREE.Mesh | null = null;
        let maxVertices = 0;
        
        fbx.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const vertexCount = child.geometry.attributes.position.count;
                console.log(`Found mesh: ${child.name}, vertices: ${vertexCount}`);
                
                if (vertexCount > maxVertices) {
                    maxVertices = vertexCount;
                    largestMesh = child;
                    terrainGeometry = child.geometry;
                    terrainMaterial = child.material;
                }
            }
        });
        
        if (largestMesh) {
            console.log('Selected terrain mesh:', largestMesh.name, 'vertices:', maxVertices);
            
            // Ensure geometry has proper attributes
            if (!terrainGeometry.attributes.normal) {
                terrainGeometry.computeVertexNormals();
            }
            
            // Scale the terrain appropriately for the game
            largestMesh.scale.set(1, 1, 1); // Adjust scale as needed
            largestMesh.position.set(0, 0, 0); // Center the terrain
        }
        
        return { geometry: terrainGeometry, material: terrainMaterial, mesh: largestMesh };
    }, [fbx]);
    
    // Generate heightData from terrain mesh for gameplay systems
    const heightData = React.useMemo(() => {
        if (!terrainMesh?.geometry) return null;
        
        const positions = terrainMesh.geometry.attributes.position.array as Float32Array;
        const vertices = [];
        
        // Extract Z coordinates (height values in FBX, which uses Y-up but Z-forward)
        // For swamp terrain, we need to check which axis represents height
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];  // This is likely height in FBX
            const z = positions[i + 2];
            
            vertices.push(y); // Use Y as height (FBX standard)
        }
        
        return new Float32Array(vertices);
    }, [terrainMesh]);
    
    // Calculate terrain bounds for gameplay
    const terrainBounds = React.useMemo(() => {
        if (!terrainMesh?.geometry) return null;
        
        const bbox = new THREE.Box3().setFromBufferAttribute(
            terrainMesh.geometry.attributes.position
        );
        
        return {
            min: bbox.min,
            max: bbox.max,
            size: bbox.getSize(new THREE.Vector3())
        };
    }, [terrainMesh]);
    
    // Notify parent when map is loaded
    useEffect(() => {
        if (heightData && terrainBounds && onMapLoaded) {
            setIsLoading(false);
            onMapLoaded(heightData);
            console.log('FBX terrain loaded:', {
                heightPoints: heightData.length,
                bounds: terrainBounds,
                size: terrainBounds.size
            });
        }
    }, [heightData, terrainBounds, onMapLoaded]);
    
    // Handle loading errors - simplified
    useEffect(() => {
        if (!fbx && !isLoading) {
            console.error('Failed to load FBX terrain');
            setError('Failed to load FBX terrain');
        }
    }, [fbx, isLoading]);
    
    if (error) {
        console.error('FBX Terrain loading error:', error);
        return null; // Fallback to basic ground
    }
    
    if (isLoading || !fbx || !terrainMesh) {
        console.log('FBX still loading...', { isLoading, fbx: !!fbx, terrainMesh: !!terrainMesh });
        return null; // Still loading
    }
    
    return (
        <group>
            {/* Render the visual FBX scene */}
            <primitive object={fbx} />
            
            {/* Add physics collision for the terrain mesh */}
            {terrainMesh.geometry && (
                <RigidBody type="fixed" colliders={false} userData={{ type: 'ground' } as UserData}>
                    <TrimeshCollider 
                        args={[
                            terrainMesh.geometry.attributes.position.array as Float32Array,
                            terrainMesh.geometry.index?.array as Uint32Array || 
                            new Uint32Array(Array.from({length: terrainMesh.geometry.attributes.position.count}, (_, i) => i))
                        ]} 
                    />
                </RigidBody>
            )}
        </group>
    );
};

// Preload the FBX file
// Note: useFBX.preload might not be available, but we can try
try {
    // @ts-ignore - This might not exist but worth trying
    useFBX.preload && useFBX.preload('/swamp.fbx');
} catch (e) {
    console.log('FBX preload not available');
}

export default FBXTerrainLoader;