import * as THREE from 'three';

export function buildCarMesh(color, style) {
  const group = new THREE.Group();

  // Materials
  const bodyMat = new THREE.MeshStandardMaterial({ color: color || 0x3b82f6, roughness: 0.5, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.9 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.2 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfffae6 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  let bodyGeo, cabinGeo, bodyY = 0.5, cabinY = 1.0;
  let hasSpoiler = false, hasSign = false, hasCargo = false;

  if (style === 'sport') {
    bodyGeo = new THREE.BoxGeometry(2.0, 0.45, 4.4);
    cabinGeo = new THREE.BoxGeometry(1.6, 0.4, 2.2);
    bodyY = 0.45;
    cabinY = 0.85;
    hasSpoiler = true;
  } else if (style === 'truck') {
    bodyGeo = new THREE.BoxGeometry(2.2, 0.6, 4.8);
    cabinGeo = new THREE.BoxGeometry(2.0, 0.6, 2.0);
    bodyY = 0.6;
    cabinY = 1.1;
    hasCargo = true;
  } else if (style === 'taxi') {
    bodyGeo = new THREE.BoxGeometry(2.1, 0.55, 4.6);
    cabinGeo = new THREE.BoxGeometry(1.8, 0.5, 2.4);
    bodyY = 0.55;
    cabinY = 1.05;
    hasSign = true;
  } else {
    // sedan
    bodyGeo = new THREE.BoxGeometry(2.0, 0.5, 4.5);
    cabinGeo = new THREE.BoxGeometry(1.7, 0.45, 2.3);
    bodyY = 0.5;
    cabinY = 1.0;
  }

  // Main Body
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = bodyY;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Cabin
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, cabinY, style === 'truck' ? -0.5 : 0.1);
  cabin.castShadow = true;
  group.add(cabin);

  // Style specific extras
  if (hasSpoiler) {
    const spoilerGeo = new THREE.BoxGeometry(1.9, 0.1, 0.6);
    const spoiler = new THREE.Mesh(spoilerGeo, bodyMat);
    spoiler.position.set(0, 1.1, -2.0);
    spoiler.castShadow = true;
    group.add(spoiler);

    const supGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
    const sup1 = new THREE.Mesh(supGeo, bodyMat);
    sup1.position.set(-0.8, 0.95, -2.0);
    group.add(sup1);
    const sup2 = new THREE.Mesh(supGeo, bodyMat);
    sup2.position.set(0.8, 0.95, -2.0);
    group.add(sup2);
  }

  if (hasSign) {
    const signGeo = new THREE.BoxGeometry(0.8, 0.25, 0.4);
    const signMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 1.45, 0.1);
    group.add(sign);
  }

  if (hasCargo) {
    const cargoGeo = new THREE.BoxGeometry(2.1, 1.1, 2.6);
    const cargo = new THREE.Mesh(cargoGeo, bodyMat);
    cargo.position.set(0, 1.2, 1.0);
    cargo.castShadow = true;
    group.add(cargo);
  }

  // Headlights & Taillights
  const lightGeo = new THREE.BoxGeometry(0.35, 0.2, 0.1);
  const headL = new THREE.Mesh(lightGeo, headMat);
  headL.position.set(-0.75, bodyY, -2.26);
  group.add(headL);

  const headR = new THREE.Mesh(lightGeo, headMat);
  headR.position.set(0.75, bodyY, -2.26);
  group.add(headR);

  const tailL = new THREE.Mesh(lightGeo, tailMat);
  tailL.position.set(-0.75, bodyY, 2.26);
  group.add(tailL);

  const tailR = new THREE.Mesh(lightGeo, tailMat);
  tailR.position.set(0.75, bodyY, 2.26);
  group.add(tailR);

  // 4 Wheels (cylinder wheels rotated to roll)
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);

  const wheels = [];
  const wheelPositions = [
    [-1.05, 0.4, 1.4],  // front left
    [1.05, 0.4, 1.4],   // front right
    [-1.05, 0.4, -1.4], // rear left
    [1.05, 0.4, -1.4],  // rear right
  ];

  wheelPositions.forEach((pos, idx) => {
    const wGroup = new THREE.Group();
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.castShadow = true;
    wGroup.add(wheel);

    const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wGroup.add(rim);

    wGroup.position.set(...pos);
    group.add(wGroup);
    wheels.push(wGroup);
  });

  group.userData.wheels = wheels;
  return group;
}

export class Vehicle {
  constructor(scene, x, z, angle, color, style) {
    this.style = style || 'sedan';
    this.color = color || 0x3b82f6;
    this.mesh = buildCarMesh(this.color, this.style);
    scene.add(this.mesh);

    this.position = new THREE.Vector3(x, 0, z);
    this.mesh.position.copy(this.position);

    this.heading = angle || 0;
    this.mesh.rotation.y = this.heading;

    this.speed = 0;
    this.steering = 0;
    this.parked = false;
    this.lights = false;

    // Physics parameters
    this.maxSpeed = this.style === 'sport' ? 34 : (this.style === 'truck' ? 24 : 28);
    this.acceleration = 14;
    this.braking = 22;
    this.drag = 3.5;
    this.rollingResistance = 2.0;
    this.radius = 1.8;
  }

