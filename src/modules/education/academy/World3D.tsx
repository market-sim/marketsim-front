import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Station } from "./lessons";
import { buildLife } from "./life";

export type StationStatus = "locked" | "open" | "done" | "hidden";

/** Etat du joueur partage avec la mini-map (objet mutable, lu a chaque image : pas de re-rendu React). */
export interface PlayerState {
  x: number;
  z: number;
  heading: number;
  cameraYaw: number;
  /** destination demandee (clic sur le sol ou sur la mini-map) */
  target: { x: number; z: number } | null;
  /** vrai quand le joueur se deplace : la mini-map l'anime */
  moving: boolean;
}

export const START = { x: 0, z: 30 };
export const ISLAND_RADIUS = 38;
export const INTERACT_DISTANCE = 7;

interface Props {
  stations: Station[];
  statuses: Record<string, StationStatus>;
  /** station a faire maintenant (marqueur de quete au-dessus) */
  questId: string | null;
  /** stations conseillees par le parcours personnalise (anneau rouge qui pulse) */
  recommended: string[];
  player: PlayerState;
  paused: boolean;
  onNear: (id: string | null) => void;
  onInteract: () => void;
  onError: (message: string) => void;
  /** a chaque pas de l'avatar (bruit de pas) */
  onStep?: () => void;
  /** un personnage de l'ile vient de donner un conseil */
  onNpcTalk?: () => void;
}

const LOCKED_COLOR = new THREE.Color("#9CA3AF");

