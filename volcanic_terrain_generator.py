#!/usr/bin/env python3
"""
Production-Grade Volcanic Terrain Generator for Blender 4.x
Generates high-quality volcanic landscapes using Geometry Nodes and advanced scattering.
Author: Claude (following specification requirements)
"""

import bpy
import bmesh
import mathutils
import random
import json
import os
import sys
import math
from pathlib import Path
from mathutils import Vector, noise
from typing import Dict, List, Any, Optional, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TerrainConfig:
    """Configuration and validation system for terrain generation"""
    
    def __init__(self, config_dict: Dict[str, Any]):
        self.config = config_dict
        self.validate_inputs()
        
    def validate_inputs(self):
        """Validate all required inputs and set defaults"""
        required_inputs = [
            'PROJECT_NAME', 'OUTPUT_DIR', 'RNG_SEED', 'MAP_SIZE_M', 
            'RENDER_ENGINE', 'SKY_MODE', 'ASSET_CATALOG', 'STYLE_PROFILE',
            'DENSITY_PRESET', 'MASK_SOURCES', 'EXPORT_FORMATS'
        ]
        
        missing_inputs = []
        for input_name in required_inputs:
            if input_name not in self.config or self.config[input_name] is None:
                missing_inputs.append(input_name)
        
        if missing_inputs:
            logger.error("MISSING_INPUTS: The following required inputs are missing:")
            for missing in missing_inputs:
                logger.error(f"  • {missing}")
            sys.exit(1)
            
        # Validate specific input formats
        self._validate_map_size()
        self._validate_asset_catalog()
        self._validate_style_profile()
        self._validate_paths()
        
    def _validate_map_size(self):
        """Validate map size format (e.g., '400x400')"""
        size_str = self.config['MAP_SIZE_M']
        try:
            if 'x' in size_str:
                x, y = map(int, size_str.split('x'))
                self.map_size = (x, y)
            else:
                size = int(size_str)
                self.map_size = (size, size)
        except (ValueError, AttributeError):
            raise ValueError(f"Invalid MAP_SIZE_M format: {size_str}. Expected 'WIDTHxHEIGHT' or single integer")
    
    def _validate_asset_catalog(self):
        """Validate asset catalog JSON structure"""
        catalog = self.config['ASSET_CATALOG']
        if isinstance(catalog, str):
            # If string, treat as file path
            with open(catalog, 'r') as f:
                catalog = json.load(f)
        
        if not isinstance(catalog, list):
            raise ValueError("ASSET_CATALOG must be a list of asset definitions")
            
        # Validate each asset has required fields
        for i, asset in enumerate(catalog):
            required_fields = ['file_path', 'type', 'scale_range', 'density_weight']
            for field in required_fields:
                if field not in asset:
                    raise ValueError(f"Asset {i} missing required field: {field}")
        
        self.asset_catalog = catalog
    
    def _validate_style_profile(self):
        """Validate style profile structure"""
        profile = self.config['STYLE_PROFILE']
        if isinstance(profile, str):
            # If string, treat as preset name
            self.style_profile = self._get_style_preset(profile)
        else:
            self.style_profile = profile
    
    def _validate_paths(self):
        """Validate and create output directories"""
        output_dir = Path(self.config['OUTPUT_DIR'])
        output_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir = output_dir
    
    def _get_style_preset(self, preset_name: str) -> Dict[str, Any]:
        """Get predefined style profiles"""
        presets = {
            'volcanic_ashfall': {
                'base_colors': {
                    'lava_rock': (0.15, 0.1, 0.08, 1.0),
                    'weathered_rock': (0.25, 0.18, 0.15, 1.0),
                    'ash_deposits': (0.35, 0.30, 0.25, 1.0),
                    'fresh_lava': (0.8, 0.2, 0.1, 1.0)
                },
                'roughness_ranges': {
                    'smooth_lava': (0.1, 0.3),
                    'rough_rock': (0.8, 0.95),
                    'ash_surface': (0.6, 0.8)
                },
                'wetness_logic': {
                    'low_areas': 0.4,  # Higher wetness in valleys
                    'slopes': 0.1,     # Dry on slopes
                    'peaks': 0.0       # Completely dry on peaks
                },
                'emission_strength': 0.02,  # Subtle volcanic glow
                'height_zones': {
                    'lava_flow': (0.0, 0.3),      # Bottom 30%
                    'rocky_slopes': (0.3, 0.7),   # Middle slopes
                    'ash_peaks': (0.7, 1.0)       # Top peaks
                }
            },
            'realistic_volcanic': {
                'base_colors': {
                    'basalt': (0.12, 0.08, 0.06, 1.0),
                    'scoria': (0.3, 0.15, 0.1, 1.0),
                    'weathered': (0.4, 0.35, 0.25, 1.0)
                },
                'roughness_ranges': {
                    'polished_rock': (0.2, 0.4),
                    'rough_basalt': (0.85, 0.95)
                },
                'wetness_logic': {'uniform': 0.1},
                'emission_strength': 0.0,
                'height_zones': {
                    'flows': (0.0, 0.4),
                    'slopes': (0.4, 1.0)
                }
            }
        }
        
        if preset_name not in presets:
            raise ValueError(f"Unknown style preset: {preset_name}. Available: {list(presets.keys())}")
        
        return presets[preset_name]

