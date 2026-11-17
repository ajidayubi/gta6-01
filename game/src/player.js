import * as THREE from 'three';

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Position and physics properties
    this.position = new THREE.Vector3(0, 0, 10);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.speed = 6.0;
    this.runMultiplier = 1.8;
    this.jumpForce = 7.5;
    this.gravity = 20.0;
    this.radius = 0.6;

    // Camera orbit parameters
    this.cameraYaw = 0;
    this.cameraPitch = 0.2; // slight downward angle
    this.cameraDist = 7.0;
    this.cameraHeight = 3.0;

    // Animation state
    this.distanceWalked = 0;

    // Build Character Mesh (torso, head, two arms, two legs)
    // Materials: jacket (dark blue/teal), jeans (dark blue), skin tone (peach)
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.6 });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.4);
    this.torso = new THREE.Mesh(torsoGeo, jacketMat);
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.8;
    this.head.castShadow = true;
    this.group.add(this.head);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.22, 0.75, 0.22);
    
    this.leftArm = new THREE.Mesh(armGeo, jacketMat);
    this.leftArm.position.set(-0.48, 1.15, 0);
    this.leftArm.castShadow = true;
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, jacketMat);
    this.rightArm.position.set(0.48, 1.15, 0);
    this.rightArm.castShadow = true;
    this.group.add(this.rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.28, 0.85, 0.28);

    this.leftLeg = new THREE.Mesh(legGeo, jeansMat);
    this.leftLeg.position.set(-0.2, 0.425, 0);
    this.leftLeg.castShadow = true;
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, jeansMat);
    this.rightLeg.position.set(0.2, 0.425, 0);
    this.rightLeg.castShadow = true;
    this.group.add(this.rightLeg);
  }

  update(dt, input, city, camera) {
    if (!dt || dt <= 0) return;

    // 1. Handle camera yaw & pitch from drag deltas
    if (input.dragDX) {
      this.cameraYaw -= input.dragDX * 0.005;
    }
    if (input.dragDY) {
      this.cameraPitch = Math.max(-0.2, Math.min(1.2, this.cameraPitch + input.dragDY * 0.005));
    }

    // 2. Determine movement direction relative to camera yaw
    const moveDir = new THREE.Vector3();
    let moveZ = 0;
    let moveX = 0;

    if (input.forward) moveZ -= 1;
    if (input.back) moveZ += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    if (moveZ !== 0 || moveX !== 0) {
      const inputVector = new THREE.Vector3(moveX, 0, moveZ).normalize();
      
      // Rotate input vector by camera yaw
      inputVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
      moveDir.copy(inputVector);

      const currentSpeed = this.speed * (input.run ? this.runMultiplier : 1.0);
      this.velocity.x = moveDir.x * currentSpeed;
      this.velocity.z = moveDir.z * currentSpeed;

      // Rotate character model to face movement direction smoothly
      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetRotation - this.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, dt * 12);

      // Accumulate distance for walk animation
      const distStep = currentSpeed * dt;
      this.distanceWalked += distStep;
    } else {
      this.velocity.x *= Math.max(0, 1 - dt * 10);
      this.velocity.z *= Math.max(0, 1 - dt * 10);
    }

    // 3. Jump & Gravity
    if (input.jump && this.position.y <= 0.01) {
      this.velocity.y = this.jumpForce;
    }

    this.velocity.y -= this.gravity * dt;
    this.position.y += this.velocity.y * dt;

    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.y = 0;
    }

    // 4. Update horizontal position and apply AABB colliders + city bounds
    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;

    // City bounds clamp (-95 .. 95)
    const bound = 95;
    this.position.x = Math.max(-bound, Math.min(bound, nextX));
    this.position.z = Math.max(-bound, Math.min(bound, nextZ));

    // Push out of building colliders (AABB push-out, player radius 0.6)
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
          } else {
            // Fallback pushout if exactly centered
            this.position.x += this.radius;
          }
        }
      }
    }

    // Update group position in Three.js world
    this.group.position.set(this.position.x, this.position.y, this.position.z);

    // 5. Walk animation: swing arms & legs with sin of distance travelled
    const isMoving = (Math.abs(this.velocity.x) > 0.2 || Math.abs(this.velocity.z) > 0.2) && this.position.y <= 0.05;
    if (isMoving) {
      const swing = Math.sin(this.distanceWalked * 5.0) * 0.6;
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = -swing;
      this.leftLeg.rotation.x = -swing;
      this.rightLeg.rotation.x = swing;
    } else {
      // Smoothly return limbs to rest
      this.leftArm.rotation.x *= 0.8;
      this.rightArm.rotation.x *= 0.8;
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
    }

    // 6. Smooth camera orbit update
    if (camera) {
      const targetCamX = this.position.x - Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDist;
      const targetCamY = this.position.y + this.cameraHeight + Math.sin(this.cameraPitch) * this.cameraDist;
      const targetCamZ = this.position.z - Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDist;

      camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 10);
      camera.position.y += (targetCamY - camera.position.y) * Math.min(1, dt * 10);
      camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, dt * 10);

      const lookTarget = new THREE.Vector3(this.position.x, this.position.y + 1.2, this.position.z);
      camera.lookAt(lookTarget);
    }
  }
}
