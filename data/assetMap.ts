/**
 * Maps a logical model ID to a URL where the .glb asset is hosted.
 * You can get a .glb file by using the in-game "Export GLB" button,
 * uploading it to a service like Vercel Blob, GitHub Pages, or any CDN,
 * and then replacing the placeholder URL below.
 */
export const ASSET_MAP: Record<string, string> = {
    // Replace this with the actual URL to your exported staff model
    'firagle_staff': 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
    'staff_of_storms': 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb', // Same model, different weapon
    'petrified_tree': 'https://poly.pizza/api/v1/download/1k85bSgQ1F.glb',
    'latt_bush': 'https://poly.pizza/api/v1/download/7a8zUqM0g1k.glb',
};