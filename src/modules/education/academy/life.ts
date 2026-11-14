import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Station } from "./lessons";
import type { PlayerState } from "./World3D";

/** Conseils que les habitants de l'ile donnent quand on passe pres d'eux. */
export const NPC_TIPS = [
  "Psst… décide où tu sors AVANT d'entrer dans un trade.",
  "Moi, je ne risque jamais plus de 2 % de mon portefeuille sur un trade.",
  "Un graphique qui monte trop vite ? Attention au FOMO !",
  "J'ai perdu 3 fois de suite hier… alors je fais une pause aujourd'hui.",
  "Le prix rebondit toujours vers le même niveau ? C'est un support.",
  "Trop de trades = trop de frais. La patience paie.",
  "Diversifie : ne mets jamais toute ta cargaison sur un seul bateau.",
  "Après −50 %, il faut +100 % pour revenir. Protège ton capital !",
  "Le RSI au-dessus de 70 ? L'actif est peut-être suracheté.",
  "Compare-toi toujours à l'agent IA dans le Jeu de trading.",
];

const NPC_COLORS = ["#DB2777", "#16A34A", "#9333EA", "#EA580C", "#0891B2"];
const NPC_NAMES = ["Lina", "Sami", "Nour", "Karim", "Inès"];

function std(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
}

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

interface Npc {
  group: THREE.Group;
  legs: THREE.Mesh[];
  bubble: HTMLDivElement;
  label: CSS2DObject;
  route: THREE.Vector2[];
  leg: number;
  t: number;
  speed: number;
  talking: boolean;
  tip: number;
}

/**
 * Ajoute la vie sur l'ile : nuages qui passent, oiseaux qui volent, fumee du volcan, bateau autour de l'ile,
 * etincelles autour de la mission et habitants qui se promenent et donnent des conseils de trading.
 */
