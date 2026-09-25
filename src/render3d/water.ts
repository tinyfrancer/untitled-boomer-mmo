import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { TILE_SIZE } from '../config/constants';
import { WATER_TILE } from '../data/tiles';
import { WATER_DEPTH } from './ground';

/**
 * The clock the glints move on, in seconds of view time. One uniform shared by
 * every zone's water rather than one per mesh, so the view advances it once a
 * frame and a zone walk has nothing to rewire.
 */
export const WATER_TIME = { value: 0 };

/** How far above the water's floor the glints lie, so they never fight it for depth. */
const SHEEN_LIFT = 1;

/**
 * Light moving on the water: a thin sheet over every water tile, added onto
 * what is under it, whose brightness is three crossing waves of world position
 * and time. Where the three agree there is a glint; everywhere else there is
 * nothing, so the water keeps its colour and gains motion.
 *
 * A separate mesh because the ground is one material and the water has to move
 * while the grass does not, and a shader rather than a moving geometry because
 * rewriting the vertices of a lake every frame is a buffer upload a frame for
 * something the card can compute from a clock. No texture, per decision 54.
 *
 * `apron` matches the ground's, so the beach's ocean glints out to the haze.
 */
export function buildWaterSheen(map: readonly (readonly number[])[], apron = 0): Mesh | null {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;

  const positions: number[] = [];
  const y = -WATER_DEPTH + SHEEN_LIFT;
  for (let row = -apron; row < rows + apron; row += 1) {
    for (let col = -apron; col < cols + apron; col += 1) {
      const tile =
        map[Math.min(rows - 1, Math.max(0, row))]?.[Math.min(cols - 1, Math.max(0, col))];
      if (tile !== WATER_TILE) continue;
      const west = col * TILE_SIZE;
      const north = row * TILE_SIZE;
      const east = west + TILE_SIZE;
      const south = north + TILE_SIZE;
      positions.push(west, y, north, west, y, south, east, y, south);
      positions.push(west, y, north, east, y, south, east, y, north);
    }
  }
  if (positions.length === 0) return null;

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, sheenMaterial());
  mesh.name = 'water';
  mesh.userData.kind = 'water';
  // Drawn after the ground it sits on, which it has to be to add onto it.
  mesh.renderOrder = 1;
  return mesh;
}

function sheenMaterial(): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uWaterTime = WATER_TIME;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSheen;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSheen = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vSheen;\nuniform float uWaterTime;',
      )
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          'float wave = sin(vSheen.x * 0.045 + uWaterTime * 1.1)',
          '  + sin(vSheen.y * 0.061 - uWaterTime * 0.8)',
          '  + sin((vSheen.x + vSheen.y) * 0.029 + uWaterTime * 1.7);',
          'diffuseColor.a *= smoothstep(1.7, 2.7, wave) * 0.45;',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'water-sheen';
  return material;
}
