import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { mapGenerator } from '../../systems/MapGenerator';

interface CachedMapLoaderProps {
    onMapLoaded?: (heightData: Float32Array) => void;
}

const CachedMapLoader: React.FC<CachedMapLoaderProps> = ({ onMapLoaded }) => {
    const [mapGroup, setMapGroup] = useState<THREE.Group | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadMap = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                const map = await mapGenerator.getMap();
                const heightData = mapGenerator.getHeightData();
                
                if (mounted) {
                    setMapGroup(map);
                    if (onMapLoaded) {
                        onMapLoaded(heightData);
                    }
                }
            } catch (err) {
                console.error('Failed to load map:', err);
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load map');
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        loadMap();

        return () => {
            mounted = false;
        };
    }, [onMapLoaded]);

    if (isLoading) {
        return null; // Could show loading indicator
    }

    if (error) {
        console.error('Map loading error:', error);
        return null; // Could show error fallback
    }

    if (!mapGroup) {
        return null;
    }

    return <primitive object={mapGroup} />;
};

export default CachedMapLoader;