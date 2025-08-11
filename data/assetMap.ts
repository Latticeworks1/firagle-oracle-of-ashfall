/**
 * Maps logical asset IDs to local file paths.
 * Separated by asset category to maintain semantic clarity.
 */

// Environment assets only - for terrain decoration
export const ENVIRONMENT_ASSETS: Record<string, string> = {
    'petrified_tree': '/models/latt-rock1-glb.glb', // TODO: Replace with actual tree model
    'latt_bush': '/models/latt-bush.glb',
    'rock_formation': '/models/latt-rock1-glb.glb',
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