/** Graine pour que les arbres soient toujours au meme endroit. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function std(color: string | THREE.Color, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Construit le batiment d'une station. `accent` est la matiere recoloree selon l'etat (verrouille / ouvert). */
function buildStation(shape: Station["shape"], accent: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  const stone = std("#E5E7EB");
  const dark = std("#475569");
  const wood = std("#92400E");
  const gold = std("#FBBF24", { metalness: 0.4, roughness: 0.4 });
  switch (shape) {
    case "market": {
      g.add(mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.4, 8), stone, 0, 0.2, 0));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const x = Math.cos(a) * 2.6;
        const z = Math.sin(a) * 2.6;
        g.add(mesh(new THREE.BoxGeometry(1.6, 1.1, 1.2), wood, x, 0.95, z));
        const roof = mesh(new THREE.ConeGeometry(1.4, 0.9, 4), i % 2 ? accent : std("#F8FAFC"), x, 2.0, z);
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
      }
      g.add(mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 10), stone, 0, 0.8, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2, 6), dark, 0, 2.0, 0));
      g.add(mesh(new THREE.ConeGeometry(0.6, 0.8, 4), accent, 0, 3.4, 0));
      break;
    }
    case "tower": {
      g.add(mesh(new THREE.CylinderGeometry(2.6, 3.0, 1, 8), stone, 0, 0.5, 0));
      g.add(mesh(new THREE.CylinderGeometry(1.8, 2.2, 8, 8), accent, 0, 5, 0));
      g.add(mesh(new THREE.ConeGeometry(2.3, 2.4, 8), dark, 0, 10.2, 0));
      // les « bougies » de bourse autour de la tour
      const cols = ["#22C55E", "#EF4444", "#22C55E", "#22C55E", "#EF4444"];
      cols.forEach((c, i) => {
        const a = (i / cols.length) * Math.PI * 2;
        const h = 1.2 + (i % 3) * 0.7;
        g.add(mesh(new THREE.BoxGeometry(0.5, h, 0.5), std(c), Math.cos(a) * 3.4, 1 + h / 2, Math.sin(a) * 3.4));
        g.add(mesh(new THREE.BoxGeometry(0.08, h + 0.9, 0.08), dark, Math.cos(a) * 3.4, 1 + h / 2, Math.sin(a) * 3.4));
      });
      break;
    }
    case "bank": {
      g.add(mesh(new THREE.BoxGeometry(8, 0.6, 6), stone, 0, 0.3, 0));
      g.add(mesh(new THREE.BoxGeometry(6.4, 3.6, 4), std("#F1F5F9"), 0, 2.4, -0.6));
      for (let i = 0; i < 5; i++) g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.6, 8), stone, -2.6 + i * 1.3, 2.4, 2.0));
      g.add(mesh(new THREE.BoxGeometry(7, 0.5, 5.4), accent, 0, 4.45, 0));
      const roof = mesh(new THREE.CylinderGeometry(2.0, 2.0, 7, 3), accent, 0, 5.3, 0);
      roof.rotation.z = Math.PI / 2;
      roof.scale.set(1, 1, 0.55);
      g.add(roof);
      g.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), gold, 0, 3.0, 1.45));
      break;
    }
    case "fortress": {
      g.add(mesh(new THREE.BoxGeometry(8, 0.5, 8), stone, 0, 0.25, 0));
      const wall = std("#CBD5E1");
      g.add(mesh(new THREE.BoxGeometry(7, 2.4, 0.6), wall, 0, 1.7, 3.2));
      g.add(mesh(new THREE.BoxGeometry(7, 2.4, 0.6), wall, 0, 1.7, -3.2));
      g.add(mesh(new THREE.BoxGeometry(0.6, 2.4, 7), wall, 3.2, 1.7, 0));
      g.add(mesh(new THREE.BoxGeometry(0.6, 2.4, 7), wall, -3.2, 1.7, 0));
      for (const [x, z] of [[3.3, 3.3], [-3.3, 3.3], [3.3, -3.3], [-3.3, -3.3]]) {
        g.add(mesh(new THREE.CylinderGeometry(0.9, 1.0, 4, 8), wall, x, 2.2, z));
        g.add(mesh(new THREE.ConeGeometry(1.1, 1.4, 8), accent, x, 4.9, z));
      }
      g.add(mesh(new THREE.BoxGeometry(2.6, 5, 2.6), std("#E2E8F0"), 0, 3, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), dark, 0, 6.6, 0));
      g.add(mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), accent, 0.6, 7.4, 0));
      // un bouclier = la protection du capital
      g.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 6), gold, 0, 3.2, 1.35).rotateX(Math.PI / 2));
      break;
    }
    case "observatory": {
      g.add(mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.5, 12), stone, 0, 0.25, 0));
      g.add(mesh(new THREE.CylinderGeometry(2.6, 2.8, 3, 12), std("#F8FAFC"), 0, 2, 0));
      g.add(mesh(new THREE.SphereGeometry(2.7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), accent, 0, 3.5, 0));
      const tele = mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.4, 8), dark, 1.2, 5.6, 0);
      tele.rotation.z = -0.9;
      g.add(tele);
      break;
    }
    case "temple": {
      g.add(mesh(new THREE.BoxGeometry(8, 0.8, 8), stone, 0, 0.4, 0));
      g.add(mesh(new THREE.BoxGeometry(6.4, 0.8, 6.4), stone, 0, 1.2, 0));
      for (const [x, z] of [[2.4, 2.4], [-2.4, 2.4], [2.4, -2.4], [-2.4, -2.4]]) {
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), std("#FEF3C7"), x, 3.1, z));
      }
      const roof = mesh(new THREE.ConeGeometry(4.6, 2.6, 4), accent, 0, 5.9, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      g.add(mesh(new THREE.SphereGeometry(0.5, 10, 8), gold, 0, 7.5, 0));
      break;
    }
    case "harbor": {
      g.add(mesh(new THREE.BoxGeometry(7, 0.5, 4), wood, 0, 0.25, 0));
      const conts = ["#EF4444", "#3B82F6", "#22C55E", "#F59E0B"];
      conts.forEach((c, i) => g.add(mesh(new THREE.BoxGeometry(1.4, 1, 1), std(c), -2.4 + i * 1.6, 1, -0.9)));
      g.add(mesh(new THREE.BoxGeometry(1.4, 1, 1), std("#A855F7"), -1.6, 2, -0.9));
      // bateau
      const hull = mesh(new THREE.BoxGeometry(2, 0.9, 4.2), accent, 0, 0.6, 3.6);
      g.add(hull);
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 6), dark, 0, 2.8, 3.6));
      const sail = new THREE.Mesh(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 4.4, 3.65), new THREE.Vector3(0, 1.4, 3.65), new THREE.Vector3(0, 1.4, 5.3)]),
        new THREE.MeshStandardMaterial({ color: "#F8FAFC", side: THREE.DoubleSide, flatShading: true }),
      );
      sail.geometry.computeVertexNormals();
      sail.castShadow = true;
      g.add(sail);
      break;
    }
    case "vault": {
      g.add(mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 8), std("#1E293B"), 0, 0.3, 0));
      g.add(mesh(new THREE.BoxGeometry(5, 4, 4), std("#334155"), 0, 2.6, 0));
      g.add(mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 20), gold, 0, 2.6, 2.05).rotateX(Math.PI / 2));
      g.add(mesh(new THREE.BoxGeometry(5.4, 0.5, 4.4), accent, 0, 4.85, 0));
      g.add(mesh(new THREE.OctahedronGeometry(1, 0), std("#FDE047", { emissive: "#EAB308", emissiveIntensity: 0.8 }), 0, 6.4, 0));
      break;
    }
    case "volcano": {
      g.add(mesh(new THREE.CylinderGeometry(1.6, 5.2, 6, 10, 1, true), std("#57534E"), 0, 3, 0));
      g.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 10), std("#F97316", { emissive: "#EA580C", emissiveIntensity: 1.2 }), 0, 5.8, 0));
      g.add(mesh(new THREE.CylinderGeometry(5.6, 5.8, 0.4, 12), accent, 0, 0.2, 0));
      break;
    }
  }
  return g;
}

