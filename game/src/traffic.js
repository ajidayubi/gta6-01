import * as THREE from 'three';
import { buildCarMesh } from './vehicles.js';

export class TrafficSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.pedestrians = [];

    this.initCars();
    this.initPedestrians();
  }

  initCars() {
    // 8 traffic cars driving rectangular loops along road grid
    const colors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0xf9fafb, 0x1f2937];
    const styles = ['sedan', 'taxi', 'sport', 'truck'];

    // Define 4 rectangular loop routes across the city road grid (-100 to 100)
    // Each route is an array of 4 corners [x, z] forming a closed rectangular path
    const routes = [
      [[-80, -80], [80, -80], [80, 80], [-80, 80]],
      [[-40, -40], [40, -40], [40, 40], [-40, 40]],
      [[-80, -40], [-40, -40], [-40, 80], [-80, 80]],
      [[40, -80], [80, -80], [80, 40], [40, 40]]
    ];

    for (let i = 0; i < 8; i++) {
      const route = routes[i % routes.length];
      const color = colors[i % colors.length];
      const style = styles[i % styles.length];

      const mesh = buildCarMesh(color, style);
      this.scene.add(mesh);

      // Start at random point along route segment 0
      const progress = Math.random() * route.length;
      const pos = this.getPointOnRoute(route, progress);

      this.cars.push({
        mesh,
        route,
        progress, // 0 to route.length
        speed: 8 + Math.random() * 4, // 8 - 12 units/s
        targetSpeed: 8 + Math.random() * 4,
        position: new THREE.Vector3(pos.x, 0, pos.z),
        heading: 0,
        radius: 2.0
      });
    }
  }

  getPointOnRoute(route, progress) {
    const segIdx = Math.floor(progress) % route.length;
    const nextIdx = (segIdx + 1) % route.length;
    const t = progress - Math.floor(progress);

    const p1 = route[segIdx];
    const p2 = route[nextIdx];

    const x = p1[0] + (p2[0] - p1[0]) * t;
    const z = p1[1] + (p2[1] - p1[1]) * t;

    // Calculate heading angle towards p2
    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const heading = Math.atan2(dx, dz);

    return { x, z, heading };
  }

  initPedestrians() {
    // 14 pedestrians walking along sidewalks
    // Sidewalks are located near roads (ns roads at x = -100, -50, 0, 50, 100 ± offset)
    const shirtColors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xff69b4, 0xffffff, 0x00ffff];
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });

    for (let i = 0; i < 14; i++) {
      const group = new THREE.Group();

      const shirtColor = shirtColors[i % shirtColors.length];
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });

      // Body / Torso
      const torsoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
      const torso = new THREE.Mesh(torsoGeo, shirtMat);
      torso.position.y = 1.0;
      torso.castShadow = true;
      group.add(torso);

      // Head
      const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 1.5;
      head.castShadow = true;
      group.add(head);

      // Limbs for walk animation
      const limbGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
      const leftLeg = new THREE.Mesh(limbGeo, pantsMat);
      leftLeg.position.set(-0.12, 0.4, 0);
      group.add(leftLeg);

      const rightLeg = new THREE.Mesh(limbGeo, pantsMat);
      rightLeg.position.set(0.12, 0.4, 0);
      group.add(rightLeg);

      this.scene.add(group);

      // Pick sidewalk path segment (NS or EW)
      const isNS = i % 2 === 0;
      const roadCoord = (-100 + (i * 35) % 200);
      const sidewalkOffset = (i % 3 === 0) ? 9 : -9;

      let startX, startZ, endX, endZ;
      if (isNS) {
        startX = roadCoord + sidewalkOffset;
        startZ = -90;
        endX = startX;
        endZ = 90;
      } else {
        startX = -90;
        startZ = roadCoord + sidewalkOffset;
        endX = 90;
        endZ = startZ;
      }

      this.pedestrians.push({
        group,
        leftLeg,
        rightLeg,
        startX,
        startZ,
        endX,
        endZ,
        progress: Math.random(), // 0 to 1 along segment
        speed: 1.2 + Math.random() * 0.8, // 1.2 - 2 units/s
        direction: 1, // 1 forward, -1 backward
        sidestep: 0, // offset when player is near
        walkPhase: Math.random() * Math.PI * 2
      });
    }
  }

  update(dt, playerPos, drivenVehicle) {
    if (!dt || dt <= 0) return;

    // 1. Update Traffic Cars
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];

      // Check distance to car directly ahead on same route to slow/stop
      let obstacleAhead = false;
      for (let j = 0; j < this.cars.length; j++) {
        if (i === j) continue;
        const other = this.cars[j];
        if (car.route === other.route) {
          // Calculate distance along progress
          let diff = other.progress - car.progress;
          if (diff < 0) diff += car.route.length;
          if (diff > 0 && diff < 1.5) {
            obstacleAhead = true;
            break;
          }
        }
      }

      // Slow near corners (check fractional progress near integers)
      const frac = car.progress - Math.floor(car.progress);
      const nearCorner = (frac < 0.2 || frac > 0.8);

      let targetSpd = nearCorner ? 4 : (car.targetSpeed || 10);
      if (obstacleAhead) targetSpd = 0;

      // Smooth speed interpolation
      car.speed += (targetSpd - car.speed) * Math.min(1, dt * 4);

      // Advance progress
      const segmentLength = 160; // approximate block distance
      const progressDelta = (car.speed * dt) / segmentLength;
      car.progress = (car.progress + progressDelta) % car.route.length;

      // Get new position and heading
      const pt = this.getPointOnRoute(car.route, car.progress);
      car.position.set(pt.x, 0, pt.z);
      car.heading = pt.heading;

      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;

      // Spin wheels
      if (car.mesh.userData && car.mesh.userData.wheels) {
        const wheelSpin = car.speed * dt * 3.0;
        car.mesh.userData.wheels.forEach(w => {
          w.children[0].rotation.x += wheelSpin;
        });
      }
    }

    // 2. Update Pedestrians
    const activePos = drivenVehicle ? drivenVehicle.position : playerPos;

    for (const ped of this.pedestrians) {
      // Check proximity to player/driven car (< 2.5 units) for sidestep
      const currentX = ped.startX + (ped.endX - ped.startX) * ped.progress;
      const currentZ = ped.startZ + (ped.endZ - ped.startZ) * ped.progress;
      const distToPlayer = activePos ? Math.hypot(currentX - activePos.x, currentZ - activePos.z) : 999;

      let targetSidestep = 0;
      if (distToPlayer < 2.5 && distToPlayer > 0.001) {
        // Step aside 1 unit away from player
        targetSidestep = 1.0;
      }
      ped.sidestep += (targetSidestep - ped.sidestep) * Math.min(1, dt * 6);

      // Walk back and forth along segment
      const segDist = Math.hypot(ped.endX - ped.startX, ped.endZ - ped.startZ);
      const stepDelta = (ped.speed * dt / segDist) * ped.direction;
      ped.progress += stepDelta;

      if (ped.progress >= 1.0) {
        ped.progress = 1.0;
        ped.direction = -1;
      } else if (ped.progress <= 0.0) {
        ped.progress = 0.0;
        ped.direction = 1;
      }

      // Compute actual position with sidestep offset perpendicular to walk direction
      const dx = ped.endX - ped.startX;
      const dz = ped.endZ - ped.startZ;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const px = ped.startX + dx * ped.progress + nx * ped.sidestep;
      const pz = ped.startZ + dz * ped.progress + nz * ped.sidestep;

      ped.group.position.set(px, 0, pz);

      // Face walking direction
      const angle = Math.atan2(dx * ped.direction, dz * ped.direction);
      ped.group.rotation.y = angle;

      // Leg-swing walk animation
      ped.walkPhase += dt * ped.speed * 4;
      const swing = Math.sin(ped.walkPhase) * 0.4;
      if (ped.leftLeg && ped.rightLeg) {
        ped.leftLeg.rotation.x = swing;
        ped.rightLeg.rotation.x = -swing;
      }
    }
  }
}
