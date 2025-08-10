
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, TrimeshCollider } from '@react-three/rapier';
import { TERRAIN_WIDTH, TERRAIN_HEIGHT, TERRAIN_SCALE, TERRAIN_MAX_ALTITUDE } from '../../constants';
import type { UserData } from '../../types';

interface GroundProps {
    heightData: Float32Array;
}

const Ground: React.FC<GroundProps> = ({ heightData }) => {
    const { vertices, indices, geometry } = useMemo(() => {
        const geom = new THREE.PlaneGeometry(TERRAIN_WIDTH * TERRAIN_SCALE, TERRAIN_HEIGHT * TERRAIN_SCALE, TERRAIN_WIDTH - 1, TERRAIN_HEIGHT - 1);
        geom.rotateX(-Math.PI / 2);

        const positions = geom.attributes.position.array as Float32Array;
        const colors = new Float32Array(positions.length);
        const emberColor = new THREE.Color('#ff4500');
        const rockColor = new THREE.Color('#3d3835');
        
        for (let i = 0; i < heightData.length; i++) {
            const y = heightData[i];
            const i3 = i * 3;
            positions[i3 + 1] = y;

            const finalColor = new THREE.Color().lerpColors(emberColor, rockColor, Math.pow(Math.max(0, y / TERRAIN_MAX_ALTITUDE), 0.7));
            colors[i3] = finalColor.r; 
            colors[i3 + 1] = finalColor.g; 
            colors[i3 + 2] = finalColor.b;
        }
        
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geom.computeVertexNormals();

        const verts = geom.attributes.position.array as Float32Array;
        const inds = geom.index!.array as Uint32Array;

        return { vertices: verts, indices: inds, geometry: geom };
    }, [heightData]);
    
    const userData = useMemo<UserData>(() => ({ type: 'ground' }), []);

    return (
        <RigidBody type="fixed" colliders={false} userData={userData}>
            <TrimeshCollider args={[vertices, indices]} />
            <mesh receiveShadow geometry={geometry}>
                <meshStandardMaterial vertexColors metalness={0.2} roughness={0.8} />
            </mesh>
        </RigidBody>
    );
};

export default Ground;
