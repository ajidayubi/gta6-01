import * as THREE from 'three';

export class CombatSystem {
  constructor(scene, city, player) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.health = 100;
    this.bullets = [];
    this.thugs = [];
    this.kills = 0;
    this.loot = 0;
    this.hurtFlash = false;
    this._lastShotTime = 0;
    this._pedestriansRef = [];
    this._officersRef = [];
    this._wantedRef = null;

    // Create muzzle flash light / mesh holder
    this.muzzleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0 })
    );
    this.scene.add(this.muzzleMesh);
    this._muzzleTimer = 0;
  }

  setWanted(wanted) {
    this._wantedRef = wanted;
  }

  setTargets(pedestrians, officers) {
    this._pedestriansRef = pedestrians || [];
    this._officersRef = officers || [];
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = true;
    setTimeout(() => { this.hurtFlash = false; }, 200);
  }

  reset() {
    this.health = 100;
    this.kills = 0;
    this.loot = 0;
    this.hurtFlash = false;
    // Remove bullets and thugs
    for (const b of this.bullets) {
      if (b.mesh) this.scene.remove(b.mesh);
      if (b.tracer) this.scene.remove(b.tracer);
    }
    this.bullets = [];
    for (const t of this.thugs) {
      if (t.mesh) this.scene.remove(t.mesh);
    }
    this.thugs = [];
  }

  punch() {
    const pPos = this.player.position;
    // Player facing direction in XZ plane
    const yaw = this.player.cameraYaw || 0;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();

    // Check pedestrians, officers, and thugs
    const checkTargets = [
      ...this._pedestriansRef,
      ...this._officersRef,
      ...this.thugs
    ];

    for (const target of checkTargets) {
      if (!target || target.dead || target.health <= 0) continue;
      const tPos = target.position || target.mesh?.position;
      if (!tPos) continue;

      const toTarget = new THREE.Vector3().subVectors(tPos, pPos);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist <= 2.2) {
        toTarget.normalize();
        const dot = forward.dot(toTarget);
        if (dot > 0.3) { // in front arc
          // Deal damage
          if (target.health !== undefined) {
            target.health -= 25;
          } else {
            target.health = 25; // default fallback if health property missing
          }

          // Knockback
          tPos.addScaledVector(toTarget, 2.0);

          // Check if target died from punch
          if (target.health <= 0 && !target.dead) {
            target.dead = true;
            this.kills++;
            if (target.isThug) {
              this.loot += 50;
            } else if (this._wantedRef && (this._pedestriansRef.includes(target) || this._officersRef.includes(target))) {
              this._wantedRef.addHeat(30);
            }
          }
        }
      }
    }
  }

  shoot() {
    const now = performance.now();
    if (now - this._lastShotTime < 333) return; // at most 3 shots/s
    this._lastShotTime = now;

    const pPos = this.player.position.clone();
    pPos.y += 1.2; // chest level

    // Calculate aim direction from camera yaw & pitch
    const yaw = this.player.cameraYaw || 0;
    const pitch = this.player.cameraPitch || 0;
    const dir = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    // Bullet mesh (small glowing sphere)
    const bulletGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    mesh.position.copy(pPos);
    this.scene.add(mesh);

    // Tracer line
    const tracerGeo = new THREE.BufferGeometry().setFromPoints([pPos.clone(), pPos.clone().addScaledVector(dir, 1.5)]);
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
    const tracer = new THREE.Line(tracerGeo, tracerMat);
    this.scene.add(tracer);

    this.bullets.push({
      pos: pPos,
      dir: dir,
      distTravelled: 0,
      maxRange: 60,
      speed: 60,
      mesh: mesh,
      tracer: tracer
    });

    // Muzzle flash at chest/gun
    this.muzzleMesh.position.copy(pPos).addScaledVector(dir, 0.4);
    this.muzzleMesh.material.opacity = 1.0;
    this._muzzleTimer = 0.08;
  }

  spawnThugs(n, nearPos) {
    const thugGeo = new THREE.BoxGeometry(0.6, 1.7, 0.4);
    const thugMat = new THREE.MeshLambertMaterial({ color: 0x551111 });

    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 6;
      const spawnPos = new THREE.Vector3(
        nearPos.x + Math.cos(angle) * dist,
        nearPos.y,
        nearPos.z + Math.sin(angle) * dist
      );

      const mesh = new THREE.Mesh(thugGeo, thugMat);
      mesh.position.copy(spawnPos);
      mesh.castShadow = true;
      this.scene.add(mesh);

      this.thugs.push({
        mesh: mesh,
        position: mesh.position,
        health: 50,
        maxHealth: 50,
        dead: false,
        fadeTimer: 0,
        punchCooldown: 0,
        isThug: true
      });
    }
  }

  update(dt, targets) {
    if (targets) {
      if (targets.pedestrians) this._pedestriansRef = targets.pedestrians;
      if (targets.officers) this._officersRef = targets.officers;
    }

    // Muzzle flash timer
    if (this._muzzleTimer > 0) {
      this._muzzleTimer -= dt;
      if (this._muzzleTimer <= 0) {
        this.muzzleMesh.material.opacity = 0;
      }
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const step = b.speed * dt;
      b.pos.addScaledVector(b.dir, step);
      b.distTravelled += step;

      b.mesh.position.copy(b.pos);
      // update tracer
      const startPos = b.pos.clone().subScaledVector(b.dir, 1.5);
      const points = [startPos, b.pos];
      b.tracer.geometry.setFromPoints(points);

      // Check hits on all potential targets (pedestrians, officers, thugs)
      let hit = false;
      const allTargets = [
        ...this._pedestriansRef,
        ...this._officersRef,
        ...this.thugs
      ];

      for (const t of allTargets) {
        if (!t || t.dead || t.health <= 0) continue;
        const tPos = (t.position || t.mesh?.position);
        if (!tPos) continue;

        // Target chest is roughly tPos + (0, 1.0, 0)
        const chestPos = tPos.clone ? tPos.clone().add(new THREE.Vector3(0, 1.0, 0)) : new THREE.Vector3(tPos.x, tPos.y + 1.0, tPos.z);
        if (b.pos.distanceTo(chestPos) < 1.2) {
          hit = true;
          t.health -= 34;

          if (t.health <= 0 && !t.dead) {
            t.dead = true;
            this.kills++;
            if (t.isThug) {
              this.loot += 50;
            } else if (this._wantedRef && (this._pedestriansRef.includes(t) || this._officersRef.includes(t))) {
              this._wantedRef.addHeat(30);
            }
          }
          break;
        }
      }

      if (hit || b.distTravelled >= b.maxRange) {
        this.scene.remove(b.mesh);
        this.scene.remove(b.tracer);
        b.mesh.geometry.dispose();
        b.tracer.geometry.dispose();
        this.bullets.splice(i, 1);
      }
    }

    // Update thugs AI & death fade
    const pPos = this.player.position;
    for (let i = this.thugs.length - 1; i >= 0; i--) {
      const thug = this.thugs[i];
      if (thug.dead) {
        // Rotate to lying flat
        if (thug.mesh.rotation.x > -Math.PI / 2) {
          thug.mesh.rotation.x -= dt * 5;
          thug.mesh.position.y -= dt * 0.5;
        }
        thug.fadeTimer += dt;
        if (thug.fadeTimer >= 3.0) {
          this.scene.remove(thug.mesh);
          thug.mesh.geometry.dispose();
          this.thugs.splice(i, 1);
        }
        continue;
      }

      // Move toward player
      const toPlayer = new THREE.Vector3().subVectors(pPos, thug.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      if (dist > 1.8 && dist < 30) {
        toPlayer.normalize();
        thug.position.addScaledVector(toPlayer, 3.5 * dt);
        thug.mesh.lookAt(pPos.x, thug.position.y, pPos.z);
      } else if (dist <= 1.8) {
        // Punch player
        thug.punchCooldown -= dt;
        if (thug.punchCooldown <= 0) {
          thug.punchCooldown = 1.0;
          this.takeDamage(8);
        }
      }

      // Check if pedestrian / officer died naturally or from elsewhere
      if (thug.health <= 0 && !thug.dead) {
        thug.dead = true;
        this.kills++;
        this.loot += 50;
      }
    }

    // Check pedestrians and officers dead status for rotation / fadeout
    for (const list of [this._pedestriansRef, this._officersRef]) {
      for (const ent of list) {
        if (ent && ent.health <= 0 && !ent.dead) {
          ent.dead = true;
          this.kills++;
          if (this._wantedRef) this._wantedRef.addHeat(30);
        }
        if (ent && ent.dead && ent.mesh) {
          if (ent.mesh.rotation.x > -Math.PI / 2) {
            ent.mesh.rotation.x -= dt * 5;
            ent.mesh.position.y = Math.max(0, ent.mesh.position.y - dt * 0.5);
          }
        }
      }
    }
  }
}
