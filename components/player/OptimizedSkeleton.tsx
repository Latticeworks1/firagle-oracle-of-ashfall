// Optimized Skeleton class with performance improvements
// Fixed: matrix update redundancy, raycast caching, memory allocation issues

import * as THREE from 'three';
import type { SerializableCharacterStateSnapshot as SerializableSnapshot } from '../types';
import { createHeadRaycasters, createTorsoRaycasters, createLegRaycasters, createHandRaycasters, createFootRaycasters } from './raycasters';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RaycastPoint {
  name: string;
  enabled: boolean;
  offset: { x: number, y: number, z: number };
  direction: { x: number, y: number, z: number };
  distance: number;
}

export interface RaycastResult {
  hit: boolean;
  point: { x: number, y: number, z: number };
  normal: { x: number, y: number, z: number };
  distance: number;
  object: string | undefined;
}

export interface CharacterStateSnapshot {
  timestamp: number;
  frameId: number;
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    scale: { x: number; y: number; z: number };
  };
  physics: {
    velocity: { x: number; y: number; z: number };
    acceleration: { x: number; y: number; z: number };
    angularVelocity: { x: number; y: number; z: number };
    isGrounded: boolean;
    groundNormal: { x: number; y: number; z: number };
    surfaceType: string;
  };
  animation: {
    currentState: string;
    blendWeights: Map<string, number>;
    boneTransforms: Map<string, THREE.Matrix4>;
    playbackTime: number;
  };
  input: {
    keys: Set<string>;
    mousePosition: { x: number; y: number; z: number };
    mouseDelta: { x: number; y: number; z: number };
    touchPoints: any[];
  };
  collision: {
    contacts: any[];
    triggers: Set<string>;
    raycastHits: Map<string, RaycastResult>;
  };
  gameplay: {
    health: number;
    stamina: number;
    equipment: Map<string, any>;
    abilities: Map<string, any>;
    buffs: any[];
  };
}

export type SerializableCharacterStateSnapshot = SerializableSnapshot;

export interface CollisionVolume {} // Stub

// ============================================================================
// CORE COMPONENTS  
// ============================================================================

interface Component {
  name: string;
  update(deltaTime: number): void;
}

export const RAYCAST_EMITTER_COMPONENT = 'raycast_emitter';

export class RaycastEmitterComponent implements Component {
  name = RAYCAST_EMITTER_COMPONENT;
  points: RaycastPoint[] = [];
  constructor(points: RaycastPoint[]) {
    this.points = points;
  }
  update() {}
}

export class Node {
  name: string;
  mesh: THREE.Object3D;
  parent: Node | null = null;
  children: Node[] = [];
  components: Map<string, Component> = new Map();
  localTransform = new THREE.Matrix4();
  worldTransform = new THREE.Matrix4();
  testTransform: THREE.Matrix4 | null = null;
  collider: THREE.Sphere | null = null;
  _colliderLocalCenter: THREE.Vector3 | null = null;

  private animationTime = 0;

  constructor(name: string, mesh?: THREE.Object3D) {
    this.name = name;
    this.mesh = mesh || new THREE.Group();
    this.mesh.name = name;
  }

  addChild(childNode: Node): void {
    if (childNode.parent) {
      childNode.parent.children = childNode.parent.children.filter(c => c !== childNode);
    }
    childNode.parent = this;
    this.children.push(childNode);
    this.mesh.add(childNode.mesh);
  }

  attach(childNode: Node, socketName: string): void {
    const socket = this.mesh.getObjectByName(socketName);
    if (socket) {
        if (childNode.parent) {
            childNode.parent.children = childNode.parent.children.filter(c => c !== childNode);
        }
        childNode.parent = this;
        this.children.push(childNode);
        socket.add(childNode.mesh);
    } else {
        console.warn(`Socket "${socketName}" not found on node "${this.name}". Attaching to root of mesh.`);
        this.addChild(childNode);
    }
  }

  addComponent(component: Component): void {
    this.components.set(component.name, component);
  }