export function buildLife(scene: THREE.Scene, stations: Station[], path: { x: number; z: number }[]) {
  // nuages
  const cloudMat = std("#FFFFFF", { roughness: 1 });
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Group();
    const n = 3 + (i % 3);
    for (let k = 0; k < n; k++) {
      const puff = part(new THREE.IcosahedronGeometry(1.6 + ((k * 37) % 10) / 10, 0), cloudMat, k * 1.9 - n, ((k * 13) % 5) / 6, ((k * 7) % 3) - 1, false);
      c.add(puff);
    }
    c.position.set(-80 + i * 22, 24 + (i % 3) * 3, -50 + ((i * 29) % 100));
    c.userData.speed = 1.2 + (i % 4) * 0.4;
    scene.add(c);
    clouds.push(c);
  }

  // oiseaux
  const birdMat = std("#1F2937");
  const birds = Array.from({ length: 6 }, (_, i) => {
    const b = new THREE.Group();
    const body = part(new THREE.BoxGeometry(0.25, 0.2, 0.7), birdMat, 0, 0, 0, false);
    const lw = part(new THREE.BoxGeometry(0.9, 0.05, 0.35), birdMat, -0.5, 0, 0, false);
    const rw = part(new THREE.BoxGeometry(0.9, 0.05, 0.35), birdMat, 0.5, 0, 0, false);
    b.add(body, lw, rw);
    b.userData = { lw, rw, r: 18 + i * 4, h: 15 + (i % 3) * 3, speed: 0.25 + (i % 3) * 0.08, phase: i * 1.3 };
    scene.add(b);
    return b;
  });

  // fumee du volcan
  const volcano = stations.find((s) => s.shape === "volcano");
  const smoke = Array.from({ length: 10 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: "#9CA3AF", transparent: true, opacity: 0.5, flatShading: true }));
    m.userData.offset = i / 10;
    scene.add(m);
    return m;
  });

  // bateau qui fait le tour de l'ile
  const boat = new THREE.Group();
  boat.add(part(new THREE.BoxGeometry(1.6, 0.7, 3.6), std("#B91C1C"), 0, 0, 0));
  boat.add(part(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), std("#334155"), 0, 1.7, 0));
  const sail = new THREE.Mesh(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 3.2, 0.1), new THREE.Vector3(0, 0.6, 0.1), new THREE.Vector3(0, 0.6, 1.6)]),
    new THREE.MeshStandardMaterial({ color: "#F8FAFC", side: THREE.DoubleSide }),
  );
  sail.geometry.computeVertexNormals();
  boat.add(sail);
  scene.add(boat);

  // etincelles autour de la mission
  const sparkCount = 40;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: "#FDE047", size: 0.35, transparent: true, opacity: 0.9 }));
  scene.add(sparks);
  const sparkSeed = Array.from({ length: sparkCount }, (_, i) => ({ a: (i * 2.39996) % (Math.PI * 2), r: 3 + (i % 5) * 0.8, o: (i * 0.137) % 1 }));

  // habitants : ils font des allers-retours sur les chemins
  const npcs: Npc[] = [];
  // un habitant par chemin choisi (les chemins longs, pour qu'ils aient de la place pour marcher)
  const segments = [1, 3, 4, 6, 7].filter((k) => k + 1 < path.length);
  for (let i = 0; i < Math.min(NPC_COLORS.length, segments.length); i++) {
    const a = path[segments[i]];
    const b = path[segments[i] + 1];
    const g = new THREE.Group();
    const body = part(new THREE.CylinderGeometry(0.38, 0.5, 1.1, 8), std(NPC_COLORS[i]), 0, 0.95, 0);
    const head = part(new THREE.SphereGeometry(0.38, 10, 8), std(i % 2 ? "#8D5524" : "#F1C27D"), 0, 1.8, 0);
    const hair = part(new THREE.SphereGeometry(0.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(i % 2 ? "#111827" : "#78350F"), 0, 1.88, -0.02);
    const legMat = std("#1E293B");
    const legs = [part(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6), legMat, -0.18, 0.25, 0), part(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6), legMat, 0.18, 0.25, 0)];
    g.add(body, head, hair, ...legs);
    const div = document.createElement("div");
    Object.assign(div.style, {
      font: "500 12px Inter, sans-serif", color: "#0F172A", background: "#FFFFFF", padding: "6px 10px", borderRadius: "12px",
      boxShadow: "0 4px 14px rgba(0,0,0,.25)", maxWidth: "220px", whiteSpace: "normal", lineHeight: "1.35", display: "none",
      borderBottom: `3px solid ${NPC_COLORS[i]}`,
    });
    const label = new CSS2DObject(div);
    label.position.set(0, 3, 0);
    label.visible = false;
    g.add(label);
    // offset lateral pour ne pas marcher pile au milieu du chemin
    const off = (i % 2 ? 1 : -1) * 1.6;
    const dir = new THREE.Vector2(b.x - a.x, b.z - a.z).normalize();
    const side = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(off);
    const ra = new THREE.Vector2(a.x, a.z).add(side);
    const rb = new THREE.Vector2(b.x, b.z).add(side);
    // on s'arrete avant les batiments
    const shrink = (p: THREE.Vector2, q: THREE.Vector2) =>
      p.clone().add(q.clone().sub(p).normalize().multiplyScalar(Math.min(6, p.distanceTo(q) * 0.3)));
    const route = [shrink(ra, rb), shrink(rb, ra)];
    g.position.set(route[0].x, 0, route[0].y);
    scene.add(g);
    npcs.push({ group: g, legs, bubble: div, label, route, leg: 0, t: i * 0.23, speed: 2 + (i % 3) * 0.4, talking: false, tip: i * 2 });
  }

  return {
    /** @returns vrai si un habitant vient de commencer a parler */
    update(t: number, dt: number, player: PlayerState, quest: THREE.Object3D | null) {
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 90) c.position.x = -90;
      }
      for (const b of birds) {
        const u = b.userData as { lw: THREE.Mesh; rw: THREE.Mesh; r: number; h: number; speed: number; phase: number };
        const ang = t * u.speed + u.phase;
        b.position.set(Math.cos(ang) * u.r, u.h + Math.sin(t * 1.5 + u.phase) * 0.8, Math.sin(ang) * u.r);
        b.rotation.y = -ang;
        const flap = Math.sin(t * 10 + u.phase) * 0.6;
        u.lw.rotation.z = flap;
        u.rw.rotation.z = -flap;
      }
      if (volcano) {
        for (const m of smoke) {
          const k = (t * 0.12 + (m.userData.offset as number)) % 1;
          m.position.set(volcano.x + Math.sin(k * 6 + m.userData.offset * 20) * 0.8 + k * 2, 6.2 + k * 10, volcano.z + Math.cos(k * 5) * 0.6);
          m.scale.setScalar(0.6 + k * 2.2);
          (m.material as THREE.MeshStandardMaterial).opacity = 0.55 * (1 - k);
        }
      }
      const ba = t * 0.05;
      boat.position.set(Math.cos(ba) * 50, -0.4 + Math.sin(t * 1.6) * 0.15, Math.sin(ba) * 50);
      boat.rotation.y = -ba;
      boat.rotation.z = Math.sin(t * 1.2) * 0.06;

      sparks.visible = !!quest && quest.visible;
      if (quest && quest.visible) {
        for (let i = 0; i < sparkCount; i++) {
          const s = sparkSeed[i];
          const k = (t * 0.25 + s.o) % 1;
          const a = s.a + t * 0.4;
          sparkPos[i * 3] = quest.position.x + Math.cos(a) * s.r;
          sparkPos[i * 3 + 1] = 0.5 + k * 8;
          sparkPos[i * 3 + 2] = quest.position.z + Math.sin(a) * s.r;
        }
        sparkGeo.attributes.position.needsUpdate = true;
      }

      let startedTalking = false;
      for (const n of npcs) {
        const p = n.group.position;
        const near = Math.hypot(player.x - p.x, player.z - p.z) < 5;
        if (near) {
          // il s'arrete, se tourne vers le joueur et donne un conseil
          n.group.rotation.y = Math.atan2(player.x - p.x, player.z - p.z);
          n.legs.forEach((l) => (l.rotation.x = 0));
          if (!n.talking) {
            n.talking = true;
            n.tip = (n.tip + 1) % NPC_TIPS.length;
            n.bubble.textContent = `${NPC_NAMES[npcs.indexOf(n)]} : « ${NPC_TIPS[n.tip]} »`;
            startedTalking = true;
          }
          n.label.visible = true;
          n.bubble.style.display = "block";
          continue;
        }
        if (n.talking) {
          n.talking = false;
          n.label.visible = false;
          n.bubble.style.display = "none";
        }
        const from = n.route[n.leg];
        const to = n.route[1 - n.leg];
        const len = Math.max(0.5, from.distanceTo(to));
        n.t += (n.speed * dt) / len;
        if (n.t >= 1) {
          n.t = 0;
          n.leg = 1 - n.leg;
          continue;
        }
        p.set(from.x + (to.x - from.x) * n.t, Math.abs(Math.sin(t * 8)) * 0.08, from.y + (to.y - from.y) * n.t);
        n.group.rotation.y = Math.atan2(to.x - from.x, to.y - from.y);
        n.legs[0].rotation.x = Math.sin(t * 8) * 0.5;
        n.legs[1].rotation.x = -Math.sin(t * 8) * 0.5;
      }
      return startedTalking;
    },
  };
}
