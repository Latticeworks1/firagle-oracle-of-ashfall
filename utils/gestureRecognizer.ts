import type { GestureSpell } from '../types';

type Point = { x: number; y: number };

const NUM_POINTS = 64;
const SQUARE_SIZE = 256;
const RECOGNITION_THRESHOLD = 40; // Lower is stricter

// Calculates the length of a path
function pathLength(points: Point[]): number {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
        d += distance(points[i - 1], points[i]);
    }
    return d;
}

// Calculates distance between two points
function distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Resamples a path to have a specific number of points
function resample(points: Point[], n: number): Point[] {
    const I = pathLength(points) / (n - 1);
    let D = 0;
    const newPoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const d = distance(points[i - 1], points[i]);
        if ((D + d) >= I) {
            const qx = points[i - 1].x + ((I - D) / d) * (points[i].x - points[i - 1].x);
            const qy = points[i - 1].y + ((I - D) / d) * (points[i].y - points[i - 1].y);
            const q = { x: qx, y: qy };
            newPoints.push(q);
            points.splice(i, 0, q);
            D = 0;
        } else {
            D += d;
        }
    }
    if (newPoints.length === n - 1) {
        newPoints.push(points[points.length - 1]);
    }
    return newPoints;
}

// Scales the path to a uniform size
function scale(points: Point[]): Point[] {
    let minX = +Infinity, maxX = -Infinity, minY = +Infinity, maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const size = Math.max(maxX - minX, maxY - minY);
    if (size === 0) return points; // Avoid division by zero
    const newPoints = points.map(p => ({
        x: (p.x - minX) / size * SQUARE_SIZE,
        y: (p.y - minY) / size * SQUARE_SIZE,
    }));
    return newPoints;
}

// Translates the path's centroid to the origin (0,0)
function translateToOrigin(points: Point[]): Point[] {
    const c = centroid(points);
    return points.map(p => ({
        x: p.x - c.x,
        y: p.y - c.y,
    }));
}

// Calculates the centroid of a path
function centroid(points: Point[]): Point {
    let x = 0, y = 0;
    for (const p of points) {
        x += p.x;
        y += p.y;
    }
    return { x: x / points.length, y: y / points.length };
}


// Compares two paths and returns a score
function distanceAtBestAngle(points: Point[], template: Point[]): number {
    let minD = +Infinity;
    // Since we're not doing rotation invariance for now, we just compare directly
    let d = 0;
    for(let i = 0; i < points.length; i++) {
        d += distance(points[i], template[i]);
    }
    minD = Math.min(minD, d / points.length);
    return minD;
}

// Normalizes a path by resampling, scaling, and translating
function normalizePath(points: Point[]): Point[] {
    let resampled = resample([...points], NUM_POINTS);
    let scaled = scale(resampled);
    let translated = translateToOrigin(scaled);
    return translated;
}


export function recognizeGesture(points: Point[], templates: GestureSpell[]): GestureSpell | null {
    if (points.length < 10) return null; // Not enough points for a gesture
    
    const normalized = normalizePath(points);
    
    let bestDist = +Infinity;
    let bestTemplate: GestureSpell | null = null;
    
    for (const template of templates) {
        const d = distanceAtBestAngle(normalized, template.template);
        if (d < bestDist) {
            bestDist = d;
            bestTemplate = template;
        }
    }
    
    if (bestTemplate && bestDist < RECOGNITION_THRESHOLD) {
        return bestTemplate;
    }
    
    return null;
}