  getComponent<T extends Component>(name: string): T | undefined {
    return this.components.get(name) as T;
  }
  
  update(deltaTime: number): void {
    this.animationTime += deltaTime;
    this.components.forEach(c => c.update(deltaTime));
    
    // Apply local transform from mesh (might be animated)
    this.mesh.updateMatrix();

    // Apply test transform if it exists
    if (this.testTransform) {
        this.mesh.matrix.multiply(this.testTransform);
    }
    
    this.localTransform.copy(this.mesh.matrix);
  }
  
  updateWorldMatrix(): void {
    this.mesh.updateWorldMatrix(true, false);
    this.worldTransform.copy(this.mesh.matrixWorld);

    for (const child of this.children) {
      child.updateWorldMatrix();
    }
  }
}

// ============================================================================
// ANIMATION CONTROLLER
// ============================================================================

const findNode = (root: Node, name: string): Node | null => {
    if (root.name === name) return root;
    for (const child of root.children) {
        const found = findNode(child, name);
        if (found) return found;
    }
    return null;
};

export class AnimationController implements Component {
    name = "animation_controller";
    private rootNode: Node;
    private time = 0;

    constructor() {
        this.rootNode = new Node('placeholder'); 
    }
    
    onAdded(rootNode: Node) {
        this.rootNode = rootNode;
    }

    update(deltaTime: number) {
        this.time += deltaTime;
    }

    updateIdle(deltaTime: number): boolean {
        this.resetPoses();
        const head = findNode(this.rootNode, 'head');
        if (head) {
             head.mesh.rotation.y = Math.sin(this.time * 0.5) * 0.1;
             return true;
        }
        return false;
    }
    
    updateWalk(deltaTime: number): boolean {
        const speed = 10;
        const armSwing = 0.8;
        const legSwing = 0.8;
        
        const leftArm = findNode(this.rootNode, 'left_arm');
        const rightArm = findNode(this.rootNode, 'right_arm');
        const leftLeg = findNode(this.rootNode, 'left_leg');
        const rightLeg = findNode(this.rootNode, 'right_leg');
        const leftFoot = findNode(this.rootNode, 'left_foot');
        const rightFoot = findNode(this.rootNode, 'right_foot');

        let changed = false;
        if(leftArm) { leftArm.mesh.rotation.x = Math.sin(this.time * speed) * armSwing; changed = true; }
        if(rightArm) { rightArm.mesh.rotation.x = -Math.sin(this.time * speed) * armSwing; changed = true; }
        if(leftLeg) { leftLeg.mesh.rotation.x = -Math.sin(this.time * speed) * legSwing; changed = true; }
        if(rightLeg) { rightLeg.mesh.rotation.x = Math.sin(this.time * speed) * legSwing; changed = true; }

        // Add a little foot rotation
        if(leftFoot) { leftFoot.mesh.rotation.x = 0.2 * Math.sin(this.time * speed - Math.PI * 0.5); changed = true; }
        if(rightFoot) { rightFoot.mesh.rotation.x = 0.2 * Math.sin(this.time * speed + Math.PI * 0.5); changed = true; }
        
        return changed;
    }
    
    updateJump(): boolean {
        const legSwing = 0.5;
        const armSwing = 0.2;

        const leftLeg = findNode(this.rootNode, 'left_leg');
        const rightLeg = findNode(this.rootNode, 'right_leg');
        const leftArm = findNode(this.rootNode, 'left_arm');
        const rightArm = findNode(this.rootNode, 'right_arm');
        const leftFoot = findNode(this.rootNode, 'left_foot');
        const rightFoot = findNode(this.rootNode, 'right_foot');

        let changed = false;
        if(leftLeg) { leftLeg.mesh.rotation.x = legSwing; changed = true; }
        if(rightLeg) { rightLeg.mesh.rotation.x = legSwing; changed = true; }
        if(leftArm) { leftArm.mesh.rotation.x = armSwing; changed = true; }
        if(rightArm) { rightArm.mesh.rotation.x = armSwing; changed = true; }
        if(leftFoot) { leftFoot.mesh.rotation.x = 0; changed = true; }
        if(rightFoot) { rightFoot.mesh.rotation.x = 0; changed = true; }
        
        return changed;
    }

