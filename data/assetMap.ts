/**
 * Maps logical asset IDs to local file paths.
 * Separated by asset category to maintain semantic clarity.
 */

// Environment assets - using procedural geometry instead of heavy GLB files
export const ENVIRONMENT_ASSETS: Record<string, string> = {
    // Removed heavy GLB files - using procedural geometry in ScatteredAssets instead
};

// Character/NPC assets - not used for weapons  
export const CHARACTER_ASSETS: Record<string, string> = {
    'sword_character': '/models/stable-sword-character.fbx',
    'alien_soldier': '/models/alien-soldier.fbx',
};

// Legacy combined map for backward compatibility
export const ASSET_MAP: Record<string, string> = {
    ...ENVIRONMENT_ASSETS,
    ...CHARACTER_ASSETS,
};