  update(dt, input, city) {
    if (!dt || dt <= 0) return;

    // 1. Acceleration & Braking (W/S or Up/Down)
    let throttle = 0;
    if (input.forward) throttle += 1;
    if (input.back) throttle -= 1;

    if (throttle > 0) {
      this.speed += this.acceleration * throttle * dt;
    } else if (throttle < 0) {
      if (this.speed > 0.5) {
        this.speed -= this.braking * Math.abs(throttle) * dt;
      } else {
        this.speed -= (this.acceleration * 0.7) * Math.abs(throttle) * dt;
      }
    } else {
      // Natural drag & rolling resistance
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - (this.drag * this.speed + this.rollingResistance) * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + (this.drag * Math.abs(this.speed) + this.rollingResistance) * dt);
      }
    }

    // Clamp speed to max limits
    this.speed = Math.max(-this.maxSpeed * 0.4, Math.min(this.maxSpeed, this.speed));

    // 2. Steering (A/D or Left/Right), steering scales with speed
    let steerInput = 0;
    if (input.left) steerInput += 1;
    if (input.right) steerInput -= 1;

    if (steerInput !== 0) {
      const speedFactor = Math.min(1.0, Math.max(0.3, Math.abs(this.speed) / 10));
      const turnRate = 2.2 * speedFactor;
      this.steering = steerInput * turnRate;
      if (Math.abs(this.speed) > 0.5) {
        this.heading += this.steering * (this.speed > 0 ? 1 : -1) * dt;
      }
    } else {
      this.steering *= 0.8;
    }

    // 3. Position update based on heading and speed
    const forwardVec = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const nextX = this.position.x + forwardVec.x * this.speed * dt;
    const nextZ = this.position.z + forwardVec.z * this.speed * dt;

    // Clamp to city bounds (-95 .. 95)
    const bound = 95;
    this.position.x = Math.max(-bound, Math.min(bound, nextX));
    this.position.z = Math.max(-bound, Math.min(bound, nextZ));

    // 4. Collision AABB push-out against city.colliders
    if (city && city.colliders) {
      for (const box of city.colliders) {
        const closestX = Math.max(box.minX, Math.min(this.position.x, box.maxX));
        const closestZ = Math.max(box.minZ, Math.min(this.position.z, box.maxZ));

        const distX = this.position.x - closestX;
        const distZ = this.position.z - closestZ;
        const distance = Math.sqrt(distX * distX + distZ * distZ);

        if (distance < this.radius) {
          if (distance > 0.0001) {
            const overlap = this.radius - distance;
            this.position.x += (distX / distance) * overlap;
            this.position.z += (distZ / distance) * overlap;
            this.speed *= 0.3; // impact crash slow down
          } else {
            this.position.x += this.radius;
            this.speed = 0;
          }
        }
      }
    }

    // Sync mesh position & rotation
    this.mesh.position.set(this.position.x, 0, this.position.z);
    this.mesh.rotation.y = this.heading;

    // 5. Spin wheels and yaw front wheels with steering
    if (this.mesh.userData && this.mesh.userData.wheels) {
      const wheels = this.mesh.userData.wheels;
      const wheelSpin = this.speed * dt * 3.0;
      wheels.forEach((wGroup, idx) => {
        wGroup.children[0].rotation.x += wheelSpin; // spin wheel cylinder
        // Front wheels yaw (index 0 and 1)
        if (idx < 2) {
          wGroup.rotation.y = steerInput * 0.5;
        }
      });
    }
  }
}

export function spawnParkedCars(scene, city, count) {
  const cars = [];
  const styles = ['sedan', 'taxi', 'truck', 'sport'];
  const colors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x111827, 0xf9fafb];

  if (!city || !city.roads || city.roads.length === 0) return cars;

  for (let i = 0; i < count; i++) {
    // Pick a random road
    const road = city.roads[Math.floor(Math.random() * city.roads.length)];
    let x = 0, z = 0, angle = 0;

    if (road.type === 'ns') {
      x = road.x + (Math.random() > 0.5 ? 9 : -9); // offset to side sidewalk edge
      z = road.minZ + Math.random() * (road.maxZ - road.minZ);
      angle = Math.random() > 0.5 ? 0 : Math.PI;
    } else {
      x = road.minX + Math.random() * (road.maxX - road.minX);
      z = road.z + (Math.random() > 0.5 ? 9 : -9);
      angle = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }

    const style = styles[Math.floor(Math.random() * styles.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const vehicle = new Vehicle(scene, x, z, angle, color, style);
    vehicle.parked = true;
    vehicle.speed = 0;
    cars.push(vehicle);
  }

  return cars;
}