    private resetPoses() {
        const nodes = ['left_arm', 'right_arm', 'left_leg', 'right_leg', 'head', 'left_foot', 'right_foot'];
        nodes.forEach(name => {
            const node = findNode(this.rootNode, name);
            if(node) node.mesh.rotation.set(0,0,0);
        });
    }
}

// ============================================================================
// CHARACTER PARTS (same as original, not duplicating for brevity)
// ============================================================================
const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6 });
const jointMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.4, metalness: 0.2 });

const largeJointGeo = new THREE.SphereGeometry(6, 16, 16);
const mediumJointGeo = new THREE.SphereGeometry(4, 16, 16);

const createSocket = (name: string) => {
    const socket = new THREE.Object3D();
    socket.name = name;
    return socket;
};

export function createHeadNode(): Node {
  const geo = new THREE.BoxGeometry(20, 20, 20);
  const mesh = new THREE.Mesh(geo, defaultMaterial);
  mesh.position.y = 15;
  const node = new Node('head', mesh);
  node._colliderLocalCenter = mesh.position.clone();
  node.collider = new THREE.Sphere(node._colliderLocalCenter, 12);
  node.addComponent(createHeadRaycasters());
  return node;
}

export function createHandNode(isLeft: boolean): Node {
    const geo = new THREE.BoxGeometry(8, 10, 4);
    const mesh = new THREE.Mesh(geo, defaultMaterial);
    mesh.position.y = -5;
    const node = new Node(isLeft ? 'left_hand' : 'right_hand', mesh);
    node._colliderLocalCenter = mesh.position.clone();
    node.collider = new THREE.Sphere(node._colliderLocalCenter, 6);
    node.addComponent(createHandRaycasters(isLeft));
    return node;
}

export function createArmNode(isLeft: boolean): Node {
  const geo = new THREE.BoxGeometry(10, 40, 10);
  const mesh = new THREE.Mesh(geo, defaultMaterial);
  mesh.position.y = -20;
  
  const handSocket = createSocket('hand_socket');
  handSocket.position.y = -20;
  mesh.add(handSocket);

  const wristJoint = new THREE.Mesh(mediumJointGeo, jointMaterial);
  wristJoint.position.copy(handSocket.position);
  mesh.add(wristJoint);

  const node = new Node(isLeft ? 'left_arm' : 'right_arm', mesh);
  node._colliderLocalCenter = mesh.position.clone();
  node.collider = new THREE.Sphere(node._colliderLocalCenter, 20);
  return node;
}

export function createFootNode(isLeft: boolean): Node {
    const geo = new THREE.BoxGeometry(10, 8, 20);
    const mesh = new THREE.Mesh(geo, defaultMaterial);
    mesh.position.z = 4;
    const node = new Node(isLeft ? 'left_foot' : 'right_foot', mesh);
    node._colliderLocalCenter = new THREE.Vector3(0, -4, 4);
    node.collider = new THREE.Sphere(node._colliderLocalCenter, 10);
    node.addComponent(createFootRaycasters(isLeft));
    return node;
}

export function createLegNode(isLeft: boolean): Node {
  const geo = new THREE.BoxGeometry(12, 50, 12);
  const mesh = new THREE.Mesh(geo, defaultMaterial);
  mesh.position.y = -25;

  const footSocket = createSocket('foot_socket');
  footSocket.position.y = -25;
  mesh.add(footSocket);

  const ankleJoint = new THREE.Mesh(mediumJointGeo, jointMaterial);
  ankleJoint.position.copy(footSocket.position);
  mesh.add(ankleJoint);

  const node = new Node(isLeft ? 'left_leg' : 'right_leg', mesh);
  node._colliderLocalCenter = mesh.position.clone();
  node.collider = new THREE.Sphere(node._colliderLocalCenter, 25);
  node.addComponent(createLegRaycasters(isLeft));
  return node;
}

