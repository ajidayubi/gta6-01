import * as THREE from 'three';
import { buildCarMesh } from './vehicles.js';

export class WantedSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.heat = 0;
    this.level = 0;
    this.policeCars = [];
    this.policeOfficers = [];
    this.damageDealt = 0;
    this.shake = 0;
    this._lightTimer = 0;
    this._officerGeo = new THREE.BoxGeometry(0.8, 1.8, 0.6);
    this._officerMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 });
  }

  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    this._updateLevel();
  }

  _updateLevel() {
    const oldLevel = this.level;
    this.level = Math.min(5, Math.floor(this.heat / 20));
    if (this.level !== oldLevel && typeof this.onLevelChange === 'function') {
      this.onLevelChange(this.level);
    }
  }

  spawnPolice(targetCountCars, targetCountOfficers) {
    // Adjust police cars
    while (this.policeCars.length < targetCountCars) {
      if (!this.city || !this.city.roads || this.city.roads.length === 0) break;
      const road = this.city.roads[Math.floor(Math.random() * this.city.roads.length)];
      let x = 0, z = 0, angle = 0;
      if (road.type === 'ns') {
        x = road.x + (Math.random() > 0.5 ? 9 : -9);
        z = road.minZ + Math.random() * (road.maxZ - road.minZ);
        angle = Math.random() > 0.5 ? 0 : Math.PI;
      } else {
        x = road.minX + Math.random() * (road.maxX - road.minX);
        z = road.z + (Math.random() > 0.5 ? 9 : -9);
        angle = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
      }

      // Build police car using buildCarMesh with white body, black doors/hood via extra boxes
      const carGroup = buildCarMesh(0xffffff, 'sedan');
      
      // Black doors/hood accents
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
      const hoodBox = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.02, 1.5), doorMat);
      hoodBox.position.set(0, 0.28, 1.2);
      carGroup.add(hoodBox);

      const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 1.8), doorMat);
      leftDoor.position.set(-1.01, 0.3, 0);
      carGroup.add(leftDoor);

      const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 1.8), doorMat);
      rightDoor.position.set(1.01, 0.3, 0);
      carGroup.add(rightDoor);

      // Red/blue light bar (two small emissive boxes)
      const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const blueMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
      const lightBarGroup = new THREE.Group();
      
      const redBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.2), redMat);
      redBox.position.set(-0.2, 1.35, 0);
      lightBarGroup.add(redBox);

      const blueBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.2), blueMat);
      blueBox.position.set(0.2, 1.35, 0);
      lightBarGroup.add(blueBox);

      carGroup.add(lightBarGroup);
      this.scene.add(carGroup);

      this.policeCars.push({
        group: carGroup,
        position: new THREE.Vector3(x, 0, z),
        heading: angle,
        speed: 0,
        redBox,
        blueBox,
        lightState: 0
      });
    }

    // Adjust police officers on foot
    while (this.policeOfficers.length < targetCountOfficers) {
      if (!this.city || !this.city.roads || this.city.roads.length === 0) break;
      const road = this.city.roads[Math.floor(Math.random() * this.city.roads.length)];
      let x = road.type === 'ns' ? road.x + 12 : road.minX + Math.random() * (road.maxX - road.minX);
      let z = road.type === 'ns' ? road.minZ + Math.random() * (road.maxZ - road.minZ) : road.z + 12;

      const mesh = new THREE.Mesh(this._officerGeo, this._officerMat);
      mesh.position.set(x, 0.9, z);
      mesh.castShadow = true;
      this.scene.add(mesh);

      this.policeOfficers.push({
        mesh,
        position: new THREE.Vector3(x, 0, z)
      });
    }

    // Despawn excess
    while (this.policeCars.length > targetCountCars) {
      const p = this.policeCars.pop();
      this.scene.remove(p.group);
    }
    while (this.policeOfficers.length > targetCountOfficers) {
      const o = this.policeOfficers.pop();
      this.scene.remove(o.mesh);
    }
  }

  losePolice() {
    // If heat is 0 and no police car within 30 units for 5s
    // For simplicity, fade/despawn police cars when heat is 0
    if (this.heat <= 0 && this.policeCars.length > 0) {
      for (const p of this.policeCars) {
        this.scene.remove(p.group);
      }
      for (const o of this.policeOfficers) {
        this.scene.remove(o.mesh);
      }
      this.policeCars = [];
      this.policeOfficers = [];
    }
  }

  update(dt, playerPos, playerOnFoot, drivenVehicle) {
    // Decay heat if out of sight / not committing crimes (when heat > 0)
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - 2 * dt);
      this._updateLevel();
    }

    // Determine counts based on wanted level
    const counts = [
      { cars: 0, officers: 0 },
      { cars: 1, officers: 0 },
      { cars: 2, officers: 0 },
      { cars: 3, officers: 1 },
      { cars: 4, officers: 2 },
      { cars: 5, officers: 3 }
    ];
    const target = counts[this.level] || counts[0];

    if (this.level > 0 || this.policeCars.length > 0) {
      this.spawnPolice(target.cars, target.officers);
    }

    // Flashing light bars
    this._lightTimer += dt * 8;
    const flash = Math.floor(this._lightTimer) % 2 === 0;

    // Decay camera shake
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 5);
    }

    const targetPos = playerOnFoot ? playerPos : (drivenVehicle ? drivenVehicle.position : playerPos);

    // Update police cars
    for (const p of this.policeCars) {
      if (p.redBox && p.blueBox) {
        p.redBox.visible = flash;
        p.blueBox.visible = !flash;
      }

      // Steer toward targetPos
      const dir = new THREE.Vector3().subVectors(targetPos, p.position);
      dir.y = 0;
      const distToPlayer = dir.length();
      if (distToPlayer > 0.5) {
        dir.normalize();
        const targetAngle = Math.atan2(dir.x, dir.z);
        // smooth rotate heading
        let angleDiff = targetAngle - p.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        p.heading += angleDiff * Math.min(1, dt * 3);
      }

      const maxSpeed = 24 + this.level * 2;
      if (distToPlayer > 4.0) {
        p.speed = Math.min(maxSpeed, p.speed + 15 * dt);
      } else {
        p.speed = Math.max(5, p.speed - 10 * dt);
      }

      p.position.x += Math.sin(p.heading) * p.speed * dt;
      p.position.z += Math.cos(p.heading) * p.speed * dt;

      p.group.position.copy(p.position);
      p.group.rotation.y = p.heading;

      // Ram check
      if (distToPlayer < 2.5) {
        this.shake = 0.5;
        this.addHeat(2); // ongoing combat heat
      }
    }

    // Update police officers on foot
    for (const o of this.policeOfficers) {
      const dir = new THREE.Vector3().subVectors(playerPos, o.position);
      dir.y = 0;
      const dist = dir.length();
      if (dist > 1.0) {
        dir.normalize();
        o.position.addScaledVector(dir, 5 * dt);
        o.mesh.position.copy(o.position);
        o.mesh.position.y = 0.9;
      }

      if (playerOnFoot && dist < 1.8) {
        this.damageDealt = (this.damageDealt || 0) + 10 * dt;
      }
    }

    if (this.heat === 0) {
      this.losePolice();
    }
  }
}