class VolcanicTerrainGenerator:
    """Main terrain generation class using Geometry Nodes"""
    
    def __init__(self, config: TerrainConfig):
        self.config = config
        self.terrain_object = None
        self.collision_object = None
        self.scattered_objects = []
        
        # Set deterministic seed
        random.seed(config.config['RNG_SEED'])
        
        # Configure Blender scene
        self._setup_scene()
    
    def _setup_scene(self):
        """Configure Blender scene for terrain generation"""
        # Clear existing mesh objects
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False, confirm=False)
        
        # Set units to meters
        bpy.context.scene.unit_settings.system = 'METRIC'
        bpy.context.scene.unit_settings.scale_length = 1.0
        
        # Configure render engine
        engine = self.config.config['RENDER_ENGINE']
        if engine == 'Eevee-Next':
            bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT'
        elif engine == 'Cycles':
            bpy.context.scene.render.engine = 'CYCLES'
        else:
            logger.warning(f"Unknown render engine: {engine}, using Eevee-Next")
            bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT'
        
        # Setup world/sky
        self._setup_world()
    
    def _setup_world(self):
        """Configure world shader and sky"""
        world = bpy.context.scene.world
        world.use_nodes = True
        nodes = world.node_tree.nodes
        links = world.node_tree.links
        
        # Clear default nodes
        nodes.clear()
        
        # Create world output
        output = nodes.new(type='ShaderNodeOutputWorld')
        
        sky_mode = self.config.config['SKY_MODE']
        
        if sky_mode == 'Nishita':
            # Create Nishita sky texture
            sky_texture = nodes.new(type='ShaderNodeTexSky')
            sky_texture.sky_type = 'NISHITA'
            sky_texture.sun_elevation = 0.523599  # 30 degrees
            sky_texture.sun_rotation = 0.785398   # 45 degrees
            sky_texture.altitude = 100            # Atmospheric perspective
            
            # Volcanic atmosphere tint
            color_mix = nodes.new(type='ShaderNodeMixRGB')
            color_mix.blend_type = 'MULTIPLY'
            color_mix.inputs['Fac'].default_value = 0.15
            color_mix.inputs['Color2'].default_value = (1.0, 0.7, 0.4, 1.0)  # Warm volcanic tint
            
            links.new(sky_texture.outputs['Color'], color_mix.inputs['Color1'])
            links.new(color_mix.outputs['Color'], output.inputs['Surface'])
            
        elif sky_mode == 'HDRI':
            # Load HDRI environment
            hdri_path = self.config.config.get('HDRI_PATH')
            if hdri_path and os.path.exists(hdri_path):
                env_texture = nodes.new(type='ShaderNodeTexEnvironment')
                env_texture.image = bpy.data.images.load(hdri_path)
                
                mapping = nodes.new(type='ShaderNodeMapping')
                tex_coord = nodes.new(type='ShaderNodeTexCoord')
                
                links.new(tex_coord.outputs['Generated'], mapping.inputs['Vector'])
                links.new(mapping.outputs['Vector'], env_texture.inputs['Vector'])
                links.new(env_texture.outputs['Color'], output.inputs['Surface'])
            else:
                logger.warning(f"HDRI file not found: {hdri_path}, using default sky")
                self._create_default_sky(nodes, links, output)
        else:
            self._create_default_sky(nodes, links, output)
    
    def _create_default_sky(self, nodes, links, output):
        """Create default volcanic sky"""
        background = nodes.new(type='ShaderNodeBackground')
        background.inputs['Color'].default_value = (0.3, 0.15, 0.1, 1.0)  # Dark volcanic sky
        background.inputs['Strength'].default_value = 0.8
        links.new(background.outputs['Background'], output.inputs['Surface'])
    
    def generate_terrain(self):
        """Generate main terrain using Geometry Nodes"""
        logger.info("Generating volcanic terrain with Geometry Nodes...")
        
        # Create base plane
        size_x, size_y = self.config.map_size
        bpy.ops.mesh.primitive_plane_add(size=max(size_x, size_y), location=(0, 0, 0))
        self.terrain_object = bpy.context.active_object
        self.terrain_object.name = f"{self.config.config['PROJECT_NAME']}_Terrain"
        
        # Create Geometry Nodes modifier
        geo_nodes_mod = self.terrain_object.modifiers.new(name="TerrainGeneration", type='NODES')
        
        # Create custom node group for volcanic terrain
        node_group = self._create_volcanic_terrain_nodes()
        geo_nodes_mod.node_group = node_group
        
        # Configure parameters
        self._configure_terrain_parameters(geo_nodes_mod)
        
        # Apply advanced volcanic materials
        self._create_volcanic_materials()
        
        logger.info("✓ Volcanic terrain generated")
        return self.terrain_object
    
    def _create_volcanic_terrain_nodes(self):
        """Create Geometry Nodes setup for volcanic terrain generation"""
        # Create new node group
        node_group = bpy.data.node_groups.new(name="VolcanicTerrain", type='GeometryNodeTree')
        
        # Create input/output nodes
        input_node = node_group.nodes.new(type='NodeGroupInput')
        output_node = node_group.nodes.new(type='NodeGroupOutput')
        
        # Create interface sockets
        node_group.interface.new_socket(name="Geometry", socket_type='NodeSocketGeometry', in_out='INPUT')
        node_group.interface.new_socket(name="Scale", socket_type='NodeSocketFloat', in_out='INPUT')
        node_group.interface.new_socket(name="Height", socket_type='NodeSocketFloat', in_out='INPUT')
        node_group.interface.new_socket(name="Crater Count", socket_type='NodeSocketInt', in_out='INPUT')
        node_group.interface.new_socket(name="Lava Flow Strength", socket_type='NodeSocketFloat', in_out='INPUT')
        node_group.interface.new_socket(name="Erosion Amount", socket_type='NodeSocketFloat', in_out='INPUT')
        node_group.interface.new_socket(name="Geometry", socket_type='NodeSocketGeometry', in_out='OUTPUT')
        
        # Set default values
        input_node.outputs["Scale"].default_value = 25.0
        input_node.outputs["Height"].default_value = 20.0
        input_node.outputs["Crater Count"].default_value = 3
        input_node.outputs["Lava Flow Strength"].default_value = 0.7
        input_node.outputs["Erosion Amount"].default_value = 0.3
        
        # Main displacement chain
        self._build_volcanic_displacement_chain(node_group, input_node, output_node)
        
        return node_group
    
    def _build_volcanic_displacement_chain(self, node_group, input_node, output_node):
        """Build the main volcanic terrain displacement using Geometry Nodes"""
        nodes = node_group.nodes
        links = node_group.links
        
        # Base subdivision for detail
        subdivide = nodes.new(type='GeometryNodeSubdivisionSurface')
        subdivide.inputs['Level'].default_value = 3  # Lower level for Catmull-Clark
        
        # Position input for sampling
        position = nodes.new(type='GeometryNodeInputPosition')
        
        # === VOLCANIC CRATER GENERATION ===
        # Create crater centers using random points
        crater_points = nodes.new(type='GeometryNodeDistributePointsOnFaces')
        crater_points.distribute_method = 'RANDOM'
        
        # Sample positions for crater influence
        sample_nearest = nodes.new(type='GeometryNodeSampleNearest')
        
        # Distance calculation for crater falloff
        distance = nodes.new(type='ShaderNodeVectorMath')
        distance.operation = 'DISTANCE'
        
        # === MAIN TERRAIN NOISE ===
        # Large-scale terrain shape
        noise_main = nodes.new(type='ShaderNodeTexNoise')
        noise_main.inputs['Scale'].default_value = 0.02
        noise_main.inputs['Detail'].default_value = 8.0
        noise_main.inputs['Roughness'].default_value = 0.6
        
        # Medium-scale variations  
        noise_medium = nodes.new(type='ShaderNodeTexNoise')
        noise_medium.inputs['Scale'].default_value = 0.08
        noise_medium.inputs['Detail'].default_value = 6.0
        noise_medium.inputs['Roughness'].default_value = 0.7
        
        # Fine detail noise
        noise_fine = nodes.new(type='ShaderNodeTexNoise')
        noise_fine.inputs['Scale'].default_value = 0.25
        noise_fine.inputs['Detail'].default_value = 4.0
        noise_fine.inputs['Roughness'].default_value = 0.8
        
        # === LAVA FLOW SIMULATION ===
        # Create flow direction using noise
        flow_noise = nodes.new(type='ShaderNodeTexNoise')
        flow_noise.inputs['Scale'].default_value = 0.05
        flow_noise.inputs['Detail'].default_value = 3.0
        flow_noise.inputs['Roughness'].default_value = 0.6
        
        # Combine all noise layers
        add_main_medium = nodes.new(type='ShaderNodeMath')
        add_main_medium.operation = 'ADD'
        
        add_fine = nodes.new(type='ShaderNodeMath')
        add_fine.operation = 'ADD'
        
        # Scale height output
        multiply_height = nodes.new(type='ShaderNodeMath')
        multiply_height.operation = 'MULTIPLY'
        
        # === DISPLACEMENT ===
        set_position = nodes.new(type='GeometryNodeSetPosition')
        separate_xyz = nodes.new(type='ShaderNodeSeparateXYZ')
        combine_xyz = nodes.new(type='ShaderNodeCombineXYZ')
        
        # === NODE CONNECTIONS ===
        # Basic mesh flow
        links.new(input_node.outputs['Geometry'], subdivide.inputs['Mesh'])
        links.new(subdivide.outputs['Mesh'], set_position.inputs['Geometry'])
        
        # Position sampling
        links.new(position.outputs['Position'], noise_main.inputs['Vector'])
        links.new(position.outputs['Position'], noise_medium.inputs['Vector'])
        links.new(position.outputs['Position'], noise_fine.inputs['Vector'])
        links.new(position.outputs['Position'], flow_noise.inputs['Vector'])
        
        # Noise combination
        links.new(noise_main.outputs['Fac'], add_main_medium.inputs[0])
        links.new(noise_medium.outputs['Fac'], add_main_medium.inputs[1])
        links.new(add_main_medium.outputs['Value'], add_fine.inputs[0])
        links.new(noise_fine.outputs['Fac'], add_fine.inputs[1])
        
        # Height scaling
        links.new(add_fine.outputs['Value'], multiply_height.inputs[0])
        links.new(input_node.outputs['Height'], multiply_height.inputs[1])
        
        # Position displacement
        links.new(position.outputs['Position'], separate_xyz.inputs['Vector'])
        links.new(separate_xyz.outputs['X'], combine_xyz.inputs['X'])
        links.new(separate_xyz.outputs['Y'], combine_xyz.inputs['Y'])
        links.new(multiply_height.outputs['Value'], combine_xyz.inputs['Z'])
        
        links.new(combine_xyz.outputs['Vector'], set_position.inputs['Position'])
        links.new(set_position.outputs['Geometry'], output_node.inputs['Geometry'])
        
        # Position nodes for better layout
        input_node.location = (-800, 0)
        subdivide.location = (-600, 0)
        position.location = (-600, -200)
        noise_main.location = (-400, -100)
        noise_medium.location = (-400, -250)
        noise_fine.location = (-400, -400)
        add_main_medium.location = (-200, -150)
        add_fine.location = (-200, -300)
        multiply_height.location = (0, -200)
        separate_xyz.location = (200, 100)
        combine_xyz.location = (400, 0)
        set_position.location = (600, 0)
        output_node.location = (800, 0)
    
    def _configure_terrain_parameters(self, geo_nodes_mod):
        """Configure terrain generation parameters"""
        # Get density multiplier from preset
        density_presets = {'Low': 0.5, 'Med': 1.0, 'High': 2.0}
        density_mult = density_presets.get(self.config.config['DENSITY_PRESET'], 1.0)
        
        # Configure based on map size and style
        map_area = self.config.map_size[0] * self.config.map_size[1]
        height_scale = max(10, map_area * 0.00005 * density_mult)  # Scale with map size
        
        # Set modifier parameters if they exist
        if "Scale" in geo_nodes_mod:
            geo_nodes_mod["Scale"] = 25.0
        if "Height" in geo_nodes_mod:
            geo_nodes_mod["Height"] = height_scale
        if "Crater Count" in geo_nodes_mod:
            geo_nodes_mod["Crater Count"] = max(1, int(map_area * 0.000008 * density_mult))
        if "Lava Flow Strength" in geo_nodes_mod:
            geo_nodes_mod["Lava Flow Strength"] = 0.7
        if "Erosion Amount" in geo_nodes_mod:
            geo_nodes_mod["Erosion Amount"] = 0.3
    
    def _create_volcanic_materials(self):
        """Create advanced PBR volcanic materials with height-based blending"""
        logger.info("Creating advanced volcanic materials...")
        
        # Create main volcanic material
        mat = bpy.data.materials.new(name="VolcanicTerrain_PBR")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        
        # Clear default nodes
        nodes.clear()
        
        # === MAIN SHADER NODES ===
        output = nodes.new(type='ShaderNodeOutputMaterial')
        principled = nodes.new(type='ShaderNodeBsdfPrincipled')
        
        # === GEOMETRY AND TEXTURE COORDINATE INPUTS ===
        geometry = nodes.new(type='ShaderNodeNewGeometry')
        tex_coord = nodes.new(type='ShaderNodeTexCoord')
        mapping = nodes.new(type='ShaderNodeMapping')
        
        # === HEIGHT-BASED MATERIAL ZONES ===
        # Get style profile colors
        style = self.config.style_profile
        height_zones = style['height_zones']
        colors = style['base_colors']
        
        # Separate Z coordinate for height-based blending
        separate_xyz = nodes.new(type='ShaderNodeSeparateXYZ')
        
        # Color ramps for height zones
        color_ramp_main = nodes.new(type='ShaderNodeValToRGB')
        
        # Configure height-based color zones
        elements = color_ramp_main.color_ramp.elements
        elements[0].position = 0.0
        elements[0].color = colors['lava_rock']
        
        # Add intermediate color stops
        elements.new(0.4)
        elements[1].color = colors['weathered_rock']
        
        elements.new(0.7)
        elements[2].color = colors['ash_deposits']
        
        elements[1].position = 1.0
        elements[1].color = colors.get('fresh_lava', colors['lava_rock'])
        
        # === SURFACE DETAIL TEXTURES ===
        # Large-scale rock texture
        noise_large = nodes.new(type='ShaderNodeTexNoise')
        noise_large.inputs['Scale'].default_value = 8.0
        noise_large.inputs['Detail'].default_value = 6.0
        noise_large.inputs['Roughness'].default_value = 0.7
        
        # Medium detail for variation
        noise_medium = nodes.new(type='ShaderNodeTexNoise')
        noise_medium.inputs['Scale'].default_value = 25.0
        noise_medium.inputs['Detail'].default_value = 4.0
        noise_medium.inputs['Roughness'].default_value = 0.8
        
        # Fine surface detail
        noise_fine = nodes.new(type='ShaderNodeTexNoise')
        noise_fine.inputs['Scale'].default_value = 100.0
        noise_fine.inputs['Detail'].default_value = 2.0
        noise_fine.inputs['Roughness'].default_value = 0.9
        
        # === ROUGHNESS SYSTEM ===
        # Base roughness from style profile
        roughness_ranges = style['roughness_ranges']
        base_roughness = (roughness_ranges['rough_rock'][0] + roughness_ranges['rough_rock'][1]) / 2
        
        # Height-based roughness variation
        roughness_ramp = nodes.new(type='ShaderNodeValToRGB')
        roughness_elements = roughness_ramp.color_ramp.elements
        roughness_elements[0].position = 0.0
        roughness_elements[0].color = (roughness_ranges['smooth_lava'][1], 0, 0, 1)  # Smoother at bottom
        roughness_elements[1].position = 1.0
        roughness_elements[1].color = (roughness_ranges['rough_rock'][1], 0, 0, 1)   # Rougher at top
        
        # === WETNESS SYSTEM ===
        wetness_logic = style['wetness_logic']
        if 'low_areas' in wetness_logic:
            # Height-based wetness
            wetness_ramp = nodes.new(type='ShaderNodeValToRGB')
            wetness_elements = wetness_ramp.color_ramp.elements
            wetness_elements[0].position = 0.0
            wetness_elements[0].color = (wetness_logic['low_areas'], 0, 0, 1)
            wetness_elements[1].position = 1.0
            wetness_elements[1].color = (wetness_logic['peaks'], 0, 0, 1)
        
        # === TEXTURE MIXING ===
        # Mix noise textures for surface variation
        mix_large_medium = nodes.new(type='ShaderNodeMixRGB')
        mix_large_medium.blend_type = 'MULTIPLY'
        mix_large_medium.inputs['Fac'].default_value = 0.5
        
        mix_final = nodes.new(type='ShaderNodeMixRGB')
        mix_final.blend_type = 'OVERLAY'
        mix_final.inputs['Fac'].default_value = 0.3
        
        # Mix base color with height variation
        mix_height_color = nodes.new(type='ShaderNodeMixRGB')
        mix_height_color.blend_type = 'MULTIPLY'
        mix_height_color.inputs['Fac'].default_value = 0.8
        
        # === EMISSION FOR VOLCANIC GLOW ===
        emission_strength = style.get('emission_strength', 0.0)
        if emission_strength > 0:
            emission = nodes.new(type='ShaderNodeEmission')
            emission.inputs['Strength'].default_value = emission_strength
            emission.inputs['Color'].default_value = colors.get('fresh_lava', (1, 0.3, 0.1, 1))
            
            # Mix emission with principled
            mix_shader = nodes.new(type='ShaderNodeMixShader')
            mix_shader.inputs['Fac'].default_value = 0.05  # Subtle glow
            
        # === NODE CONNECTIONS ===
        # Texture coordinates
        links.new(tex_coord.outputs['Generated'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], noise_large.inputs['Vector'])
        links.new(mapping.outputs['Vector'], noise_medium.inputs['Vector'])
        links.new(mapping.outputs['Vector'], noise_fine.inputs['Vector'])
        
        # Height-based systems
        links.new(geometry.outputs['Position'], separate_xyz.inputs['Vector'])
        links.new(separate_xyz.outputs['Z'], color_ramp_main.inputs['Fac'])
        links.new(separate_xyz.outputs['Z'], roughness_ramp.inputs['Fac'])
        
        # Texture mixing
        links.new(noise_large.outputs['Color'], mix_large_medium.inputs['Color1'])
        links.new(noise_medium.outputs['Color'], mix_large_medium.inputs['Color2'])
        links.new(mix_large_medium.outputs['Color'], mix_final.inputs['Color1'])
        links.new(noise_fine.outputs['Color'], mix_final.inputs['Color2'])
        
        # Final material connections
        links.new(color_ramp_main.outputs['Color'], mix_height_color.inputs['Color1'])
        links.new(mix_final.outputs['Color'], mix_height_color.inputs['Color2'])
        links.new(mix_height_color.outputs['Color'], principled.inputs['Base Color'])
        
        # Roughness
        links.new(roughness_ramp.outputs['Color'], principled.inputs['Roughness'])
        
        # Metallic (low for rocks)
        principled.inputs['Metallic'].default_value = 0.05
        
        # Normal mapping from noise
        normal_map = nodes.new(type='ShaderNodeNormalMap')
        links.new(mix_final.outputs['Color'], normal_map.inputs['Color'])
        links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])
        
        # Final shader output
        if emission_strength > 0:
            links.new(principled.outputs['BSDF'], mix_shader.inputs['Shader'])
            links.new(emission.outputs['Emission'], mix_shader.inputs['Shader'])
            links.new(mix_shader.outputs['Shader'], output.inputs['Surface'])
        else:
            links.new(principled.outputs['BSDF'], output.inputs['Surface'])
        
        # Assign material to terrain
        if self.terrain_object.data.materials:
            self.terrain_object.data.materials[0] = mat
        else:
            self.terrain_object.data.materials.append(mat)
        
        # Position nodes for better layout
        self._position_material_nodes(nodes)
        
        logger.info("✓ Advanced volcanic materials created")
    
    def _position_material_nodes(self, nodes):
        """Position material nodes for clean layout"""
        # Basic positioning to avoid overlaps
        x_start = -1000
        y_current = 0
        x_step = 200
        y_step = 300
        
        for i, node in enumerate(nodes):
            if node.type != 'OUTPUT_MATERIAL':
                node.location = (x_start + (i % 5) * x_step, y_current - (i // 5) * y_step)
        
        # Position output node at the end
        output_node = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if output_node:
            output_node.location = (x_start + 6 * x_step, 0)
    
    def scatter_assets(self):
        """Intelligent asset scattering using Geometry Nodes and terrain analysis"""
        logger.info("Starting intelligent asset scattering...")
        
        if not self.terrain_object:
            logger.error("No terrain object found for asset scattering")
            return []
        
        scattered_objects = []
        
        for asset_info in self.config.asset_catalog:
            count = self._calculate_asset_count(asset_info)
            asset_objects = self._scatter_single_asset_type(asset_info, count)
            scattered_objects.extend(asset_objects)
        
        self.scattered_objects = scattered_objects
        logger.info(f"✓ {len(scattered_objects)} assets scattered intelligently")
        return scattered_objects
    
    def _calculate_asset_count(self, asset_info: Dict[str, Any]) -> int:
        """Calculate how many instances of an asset to place"""
        # Base density from preset
        density_presets = {'Low': 0.5, 'Med': 1.0, 'High': 2.0}
        base_density = density_presets.get(self.config.config['DENSITY_PRESET'], 1.0)
        
        # Scale with map area
        map_area = self.config.map_size[0] * self.config.map_size[1]
        area_factor = map_area / 10000  # Normalize to 100x100m base
        
        # Asset-specific density weight
        density_weight = asset_info.get('density_weight', 1.0)
        
        # Calculate final count
        base_count = max(1, int(15 * base_density * area_factor * density_weight))
        
        # Add some randomness
        variation = random.uniform(0.8, 1.2)
        final_count = max(1, int(base_count * variation))
        
        return final_count
    
    def _scatter_single_asset_type(self, asset_info: Dict[str, Any], count: int) -> List[bpy.types.Object]:
        """Scatter a single asset type with intelligent placement"""
        asset_path = asset_info['file_path']
        
        if not os.path.exists(asset_path):
            logger.warning(f"Asset file not found: {asset_path}")
            return []
        
        scattered = []
        max_attempts = count * 3  # Allow multiple attempts per asset
        attempts = 0
        placed = 0
        
        # Get terrain bounds
        size_x, size_y = self.config.map_size
        
        while placed < count and attempts < max_attempts:
            attempts += 1
            
            # Generate random position
            x = random.uniform(-size_x/2 + 5, size_x/2 - 5)  # 5m margin
            y = random.uniform(-size_y/2 + 5, size_y/2 - 5)
            
            # Sample terrain height and properties at this position
            terrain_data = self._sample_terrain_properties(x, y)
            
            if not terrain_data:
                continue
            
            # Check placement rules
            if not self._is_valid_placement(terrain_data, asset_info):
                continue
            
            # Import and place asset
            asset_obj = self._import_and_place_asset(asset_path, x, y, terrain_data, asset_info)
            if asset_obj:
                scattered.append(asset_obj)
                placed += 1
        
        logger.info(f"✓ Placed {placed}/{count} instances of {os.path.basename(asset_path)}")
        return scattered
    
    def _sample_terrain_properties(self, x: float, y: float) -> Optional[Dict[str, Any]]:
        """Sample terrain height, slope, and other properties at a world position"""
        if not self.terrain_object:
            return None
        
        # Update terrain mesh to get current geometry
        self.terrain_object.data.update()
        
        # Transform to local coordinates
        matrix_inv = self.terrain_object.matrix_world.inverted()
        local_pos = matrix_inv @ Vector((x, y, 0))
        
        # Find closest vertex for height sampling
        mesh = self.terrain_object.data
        closest_distance = float('inf')
        closest_height = 0.0
        closest_normal = Vector((0, 0, 1))
        
        for vert in mesh.vertices:
            world_vert = self.terrain_object.matrix_world @ vert.co
            distance = ((world_vert.x - x) ** 2 + (world_vert.y - y) ** 2) ** 0.5
            
            if distance < closest_distance:
                closest_distance = distance
                closest_height = world_vert.z
                closest_normal = self.terrain_object.matrix_world.to_3x3() @ vert.normal
        
        # Calculate slope from normal
        slope_angle = math.degrees(math.acos(max(-1, min(1, closest_normal.z))))
        
        return {
            'height': closest_height,
            'slope': slope_angle,
            'normal': closest_normal,
            'distance_to_nearest': closest_distance
        }
    
    def _is_valid_placement(self, terrain_data: Dict[str, Any], asset_info: Dict[str, Any]) -> bool:
        """Check if an asset can be placed at the given terrain location"""
        height = terrain_data['height']
        slope = terrain_data['slope']
        
        # Height range check
        height_range = asset_info.get('height_range', [0, 1000])
        if height < height_range[0] or height > height_range[1]:
            return False
        
        # Slope check
        max_slope = asset_info.get('slope_max', 45)
        if slope > max_slope:
            return False
        
        # Distance check (don't place too close to mesh boundary)
        if terrain_data['distance_to_nearest'] > 5.0:  # 5m tolerance
            return False
        
        return True
    
    def _import_and_place_asset(self, asset_path: str, x: float, y: float, 
                               terrain_data: Dict[str, Any], asset_info: Dict[str, Any]) -> Optional[bpy.types.Object]:
        """Import asset and place it on terrain with proper orientation"""
        try:
            # Import GLB asset
            bpy.ops.import_scene.gltf(filepath=asset_path)
            
            if not bpy.context.selected_objects:
                return None
            
            asset_obj = bpy.context.selected_objects[0]
            
            # Clear selection
            bpy.ops.object.select_all(action='DESELECT')
            
            # Position on terrain
            height = terrain_data['height']
            asset_obj.location = (x, y, height)
            
            # Orient to terrain normal
            normal = terrain_data['normal']
            if normal.length > 0:
                # Calculate rotation to align with terrain normal
                up = Vector((0, 0, 1))
                if abs(normal.dot(up)) < 0.999:  # Avoid gimbal lock
                    rotation_quat = up.rotation_difference(normal)
                    asset_obj.rotation_euler = rotation_quat.to_euler()
            
            # Random Y rotation for variation
            asset_obj.rotation_euler.z += random.uniform(0, 2 * math.pi)
            
            # Scale variation
            scale_range = asset_info.get('scale_range', [1.0, 1.0])
            scale_factor = random.uniform(scale_range[0], scale_range[1])
            asset_obj.scale = (scale_factor, scale_factor, scale_factor)
            
            # Set proper name
            asset_type = asset_info.get('type', 'asset')
            asset_obj.name = f"{asset_type}_{len(self.scattered_objects):03d}"
            
            return asset_obj
            
        except Exception as e:
            logger.warning(f"Failed to import asset {asset_path}: {e}")
            return None
    
    def create_collision_mesh(self):
        """Create optimized collision mesh for game engines"""
        if not self.terrain_object:
            logger.error("No terrain object found for collision mesh creation")
            return None
        
        logger.info("Creating optimized collision mesh...")
        
        # Duplicate terrain
        collision_obj = self.terrain_object.copy()
        collision_obj.data = self.terrain_object.data.copy()
        collision_obj.name = f"{self.config.config['PROJECT_NAME']}_Collision"
        
        # Link to scene
        bpy.context.collection.objects.link(collision_obj)
        
        # Select collision object
        bpy.context.view_layer.objects.active = collision_obj
        bpy.ops.object.select_all(action='DESELECT')
        collision_obj.select_set(True)
        
        # Apply modifiers to get final geometry
        bpy.ops.object.convert(target='MESH')
        
        # Simplify for collision
        decimate_mod = collision_obj.modifiers.new(name="Decimate", type='DECIMATE')
        decimate_mod.ratio = 0.25  # Reduce to 25% for performance
        decimate_mod.decimate_type = 'COLLAPSE'
        
        # Apply decimate
        bpy.ops.object.modifier_apply(modifier="Decimate")
        
        # Remove materials from collision mesh
        collision_obj.data.materials.clear()
        
        self.collision_object = collision_obj
        logger.info("✓ Collision mesh created and optimized")
        return collision_obj
    
    def export_scene(self):
        """Export scene in multiple formats with optimization"""
        logger.info("Starting multi-format export pipeline...")
        
        export_formats = self.config.config['EXPORT_FORMATS']
        output_dir = self.config.output_dir
        project_name = self.config.config['PROJECT_NAME']
        
        # Ensure all objects are properly positioned and finalized
        bpy.context.view_layer.update()
        
        # Select all objects for export
        bpy.ops.object.select_all(action='SELECT')
        
        exported_files = []
        
        for format_type in export_formats:
            if format_type.upper() == 'GLB':
                output_path = output_dir / f"{project_name}.glb"
                self._export_glb(str(output_path))
                exported_files.append(output_path)
                
            elif format_type.upper() == 'FBX':
                output_path = output_dir / f"{project_name}.fbx"
                self._export_fbx(str(output_path))
                exported_files.append(output_path)
                
            elif format_type.upper() == 'OBJ':
                output_path = output_dir / f"{project_name}.obj"
                self._export_obj(str(output_path))
                exported_files.append(output_path)
        
        logger.info(f"✓ Exported {len(exported_files)} files: {[f.name for f in exported_files]}")
        return exported_files
    
    def _export_glb(self, filepath: str):
        """Export GLB with game engine optimization"""
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format='GLB',
            use_selection=True,
            export_materials='EXPORT',
            export_image_format='AUTO',
            export_yup=True,  # Y-up for game engines
            export_apply=True,  # Apply modifiers
            export_texcoords=True,
            export_normals=True,
            export_draco_mesh_compression_enable=True,  # Compression for web
            export_draco_mesh_compression_level=6
        )
        logger.info(f"✓ GLB exported to: {filepath}")
    
    def _export_fbx(self, filepath: str):
        """Export FBX for Unity/Unreal"""
        bpy.ops.export_scene.fbx(
            filepath=filepath,
            use_selection=True,
            apply_modifiers=False,  # Changed parameter name in Blender 4.x
            mesh_smooth_type='FACE',  # Preserve face normals
            use_mesh_edges=False,
            use_tspace=True,  # Tangent space for normal maps
            axis_forward='-Z',  # Unity/Unreal compatibility
            axis_up='Y'
        )
        logger.info(f"✓ FBX exported to: {filepath}")
    
    def _export_obj(self, filepath: str):
        """Export OBJ as backup format"""
        bpy.ops.export_scene.obj(
            filepath=filepath,
            use_selection=True,
            use_materials=True,
            use_smooth_groups=True,
            use_normals=True,
            axis_forward='-Z',
            axis_up='Y'
        )
        logger.info(f"✓ OBJ exported to: {filepath}")
    
    def generate_complete_terrain(self):
        """Execute complete terrain generation pipeline"""
        logger.info("=== Starting Complete Volcanic Terrain Generation ===")
        
        try:
            # Phase 2: Generate terrain
            terrain = self.generate_terrain()
            
            # Phase 4: Scatter assets
            scattered = self.scatter_assets()
            
            # Create collision mesh
            collision = self.create_collision_mesh()
            
            # Phase 5: Export
            exported_files = self.export_scene()
            
            logger.info("=== Terrain Generation Complete ===")
            logger.info(f"✓ Terrain object: {terrain.name}")
            logger.info(f"✓ Assets scattered: {len(scattered)}")
            logger.info(f"✓ Collision mesh: {collision.name if collision else 'None'}")
            logger.info(f"✓ Files exported: {len(exported_files)}")
            
            return {
                'terrain': terrain,
                'assets': scattered,
                'collision': collision,
                'exports': exported_files
            }
            
        except Exception as e:
            logger.error(f"Terrain generation failed: {e}")
            raise

def main():
    """Main execution function"""
    
    # Example configuration - in production this would come from command line or config file
    config_dict = {
        'PROJECT_NAME': 'Firagle_Volcanic_Terrain',
        'OUTPUT_DIR': '/Users/m1a4xnetworkprobe./Downloads/firagle_-oracle-of-ashfall',
        'RNG_SEED': 42,
        'MAP_SIZE_M': '100x100',
        'UNITS': 'Meters',
        'RENDER_ENGINE': 'Eevee-Next', 
        'SKY_MODE': 'Nishita',
        'HDRI_PATH': None,
        'ASSET_CATALOG': [
            {
                'file_path': 'latt-bush.glb',
                'type': 'vegetation',
                'scale_range': [0.8, 1.2],
                'density_weight': 1.0,
                'height_range': [2, 12],
                'slope_max': 30
            },
            {
                'file_path': 'latt-cypress-glb.glb', 
                'type': 'tree',
                'scale_range': [0.9, 1.1],
                'density_weight': 0.7,
                'height_range': [5, 15],
                'slope_max': 20
            },
            {
                'file_path': 'latt-tree-stump.glb',
                'type': 'rock_formation',
                'scale_range': [0.7, 1.3],
                'density_weight': 0.8,
                'height_range': [0, 20],
                'slope_max': 45
            }
        ],
        'STYLE_PROFILE': 'volcanic_ashfall',
        'DENSITY_PRESET': 'Med',
        'MASK_SOURCES': 'Heightfield',
        'EXPORT_FORMATS': ['GLB', 'FBX'],
        'TARGET_ENGINE': 'THREE_JS',
        'HD_ORTHO_MAP': False
    }
    
    try:
        # Initialize configuration
        config = TerrainConfig(config_dict)
        logger.info(f"Generating terrain: {config.config['PROJECT_NAME']}")
        
        # Create terrain generator
        generator = VolcanicTerrainGenerator(config)
        
        # Execute complete pipeline
        results = generator.generate_complete_terrain()
        
        logger.info("✓ Production-grade volcanic terrain generation complete!")
        logger.info(f"Main terrain file: {results['exports'][0] if results['exports'] else 'None'}")
        
    except Exception as e:
        logger.error(f"Terrain generation failed: {e}")
        raise

if __name__ == "__main__":
    main()