export function createTorsoNode(): Node {
  const geo = new THREE.BoxGeometry(30, 50, 20);
  const mesh = new THREE.Mesh(geo, defaultMaterial);

  // Neck
  const headSocket = createSocket('head_socket');
  headSocket.position.y = 25;
  mesh.add(headSocket);
  const neckJoint = new THREE.Mesh(mediumJointGeo, jointMaterial);
  neckJoint.position.copy(headSocket.position);
  mesh.add(neckJoint);

  // Shoulders
  const leftShoulderSocket = createSocket('left_shoulder_socket');
  leftShoulderSocket.position.set(-20, 20, 0);
  mesh.add(leftShoulderSocket);
  const leftShoulderJoint = new THREE.Mesh(largeJointGeo, jointMaterial);
  leftShoulderJoint.position.copy(leftShoulderSocket.position);
  mesh.add(leftShoulderJoint);
  
  const rightShoulderSocket = createSocket('right_shoulder_socket');
  rightShoulderSocket.position.set(20, 20, 0);
  mesh.add(rightShoulderSocket);
  const rightShoulderJoint = new THREE.Mesh(largeJointGeo, jointMaterial);
  rightShoulderJoint.position.copy(rightShoulderSocket.position);
  mesh.add(rightShoulderJoint);
  
  // Hips
  const leftHipSocket = createSocket('left_hip_socket');
  leftHipSocket.position.set(-10, -25, 0);
  mesh.add(leftHipSocket);
  const leftHipJoint = new THREE.Mesh(largeJointGeo, jointMaterial);
  leftHipJoint.position.copy(leftHipSocket.position);
  mesh.add(leftHipJoint);

  const rightHipSocket = createSocket('right_hip_socket');
  rightHipSocket.position.set(10, -25, 0);
  mesh.add(rightHipSocket);
  const rightHipJoint = new THREE.Mesh(largeJointGeo, jointMaterial);
  rightHipJoint.position.copy(rightHipSocket.position);
  mesh.add(rightHipJoint);
  
  const node = new Node('torso', mesh);
  node._colliderLocalCenter = new THREE.Vector3();
  node.collider = new THREE.Sphere(node._colliderLocalCenter, 28);
  node.addComponent(createTorsoRaycasters());

  return node;
}

// ============================================================================
// STATE EVENT EMITTER
// ============================================================================
export class StateEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();
  on(event: string, callback: Function): void { 
    if (!this.listeners.has(event)) { 
      this.listeners.set(event, new Set()); 
    } 
    this.listeners.get(event)!.add(callback); 
  }
  off(event: string, callback: Function): void { 
    this.listeners.get(event)?.delete(callback); 
  }
  emit(event: string, data: any): void { 
    this.listeners.get(event)?.forEach(callback => callback(data)); 
  }
}

// ============================================================================
// OPTIMIZED SKELETON CLASS
// ============================================================================
export class Skeleton {
  public rootNode: Node;
  private scene: THREE.Scene;
  private eventEmitter = new StateEventEmitter();
  private currentState!: CharacterStateSnapshot;
  private allNodes: Node[] = [];
  private raycaster = new THREE.Raycaster();
  private lastStateString: string = "";

  private animationController!: AnimationController;
  private characterState: 'idle' | 'walking' | 'jumping' = 'idle';
  
  private rayVisualizers = new Map<string, THREE.ArrowHelper>();
  private visualizersVisible = false;

  // PERFORMANCE OPTIMIZATION: Cached raycast targets - updated only when scene changes
  private cachedRaycastTargets: THREE.Object3D[] = [];
  private raycastTargetsDirty = true;

