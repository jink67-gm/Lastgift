// glTF 모델 불러오기. 게임 시작 전에 필요한 모델을 한 번에 불러 두고, 장면에서는 복제해 쓴다.
// 불러오기에 실패해도 게임은 계속된다(기본 도형으로 대신 그린다). 판정은 모델과 무관하다.
import type * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Kenney 모델은 1단위 = 문 높이라 실제 크기(문 2 m)에 맞게 키운다 */
export const KENNEY_SCALE = 2;

export const MODEL_FILES = {
  elf: 'quaternius/hooded-adventurer.glb',
  // 콩이(유기견): Quaternius Shiba Inu(CC0). 다시 칠하고 줄여 쓴다
  dog: 'quaternius/shiba-inu.glb',
  cabinWall: 'kenney-holiday/cabin-wall.glb',
  cabinCorner: 'kenney-holiday/cabin-corner.glb',
  cabinDoorway: 'kenney-holiday/cabin-doorway.glb',
  cabinWindow: 'kenney-holiday/cabin-window-a.glb',
  cabinWreath: 'kenney-holiday/cabin-wall-wreath.glb',
  cabinGable: 'kenney-holiday/cabin-wall-roof.glb',
  cabinRoof: 'kenney-holiday/cabin-roof-snow.glb',
  treeSnowA: 'kenney-holiday/tree-snow-a.glb',
  treeSnowB: 'kenney-holiday/tree-snow-b.glb',
  treeDecorated: 'kenney-holiday/tree-decorated-snow.glb',
  lantern: 'kenney-holiday/lantern.glb',
  bench: 'kenney-holiday/bench.glb',
  snowPile: 'kenney-holiday/snow-pile.glb',
  rocks: 'kenney-holiday/rocks-medium.glb',
  lights: 'kenney-holiday/lights-colored.glb',
  // Tiny Treats · Homely House (CC0, Isa Lousberg). 텍스처 하나(tiny_treats_texture_1.png)를 같이 쓴다
  ttHouse: 'tinytreats/house.gltf',
  ttFence: 'tinytreats/fence_straight_long.gltf',
  ttFencePost: 'tinytreats/fence_post.gltf',
  ttMailbox: 'tinytreats/mailbox.gltf',
} as const;

export type ModelName = keyof typeof MODEL_FILES;

export class Models {
  private constructor(
    private readonly loaded: Map<ModelName, GLTF>,
    readonly failed: ModelName[],
  ) {}

  /** 모두 불러온다. 실패한 것은 failed에 남기고 나머지로 계속한다 */
  static async load(names: readonly ModelName[] = Object.keys(MODEL_FILES) as ModelName[], base = import.meta.env.BASE_URL): Promise<Models> {
    const loader = new GLTFLoader();
    const loaded = new Map<ModelName, GLTF>();
    const failed: ModelName[] = [];
    await Promise.all(
      names.map(async (n) => {
        try {
          loaded.set(n, await loader.loadAsync(`${base}models/${MODEL_FILES[n]}`));
        } catch {
          failed.push(n);
        }
      }),
    );
    return new Models(loaded, failed);
  }

  /** 모델이 하나도 없는 상태(기본 도형만 쓴다) */
  static none(): Models {
    return new Models(new Map(), []);
  }

  has(n: ModelName): boolean {
    return this.loaded.has(n);
  }

  /** 장면 복제(뼈대가 있는 모델도 안전하게). 없으면 null */
  clone(n: ModelName): THREE.Object3D | null {
    const g = this.loaded.get(n);
    return g ? SkeletonUtils.clone(g.scene) : null;
  }

  animations(n: ModelName): THREE.AnimationClip[] {
    return this.loaded.get(n)?.animations ?? [];
  }
}