/**
 * Monde 3D de l'Academie : une ile avec une station par lecon, un avatar pilotable
 * (ZQSD / WASD / fleches, clic pour aller quelque part, glisser pour tourner la camera).
 */
export default function World3D({ stations, statuses, questId, recommended, player, paused, onNear, onInteract, onError, onStep, onNpcTalk }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const accents = useRef<Record<string, THREE.MeshStandardMaterial>>({});
  const rings = useRef<Record<string, THREE.Mesh>>({});
  const labels = useRef<Record<string, HTMLDivElement>>({});
  const groups = useRef<Record<string, THREE.Object3D[]>>({});
  const live = useRef({ statuses, recommended });
  live.current = { statuses, recommended };
  const questMarker = useRef<THREE.Group | null>(null);
  const pausedRef = useRef(paused);
  const cb = useRef({ onNear, onInteract, onStep, onNpcTalk });
  const nearRef = useRef<string | null>(null);
  pausedRef.current = paused;
  cb.current = { onNear, onInteract, onStep, onNpcTalk };

  // --- creation de la scene (une seule fois) ---
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onError("Ton navigateur ne peut pas afficher la 3D (WebGL désactivé). La carte 2D reste disponible.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.inset = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    host.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#8ED1FC");
    scene.fog = new THREE.Fog("#8ED1FC", 70, 150);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    camera.position.set(0, 60, 80);

    scene.add(new THREE.HemisphereLight("#E0F2FE", "#365314", 1.0));
    const sun = new THREE.DirectionalLight("#FFF7E6", 2.0);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 140;
    scene.add(sun);

    // eau + ile
    const water = new THREE.Mesh(new THREE.CircleGeometry(220, 48), new THREE.MeshStandardMaterial({ color: "#38BDF8", roughness: 0.3, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.8;
    scene.add(water);
    const sand = mesh(new THREE.CylinderGeometry(ISLAND_RADIUS + 2.5, ISLAND_RADIUS + 4, 1.4, 48), std("#FDE68A"), 0, -0.75, 0);
    scene.add(sand);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 1.5, 1, 48), std("#4ADE80"));
    grass.position.y = -0.5;
    grass.receiveShadow = true;
    scene.add(grass);

    // chemins entre les stations, dans l'ordre des lecons
    const pathMat = std("#FEF3C7");
    const points = [START, ...stations.filter((s) => !s.secret).map((s) => ({ x: s.x, z: s.z }))];
    const segments: [THREE.Vector2, THREE.Vector2][] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = new THREE.Vector2(points[i].x, points[i].z);
      const b = new THREE.Vector2(points[i + 1].x, points[i + 1].z);
      segments.push([a, b]);
      const len = a.distanceTo(b);
      const p = mesh(new THREE.BoxGeometry(2.4, 0.06, len), pathMat, (a.x + b.x) / 2, 0.03, (a.y + b.y) / 2);
      p.rotation.y = Math.atan2(b.x - a.x, b.y - a.y);
      p.castShadow = false;
      scene.add(p);
      const joint = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 16), pathMat, b.x, 0.03, b.y);
      joint.castShadow = false;
      scene.add(joint);
    }
    // portail de depart
    const gate = new THREE.Group();
    gate.add(mesh(new THREE.BoxGeometry(0.5, 3.4, 0.5), std("#92400E"), -2, 1.7, 0));
    gate.add(mesh(new THREE.BoxGeometry(0.5, 3.4, 0.5), std("#92400E"), 2, 1.7, 0));
    gate.add(mesh(new THREE.BoxGeometry(5.2, 0.6, 0.7), std("#1D4ED8"), 0, 3.6, 0));
    gate.position.set(START.x, 0, START.z - 4);
    scene.add(gate);
    const gateLabel = document.createElement("div");
    gateLabel.textContent = "Entrée de l'Académie";
    Object.assign(gateLabel.style, { font: "600 11px Inter, sans-serif", color: "#fff", background: "rgba(29,78,216,.85)", padding: "2px 8px", borderRadius: "999px" });
    const gl = new CSS2DObject(gateLabel);
    gl.position.set(0, 4.8, 0);
    gate.add(gl);

    // arbres et rochers (positions fixes)
    const rand = seeded(42);
    const trunk = std("#78350F");
    const leaves = [std("#15803D"), std("#16A34A"), std("#166534")];
    const nearPath = (x: number, z: number) =>
      segments.some(([a, b]) => {
        const ab = b.clone().sub(a);
        const t = Math.max(0, Math.min(1, new THREE.Vector2(x, z).sub(a).dot(ab) / ab.lengthSq()));
        return a.clone().add(ab.multiplyScalar(t)).distanceTo(new THREE.Vector2(x, z)) < 3;
      });
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < 85; tries++) {
      const r = Math.sqrt(rand()) * (ISLAND_RADIUS - 2);
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (stations.some((s) => Math.hypot(s.x - x, s.z - z) < 8.5) || nearPath(x, z) || Math.hypot(x - START.x, z - START.z) < 6) continue;
      const tree = new THREE.Group();
      const h = 1.2 + rand() * 1.2;
      tree.add(mesh(new THREE.CylinderGeometry(0.18, 0.25, h, 6), trunk, 0, h / 2, 0));
      if (rand() > 0.35) {
        tree.add(mesh(new THREE.ConeGeometry(1.2 + rand() * 0.6, 2.6 + rand(), 7), leaves[placed % 3], 0, h + 1.1, 0));
      } else {
        tree.add(mesh(new THREE.IcosahedronGeometry(1.2 + rand() * 0.5, 0), leaves[placed % 3], 0, h + 0.8, 0));
      }
      tree.position.set(x, 0, z);
      tree.rotation.y = rand() * Math.PI;
      scene.add(tree);
      placed++;
    }

    // stations
    const stationGroups: THREE.Group[] = [];
    for (const s of stations) {
      const accent = std(s.color);
      accents.current[s.id] = accent;
      const group = buildStation(s.shape, accent);
      group.position.set(s.x, 0, s.z);
      // les batiments regardent vers le centre de l'ile
      group.rotation.y = Math.atan2(-s.x, -s.z);
      group.userData.stationId = s.id;
      scene.add(group);
      stationGroups.push(group);
      groups.current[s.id] = [group];

      const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.2, 40), new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.5 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(s.x, 0.06, s.z);
      scene.add(ring);
      rings.current[s.id] = ring;
      groups.current[s.id].push(ring);

      const div = document.createElement("div");
      Object.assign(div.style, {
        font: "600 12px Inter, sans-serif", color: "#0F172A", background: "rgba(255,255,255,.92)",
        padding: "3px 10px", borderRadius: "999px", boxShadow: "0 2px 8px rgba(0,0,0,.18)", whiteSpace: "nowrap",
        borderLeft: `4px solid ${s.color}`,
      });
      labels.current[s.id] = div;
      const label = new CSS2DObject(div);
      label.position.set(s.x, s.shape === "tower" ? 12.5 : 8.5, s.z);
      scene.add(label);
      groups.current[s.id].push(label);
    }

    // marqueur de quete (losange dore qui flotte)
    const marker = new THREE.Group();
    const gem = mesh(new THREE.OctahedronGeometry(0.9, 0), std("#FACC15", { emissive: "#F59E0B", emissiveIntensity: 0.6 }));
    gem.scale.y = 1.6;
    marker.add(gem);
    scene.add(marker);
    questMarker.current = marker;

    // avatar
    const avatar = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.3, 10), std("#2563EB"), 0, 1.15, 0);
    const head = mesh(new THREE.SphereGeometry(0.45, 14, 10), std("#F5D0A9"), 0, 2.15, 0);
    const cap = mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.18, 14), std("#0F172A"), 0, 2.48, 0);
    const visor = mesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), std("#0F172A"), 0, 2.42, 0.4);
    const eyeMat = std("#0F172A");
    const eyes = [mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat, -0.16, 2.2, 0.4), mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat, 0.16, 2.2, 0.4)];
    const bag = mesh(new THREE.BoxGeometry(0.7, 0.8, 0.35), std("#F59E0B"), 0, 1.3, -0.55);
    const legs = [mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 6), std("#1E293B"), -0.22, 0.3, 0), mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 6), std("#1E293B"), 0.22, 0.3, 0)];
    avatar.add(body, head, cap, visor, bag, ...eyes, ...legs);
    avatar.position.set(player.x, 0, player.z);
    scene.add(avatar);
    const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.18 }));
    shadowBlob.rotation.x = -Math.PI / 2;
    scene.add(shadowBlob);

    // ─── vie de l'ile : nuages, oiseaux, fumee du volcan, bateau, habitants qui donnent des conseils ───
    const life = buildLife(scene, stations, points);

    // repere de destination
    const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: "#FACC15" }));
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.visible = false;
    scene.add(targetRing);

    // --- entrees clavier / souris ---
    const keys = new Set<string>();
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const MOVE_KEYS = ["z", "w", "q", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    const onKeyDown = (e: KeyboardEvent) => {
      if (typing(e) || pausedRef.current) return;
      const k = e.key.toLowerCase();
      if (MOVE_KEYS.includes(k)) {
        keys.add(k);
        player.target = null;
        e.preventDefault();
      }
      if ((k === "e" || k === "enter") && nearRef.current) {
        e.preventDefault();
        cb.current.onInteract();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let drag: { x: number; yaw: number; moved: boolean } | null = null;
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, yaw: player.cameraYaw, moved: false };
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      if (drag.moved) player.cameraYaw = drag.yaw - dx * 0.008;
    };
    const onUp = (e: PointerEvent) => {
      const wasClick = drag && !drag.moved;
      drag = null;
      if (!wasClick || pausedRef.current) return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      // clic sur un batiment : on marche jusqu'a son entree
      const hit = raycaster.intersectObjects(stationGroups, true)[0];
      if (hit) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.stationId) o = o.parent;
        const s = stations.find((st) => st.id === o?.userData.stationId);
        if (s) {
          const len = Math.hypot(s.x, s.z) || 1;
          player.target = { x: s.x - (s.x / len) * 6.2, z: s.z - (s.z / len) * 6.2 };
          return;
        }
      }
      const p = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(ground, p) && Math.hypot(p.x, p.z) < ISLAND_RADIUS - 1) {
        player.target = { x: p.x, z: p.z };
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.max(0.55, Math.min(1.6, zoom + e.deltaY * 0.001));
    };
    let zoom = 1;
    el.addEventListener("wheel", onWheel, { passive: false });

    // --- taille ---
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // --- boucle ---
    const clock = new THREE.Clock();
    let walk = 0;
    let stuck = 0;
    let lastFoot = false;
    let idleFrames = 0;
    let raf = 0;
    const camTarget = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // pendant une lecon ou une carte ouverte, le monde est fige : on le redessine rarement (economise le processeur)
      if (pausedRef.current && ++idleFrames % 20 !== 0) {
        clock.getDelta();
        return;
      }
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      // direction voulue
      let ix = 0;
      let iz = 0;
      if (!pausedRef.current) {
        if (keys.has("z") || keys.has("w") || keys.has("arrowup")) iz -= 1;
        if (keys.has("s") || keys.has("arrowdown")) iz += 1;
        if (keys.has("q") || keys.has("a") || keys.has("arrowleft")) ix -= 1;
        if (keys.has("d") || keys.has("arrowright")) ix += 1;
      } else {
        keys.clear();
      }
      let dir = new THREE.Vector2(0, 0);
      if (ix || iz) {
        // relatif a la camera
        const cos = Math.cos(player.cameraYaw);
        const sin = Math.sin(player.cameraYaw);
        dir.set(ix * cos + iz * sin, -ix * sin + iz * cos).normalize();
      } else if (player.target && !pausedRef.current) {
        const d = new THREE.Vector2(player.target.x - player.x, player.target.z - player.z);
        if (d.length() < 0.4) player.target = null;
        else {
          dir = d.normalize();
          // contourner les batiments sur le chemin au lieu de rester bloque contre eux
          for (const s of stations) {
            if (live.current.statuses[s.id] === "hidden") continue;
            const minD = s.shape === "volcano" ? 5.6 : 4.6;
            const v = new THREE.Vector2(s.x - player.x, s.z - player.z);
            const dist = v.length();
            if (dist < 0.001 || dist > minD + 3) continue;
            const along = dir.dot(v) / dist;
            const targetDist = Math.hypot(player.target.x - s.x, player.target.z - s.z);
            if (along < 0.15 || targetDist < minD) continue;
            const perp = new THREE.Vector2(-v.y, v.x).divideScalar(dist);
            if (perp.dot(dir) < 0) perp.negate();
            const push = 2 * (1 - Math.max(0, dist - minD) / 3);
            dir.add(perp.multiplyScalar(push)).normalize();
          }
        }
      }
      const speed = 11;
      player.moving = dir.lengthSq() > 0;
      if (player.moving) {
        let nx = player.x + dir.x * speed * dt;
        let nz = player.z + dir.y * speed * dt;
        // collisions : bord de l'ile et batiments
        const r = Math.hypot(nx, nz);
        if (r > ISLAND_RADIUS - 1.2) {
          nx = (nx / r) * (ISLAND_RADIUS - 1.2);
          nz = (nz / r) * (ISLAND_RADIUS - 1.2);
        }
        for (const s of stations) {
          if (live.current.statuses[s.id] === "hidden") continue;
          const minD = s.shape === "volcano" ? 5.6 : 4.6;
          const dx = nx - s.x;
          const dz = nz - s.z;
          const d = Math.hypot(dx, dz);
          if (d < minD && d > 0.0001) {
            nx = s.x + (dx / d) * minD;
            nz = s.z + (dz / d) * minD;
          }
        }
        if (player.target && !(ix || iz)) {
          const progressed = Math.hypot(nx - player.x, nz - player.z);
          stuck = progressed < speed * dt * 0.15 ? stuck + dt : 0;
          if (stuck > 0.8) {
            player.target = null;
            stuck = 0;
          }
        }
        player.x = nx;
        player.z = nz;
        const wanted = Math.atan2(dir.x, dir.y);
        let diff = wanted - player.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.heading += diff * Math.min(1, dt * 12);
        walk += dt * 12;
      } else {
        walk *= 0.9;
      }
      avatar.position.set(player.x, Math.abs(Math.sin(walk)) * 0.18, player.z);
      avatar.rotation.y = player.heading;
      legs[0].rotation.x = Math.sin(walk) * 0.6;
      legs[1].rotation.x = -Math.sin(walk) * 0.6;
      shadowBlob.position.set(player.x, 0.05, player.z);
      targetRing.visible = !!player.target;
      if (player.target) {
        targetRing.position.set(player.target.x, 0.07, player.target.z);
        targetRing.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
      }

      // station proche ?
      let near: string | null = null;
      let best = INTERACT_DISTANCE;
      for (const s of stations) {
        if (live.current.statuses[s.id] === "hidden") continue;
        const d = Math.hypot(player.x - s.x, player.z - s.z);
        if (d < best) {
          best = d;
          near = s.id;
        }
      }
      if (near !== nearRef.current) {
        nearRef.current = near;
        cb.current.onNear(near);
      }

      // animations
      for (const s of stations) {
        const ring = rings.current[s.id];
        const m = ring.material as THREE.MeshBasicMaterial;
        if (live.current.recommended.includes(s.id) && live.current.statuses[s.id] !== "hidden") {
          m.opacity = 0.55 + Math.sin(t * 5) * 0.35;
          ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
        } else {
          m.opacity = s.id === nearRef.current ? 0.85 : 0.35 + Math.sin(t * 2 + s.x) * 0.1;
          ring.scale.setScalar(1);
        }
      }
      if (questMarker.current && questMarker.current.visible) {
        gem.rotation.y = t * 2;
        gem.position.y = Math.sin(t * 3) * 0.4;
      }

      // pas : un son a chaque fois qu'un pied touche le sol
      const foot = Math.sin(walk) > 0;
      if (player.moving && foot !== lastFoot) cb.current.onStep?.();
      lastFoot = foot;

      const talked = life.update(t, dt, player, questMarker.current);
      if (talked) cb.current.onNpcTalk?.();

      // camera a la troisieme personne
      const dist = 20 * zoom;
      const height = 14 * zoom;
      const desired = new THREE.Vector3(player.x + Math.sin(player.cameraYaw) * dist, height, player.z + Math.cos(player.cameraYaw) * dist);
      camera.position.lerp(desired, 1 - Math.pow(0.002, dt));
      camTarget.lerp(new THREE.Vector3(player.x, 1.5, player.z), 1 - Math.pow(0.001, dt));
      camera.lookAt(camTarget);

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    camTarget.set(player.x, 1.5, player.z);
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
      host.removeChild(labelRenderer.domElement);
      accents.current = {};
      rings.current = {};
      labels.current = {};
    };
    // la scene est construite une seule fois ; les etats sont appliques par l'effet ci-dessous
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- couleurs, etiquettes et marqueur selon l'avancement ---
  useEffect(() => {
    for (const s of stations) {
      const st = statuses[s.id] ?? "locked";
      const reco = recommended.includes(s.id) && st !== "hidden";
      (groups.current[s.id] ?? []).forEach((o) => { o.visible = st !== "hidden"; });
      const accent = accents.current[s.id];
      if (accent) accent.color.set(st === "locked" ? LOCKED_COLOR : new THREE.Color(s.color));
      const ring = rings.current[s.id];
      if (ring) (ring.material as THREE.MeshBasicMaterial).color.set(reco ? "#EF4444" : st === "done" ? "#22C55E" : st === "locked" ? "#9CA3AF" : s.color);
      const div = labels.current[s.id];
      if (div) {
        div.textContent = `${reco ? "⚠ " : st === "done" ? "✓ " : st === "locked" ? "🔒 " : "★ "}${s.place}${reco ? " · conseillé" : ""}`;
        div.style.opacity = st === "locked" ? "0.75" : "1";
        div.style.background = reco ? "rgba(254,226,226,.95)" : "rgba(255,255,255,.92)";
      }
    }
    const q = stations.find((s) => s.id === questId);
    if (questMarker.current) {
      questMarker.current.visible = !!q;
      if (q) questMarker.current.position.set(q.x, q.shape === "tower" ? 15 : 11, q.z);
    }
  }, [stations, statuses, questId, recommended]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