  // PERFORMANCE OPTIMIZATION: Reusable objects to avoid garbage collection
  private _raycastOrigin = new THREE.Vector3();
  private _raycastDirection = new THREE.Vector3();
  private _tempVector = new THREE.Vector3();
  private _tempQuaternion = new THREE.Quaternion();
  private _matrixNeedsUpdate = false;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.rootNode = new Node('skeleton_root');
    this.initializeState();
    this._buildCharacter();
    this.scene.add(this.rootNode.mesh);
  }

  private _buildCharacter(): void {
    const torso = createTorsoNode();
    this.rootNode.addChild(torso);
    
    // Head
    torso.attach(createHeadNode(), 'head_socket');
    
    // Arms and Hands
    const leftArm = createArmNode(true);
    torso.attach(leftArm, 'left_shoulder_socket');
    leftArm.attach(createHandNode(true), 'hand_socket');

    const rightArm = createArmNode(false);
    torso.attach(rightArm, 'right_shoulder_socket');
    rightArm.attach(createHandNode(false), 'hand_socket');

    // Legs and Feet
    const leftLeg = createLegNode(true);
    torso.attach(leftLeg, 'left_hip_socket');
    leftLeg.attach(createFootNode(true), 'foot_socket');

    const rightLeg = createLegNode(false);
    torso.attach(rightLeg, 'right_hip_socket');
    rightLeg.attach(createFootNode(false), 'foot_socket');

    const animController = new AnimationController();
    this.rootNode.addComponent(animController);
    animController.onAdded(this.rootNode);
    this.animationController = animController;

    const collectNodes = (node: Node) => {
      this.allNodes.push(node);
      node.children.forEach(collectNodes);
    };
    collectNodes(this.rootNode);
    this._createRayVisualizers();
  }
  
  private initializeState(): void {
    this.currentState = {
      timestamp: Date.now(), frameId: 0,
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      physics: { velocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, isGrounded: false, groundNormal: { x: 0, y: 1, z: 0 }, surfaceType: 'none' },
      animation: { currentState: 'idle', blendWeights: new Map(), boneTransforms: new Map(), playbackTime: 0 },
      input: { keys: new Set(), mousePosition: { x: 0, y: 0, z: 0 }, mouseDelta: { x: 0, y: 0, z: 0 }, touchPoints: [] },
      collision: { contacts: [], triggers: new Set(), raycastHits: new Map() },
      gameplay: { health: 100, stamina: 100, equipment: new Map(), abilities: new Map(), buffs: [] }
    };
  }

  // PERFORMANCE OPTIMIZATION: Fixed redundant matrix updates and unnecessary object creation
  public updateFromPlayerState(deltaTime: number, velocity: THREE.Vector3, isGrounded: boolean, keys: { [key:string]: boolean }): void {
    this.currentState.frameId++;
    this.currentState.timestamp = Date.now();
    
    // FIXED: Reuse Set instead of recreating
    this.currentState.input.keys.clear();
    for (const key in keys) {
      if (keys[key]) this.currentState.input.keys.add(key);
    }

    // Update physics state directly
    const physVel = this.currentState.physics.velocity;
    physVel.x = velocity.x;
    physVel.y = velocity.y; 
    physVel.z = velocity.z;
    this.currentState.physics.isGrounded = isGrounded;
    
    // Update animation state machine
    this._updateCharacterState();
    
    // FIXED: Run appropriate animation (marks matrix dirty if needed)
    this._runAnimation(deltaTime);
    
    // PERFORMANCE OPTIMIZATION: Only update matrices if animation changed them
    if (this._matrixNeedsUpdate) {
      this.rootNode.update(deltaTime);
      this.rootNode.updateWorldMatrix();
      this._updateColliders();
      this._matrixNeedsUpdate = false;
    }

    // Perform raycasting
    this._performRaycasting();
    
    // Sync serializable state and emit changes
    this._syncStateObject();
    this._emitStateChanges();
  }

  // PERFORMANCE OPTIMIZATION: Track whether animation actually changed poses
  private _runAnimation(deltaTime: number): void {
    let animationChanged = false;
    
    if (this.characterState === 'walking') {
        animationChanged = this.animationController.updateWalk(deltaTime);
    } else if (this.characterState === 'jumping') {
        animationChanged = this.animationController.updateJump();
    } else {
        animationChanged = this.animationController.updateIdle(deltaTime);
    }
    
    if (animationChanged) {
        this._matrixNeedsUpdate = true;
    }
  }

  private _updateColliders(): void {
      for (const node of this.allNodes) {
          if (node.collider && node._colliderLocalCenter) {
              node.collider.center.copy(node._colliderLocalCenter).applyMatrix4(node.mesh.matrixWorld);
          }
      }
  }
  
  private _updateCharacterState(): void {
    const isMovingHorizontally = Math.abs(this.currentState.physics.velocity.x) > 1.0 || Math.abs(this.currentState.physics.velocity.z) > 1.0;

    if (!this.currentState.physics.isGrounded) {
        this.characterState = 'jumping';
    } else if (isMovingHorizontally) {
        this.characterState = 'walking';
    } else {
        this.characterState = 'idle';
    }
    this.currentState.animation.currentState = this.characterState;
  }
  
  // PERFORMANCE OPTIMIZATION: Fixed inefficient raycast target filtering and object creation
  private _performRaycasting(): void {
    this.currentState.collision.raycastHits.clear();
    
    // FIXED: Update cached targets only when needed
    if (this.raycastTargetsDirty) {
      this.cachedRaycastTargets = this.scene.children.filter(obj => 
        obj.uuid !== this.rootNode.mesh.uuid && !obj.type.endsWith('Helper')
      );
      this.raycastTargetsDirty = false;
    }

    for (const node of this.allNodes) {
      const raycastComp = node.getComponent<RaycastEmitterComponent>(RAYCAST_EMITTER_COMPONENT);
      if (!raycastComp) continue;

      raycastComp.points.forEach(point => {
        if (!point.enabled) return;
        
        // FIXED: Reuse temp vectors to avoid allocation
        this._tempVector.set(point.offset.x, point.offset.y, point.offset.z);
        this._raycastOrigin.copy(this._tempVector).applyMatrix4(node.mesh.matrixWorld);
        
        this._tempVector.set(point.direction.x, point.direction.y, point.direction.z);
        this._raycastDirection.copy(this._tempVector).transformDirection(node.mesh.matrixWorld).normalize();

        this.raycaster.set(this._raycastOrigin, this._raycastDirection);
        this.raycaster.far = point.distance;
        const intersects = this.raycaster.intersectObjects(this.cachedRaycastTargets, true);

        let result: RaycastResult;
        if (intersects.length > 0) {
          const hit = intersects[0];
          result = {
            hit: true,
            point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
            normal: hit.face ? { x: hit.face.normal.x, y: hit.face.normal.y, z: hit.face.normal.z } : { x: 0, y: 1, z: 0 },
            distance: hit.distance,
            object: hit.object.name
          };
        } else {
          result = { hit: false, point: {x:0,y:0,z:0}, normal: {x:0,y:1,z:0}, distance: Infinity, object: undefined };
        }
        
        this.currentState.collision.raycastHits.set(point.name, result);
        
        // FIXED: Only update visualizer if visible
        if (this.visualizersVisible) {
          const visualizer = this.rayVisualizers.get(point.name);
          if (visualizer) {
            visualizer.position.copy(this._raycastOrigin);
            visualizer.setDirection(this._raycastDirection);
            visualizer.setColor(result.hit ? 0xff0000 : 0xffff00);
            visualizer.setLength(point.distance);
          }
        }
      });
    }
  }

  // PERFORMANCE OPTIMIZATION: Direct property access instead of destructuring
  private _syncStateObject(): void {
      const { position, quaternion } = this.rootNode.mesh;
      const transformPos = this.currentState.transform.position;
      const transformRot = this.currentState.transform.rotation;
      
      transformPos.x = position.x;
      transformPos.y = position.y;
      transformPos.z = position.z;

      transformRot.x = quaternion.x;
      transformRot.y = quaternion.y;
      transformRot.z = quaternion.z;
      transformRot.w = quaternion.w;
  }

  // PERFORMANCE OPTIMIZATION: Avoid expensive array operations in hot path
  private _emitStateChanges(): void {
    // Create state signature without expensive array operations
    let hitSignature = '';
    for (const result of this.currentState.collision.raycastHits.values()) {
      hitSignature += result.hit ? '1' : '0';
    }
    
    const stateString = `${this.currentState.transform.position.y.toFixed(2)},${this.currentState.transform.rotation.y.toFixed(2)},${this.characterState},${hitSignature}`;
    if (stateString !== this.lastStateString) {
        this.lastStateString = stateString;
        this.eventEmitter.emit('character.state.changed', this.getCurrentState());
    }
  }
  
  private _createRayVisualizers(): void {
    this.getAllRaycastPoints().forEach(point => {
        const arrow = new THREE.ArrowHelper(
            new THREE.Vector3(point.direction.x, point.direction.y, point.direction.z),
            new THREE.Vector3(0,0,0),
            point.distance,
            0xffff00,
            4,
            2
        );
        arrow.visible = this.visualizersVisible;
        this.rayVisualizers.set(point.name, arrow);
        this.scene.add(arrow);
    });
  }

  // PERFORMANCE OPTIMIZATION: Mark raycast targets as dirty when scene changes
  public markRaycastTargetsDirty(): void {
    this.raycastTargetsDirty = true;
  }

  public setRayVisualizersVisible(visible: boolean): void {
      this.visualizersVisible = visible;
      this.rayVisualizers.forEach(arrow => {
          arrow.visible = visible;
      });
  }

  public findNodeByName(name: string): Node | undefined {
    return this.allNodes.find(n => n.name === name);
  }

  public getBodyNodesWithColliders(): Node[] {
      return this.allNodes.filter(n => n.collider);
  }

  public findRaycastPoint(name: string): { point: RaycastPoint, node: Node } | null {
    for (const node of this.allNodes) {
      const comp = node.getComponent<RaycastEmitterComponent>(RAYCAST_EMITTER_COMPONENT);
      if (comp) {
        const point = comp.points.find(p => p.name === name);
        if (point) return { point, node };
      }
    }
    return null;
  }
  
  public setNodeTestTransform(nodeName: string, transform: { rotation: { x: number, y: number, z: number } }): void {
    const node = this.findNodeByName(nodeName);
    if (node) {
        if (!node.testTransform) {
            node.testTransform = new THREE.Matrix4();
        }
        const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(transform.rotation.x),
            THREE.MathUtils.degToRad(transform.rotation.y),
            THREE.MathUtils.degToRad(transform.rotation.z),
            'XYZ'
        );
        node.testTransform.makeRotationFromEuler(euler);
        this._matrixNeedsUpdate = true;
    }
  }

  public clearNodeTestTransform(nodeName: string): void {
    const node = this.findNodeByName(nodeName);
    if (node) {
        node.testTransform = null;
        this._matrixNeedsUpdate = true;
    }
  }

  public getRootObject(): THREE.Object3D { return this.rootNode.mesh; }
  public getCurrentState(): SerializableCharacterStateSnapshot { 
    return JSON.parse(JSON.stringify(this.currentState, (k, v) => (v instanceof Map ? Array.from(v.entries()) : v instanceof Set ? Array.from(v) : v))); 
  }
  public on(event: string, callback: Function): void { this.eventEmitter.on(event, callback); }
  public off(event: string, callback: Function): void { this.eventEmitter.off(event, callback); }
  
  public getAllNodeNames(): string[] {
    return this.allNodes.map(n => n.name);
  }

  public getAllRaycastPoints(): RaycastPoint[] {
    const allPoints: RaycastPoint[] = [];
    this.allNodes.forEach(node => {
        const comp = node.getComponent<RaycastEmitterComponent>(RAYCAST_EMITTER_COMPONENT);
        if (comp) allPoints.push(...comp.points);
    });
    return allPoints;
  }
  
  public getAllCollisionVolumes(): CollisionVolume[] { return []; }
  
  public dispose(): void {
    this.allNodes = [];
    if(this.rootNode.mesh && this.scene) this.scene.remove(this.rootNode.mesh);

    this.rayVisualizers.forEach(arrow => {
        this.scene.remove(arrow);
        arrow.dispose();
    });
    this.rayVisualizers.clear();

    this.eventEmitter = new StateEventEmitter();
  }
}