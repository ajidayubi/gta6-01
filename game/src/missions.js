import * as THREE from 'three';

export class MissionSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.currentIndex = 0;
    this.cash = 0;
    this.onMissionComplete = null;

    // Define 4 story missions for Rico in Sunset City
    this.missions = [
      {
        id: 'first_wheels',
        title: 'First Wheels',
        giver: 'Mara',
        briefing: "Hey Rico, welcome to Sunset City. Grab any set of wheels off the street and drive them over to my garage.",
        objective: "Steal any car and drive to Mara's garage",
        target: { x: 40, z: 40 },
        reward: 200,
        done: false
      },
      {
        id: 'sunset_delivery',
        title: 'Sunset Delivery',
        giver: 'Mara',
        briefing: "Good driving. Now take this package down to the pier before the dockworkers clock out.",
        objective: "Drive the package to the pier",
        target: { x: -180, z: 20 },
        reward: 350,
        stage: 'driving',
        done: false
      },
      {
        id: 'lose_the_heat',
        title: 'Lose the Heat',
        giver: 'Mara',
        briefing: "Cops are tailing you from the delivery! Shake them off and lie low until heat is zero.",
        objective: "Escape the police and lose the heat",
        target: { x: 0, z: 0 }, // no specific target location, tracked via wanted heat
        reward: 500,
        done: false
      },
      {
        id: 'the_big_score',
        title: 'The Big Score',
        giver: 'Mara',
        briefing: "Time for the big payday. Hit the downtown bank vault, then race back to my garage with the loot!",
        objective: "Stage A: Reach the bank vault",
        target: { x: -40, z: -40 },
        reward: 1000,
        stage: 'vault',
        done: false
      }
    ];

    // Create glowing 3D marker group
    this.markerGroup = new THREE.Group();
    
    // Tall emissive cylinder
    const cylGeo = new THREE.CylinderGeometry(1.5, 1.5, 12, 16, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    this.markerCyl = new THREE.Mesh(cylGeo, cylMat);
    this.markerCyl.position.y = 6;
    this.markerGroup.add(this.markerCyl);

    // Floating spinning ring
    const ringGeo = new THREE.TorusGeometry(2.2, 0.25, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    this.markerRing = new THREE.Mesh(ringGeo, ringMat);
    this.markerRing.rotation.x = Math.PI / 2;
    this.markerRing.position.y = 3;
    this.markerGroup.add(this.markerRing);

    this.scene.add(this.markerGroup);
    this.markerGroup.visible = false;
  }

  start() {
    this.currentIndex = 0;
    this._updateMarkerPosition();
  }

  current() {
    if (this.currentIndex >= this.missions.length) return null;
    return this.missions[this.currentIndex];
  }

  get markerPos() {
    const m = this.current();
    return m ? m.target : null;
  }

  _updateMarkerPosition() {
    const m = this.current();
    if (!m) {
      this.markerGroup.visible = false;
      return;
    }
    // If mission 3 (lose the heat), hide marker or center around player/city center
    if (m.id === 'lose_the_heat') {
      this.markerGroup.visible = false;
    } else {
      this.markerGroup.visible = true;
      this.markerGroup.position.set(m.target.x, 0, m.target.z);
    }
  }

  update(dt, playerPos, driving, wanted) {
    const m = this.current();
    if (!m) return null;

    // Animate marker bobbing & spinning
    if (this.markerGroup.visible) {
      const time = performance.now() * 0.003;
      this.markerRing.position.y = 3.0 + Math.sin(time) * 0.8;
      this.markerRing.rotation.z += dt * 1.5;
    }

    const targetVec = new THREE.Vector3(m.target.x, 0, m.target.z);

    if (m.id === 'first_wheels') {
      // Completes when player is driving any vehicle within 6 units of target
      if (driving) {
        const dist = driving.position.distanceTo(targetVec);
        if (dist <= 6.0) {
          return this._completeCurrent();
        }
      }
    } else if (m.id === 'sunset_delivery') {
      // Completes when driving within 6 units of pier target (on foot does not count)
      if (driving) {
        const dist = driving.position.distanceTo(targetVec);
        if (dist <= 6.0) {
          return this._completeCurrent();
        }
      }
    } else if (m.id === 'lose_the_heat') {
      // Set wanted heat to at least 45 at start if heat < 45
      if (wanted.heat < 45 && wanted.heat > 0) {
        // already active
      } else if (wanted.heat === 0 && m.startedHeat) {
        return this._completeCurrent();
      } else {
        wanted.addHeat(45);
        m.startedHeat = true;
      }
    } else if (m.id === 'the_big_score') {
      // Two-stage: stage A reach bank vault, stage B reach garage target
      if (m.stage === 'vault') {
        const dist = playerPos.distanceTo(targetVec);
        if (dist <= 6.0 || (driving && driving.position.distanceTo(targetVec) <= 6.0)) {
          // Advance to stage B (return to Mara's garage at { x: 40, z: 40 })
          m.stage = 'return';
          m.target = { x: 40, z: 40 };
          m.objective = "Stage B: Return to Mara's garage";
          this._updateMarkerPosition();
          return 'stage';
        }
      } else if (m.stage === 'return') {
        const dist = playerPos.distanceTo(targetVec);
        if (dist <= 6.0 || (driving && driving.position.distanceTo(targetVec) <= 6.0)) {
          return this._completeCurrent();
        }
      }
    }

    return null;
  }

  _completeCurrent() {
    const m = this.current();
    if (!m || m.done) return null;

    m.done = true;
    this.cash += m.reward;
    if (typeof this.onMissionComplete === 'function') {
      this.onMissionComplete(m);
    }

    this.currentIndex++;
    this._updateMarkerPosition();
    return 'complete';
  }
}
