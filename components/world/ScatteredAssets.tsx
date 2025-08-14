

import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { InstancedRigidBodies, CylinderCollider, BallCollider } from '@react-three/rapier';
import { TERRAIN_WIDTH, TERRAIN_HEIGHT, TERRAIN_SCALE, TERRAIN_MAX_ALTITUDE } from '../../constants';
import type { UserData } from '../../types';
import { assetManager } from '../../systems/assetManager';
import { ENVIRONMENT_ASSETS } from '../../data/assetMap';

interface ScatteredAssetsProps {
    heightData: Float32Array;
}

const ROCK_RADIUS = 0.6;
const TARGET_TREE_HEIGHT = 15;
const TARGET_TREE_RADIUS = 1;
const TARGET_BUSH_HEIGHT = 1.4;

const processModel = (model: THREE.Group, targetHeight: number, color: string) => {
    const mesh = model.getObjectByProperty('isMesh', true) as THREE.Mesh;
    if (!mesh) return null;

    const geometry = mesh.geometry.clone();
    
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    if (size.y === 0) return null;

    geometry.center();
    geometry.translate(0, size.y / 2, 0);

    const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8
    });
    
    const processedMesh = new THREE.Mesh(geometry, material);
    const scaleFactor = targetHeight / size.y;

    return { mesh: processedMesh, scaleFactor };
}

const ScatteredAssets: React.FC<ScatteredAssetsProps> = ({ heightData }) => {
    const count = useMemo(() => Math.floor(TERRAIN_WIDTH * TERRAIN_HEIGHT * 0.015), []);
    const userData = useMemo<UserData>(() => ({ type: 'scenery' }), []);
    
    const [processedTree, setProcessedTree] = useState<{ mesh: THREE.Mesh, scaleFactor: number } | null>(null);
    const [processedBush, setProcessedBush] = useState<{ mesh: THREE.Mesh, scaleFactor: number } | null>(null);

    useEffect(() => {
        // Create procedural tree geometry - no heavy GLB loading
        const treeGeometry = new THREE.ConeGeometry(1, TARGET_TREE_HEIGHT, 8);
        treeGeometry.translate(0, TARGET_TREE_HEIGHT / 2, 0);
        const treeMaterial = new THREE.MeshStandardMaterial({ 
            color: '#2d1a0f', 
            roughness: 0.9 
        });
        const treeMesh = new THREE.Mesh(treeGeometry, treeMaterial);
        setProcessedTree({ mesh: treeMesh, scaleFactor: 1 });

        // Create procedural bush geometry  
        const bushGeometry = new THREE.SphereGeometry(TARGET_BUSH_HEIGHT * 0.8, 8, 6);
        bushGeometry.translate(0, TARGET_BUSH_HEIGHT / 2, 0);
        const bushMaterial = new THREE.MeshStandardMaterial({ 
            color: '#1a3d2e', 
            roughness: 0.8 
        });
        const bushMesh = new THREE.Mesh(bushGeometry, bushMaterial);
        setProcessedBush({ mesh: bushMesh, scaleFactor: 1 });
    }, []);

    const { rockInstances, treeInstances, bushInstances } = useMemo(() => {
        const rocks = [];
        const trees = [];
        const bushes = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * TERRAIN_WIDTH * TERRAIN_SCALE;
            const z = (Math.random() - 0.5) * TERRAIN_HEIGHT * TERRAIN_SCALE;

            const ix = Math.floor(((x / (TERRAIN_WIDTH * TERRAIN_SCALE)) + 0.5) * TERRAIN_WIDTH);
            const iz = Math.floor(((z / (TERRAIN_HEIGHT * TERRAIN_SCALE)) + 0.5) * TERRAIN_HEIGHT);
            const y = heightData[ix + iz * TERRAIN_WIDTH] || 0;

            if (y < 2 || y > TERRAIN_MAX_ALTITUDE - 3) continue;

            const rand = Math.random();
            if (rand > 0.5) { // 50% rock
                rocks.push({
                    key: `rock_${i}`,
                    position: [x, y + ROCK_RADIUS, z],
                    rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI),
                });
            } else if (rand > 0.15) { // 35% tree
                if (!processedTree) continue;
                const scale = (0.8 + Math.random() * 0.4) * processedTree.scaleFactor;
                trees.push({
                    key: `tree_${i}`,
                    position: [x, y, z], // Model origin is at the base
                    rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
                    scale: [scale, scale, scale],
                });
            } else { // 15% bush
                if (!processedBush) continue;
                const scale = (0.8 + Math.random() * 0.4) * processedBush.scaleFactor;
                bushes.push({
                    key: `bush_${i}`,
                    position: [x, y, z],
                    rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
                    scale: [scale, scale, scale],
                });
            }
        }
        return { rockInstances: rocks, treeInstances: trees, bushInstances: bushes };
    }, [count, heightData, processedTree, processedBush]);

    // Rock setup
    const rockGeometry = useMemo(() => new THREE.IcosahedronGeometry(ROCK_RADIUS, 1), []);
    const rockMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.8 }), []);

    return (
        <group>
            {rockInstances.length > 0 && (
                <InstancedRigidBodies
                    instances={rockInstances}
                    type="fixed"
                    colliders="ball"
                    userData={userData}
                >
                    <instancedMesh
                        args={[rockGeometry, rockMaterial, rockInstances.length]}
                        castShadow
                        receiveShadow
                    />
                </InstancedRigidBodies>
            )}
            {processedTree && treeInstances.length > 0 && (
                 <InstancedRigidBodies
                    instances={treeInstances}
                    type="fixed"
                    colliders={false}
                    userData={userData}
                >
                    <instancedMesh
                        args={[processedTree.mesh.geometry, processedTree.mesh.material, treeInstances.length]}
                        castShadow
                        receiveShadow
                    />
                    <CylinderCollider args={[TARGET_TREE_HEIGHT / 2, TARGET_TREE_RADIUS]} position={[0, TARGET_TREE_HEIGHT/2, 0]}/>
                </InstancedRigidBodies>
            )}
            {processedBush && bushInstances.length > 0 && (
                 <InstancedRigidBodies
                    instances={bushInstances}
                    type="fixed"
                    colliders={false}
                    userData={userData}
                >
                    <instancedMesh
                        args={[processedBush.mesh.geometry, processedBush.mesh.material, bushInstances.length]}
                        castShadow
                        receiveShadow
                    />
                    <BallCollider args={[TARGET_BUSH_HEIGHT / 2]} position={[0, TARGET_BUSH_HEIGHT / 2, 0]}/>
                </InstancedRigidBodies>
            )}
        </group>
    );
};

export default ScatteredAssets;
