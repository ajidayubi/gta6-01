import * as THREE from 'three';

export function buildCity(scene) {
  const colliders = [];
  const roads = [];

  // Reusable materials & geometries for performance
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });
  const beachMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.9 });
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1e90ff, roughness: 0.3, metalness: 0.2 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.8 });
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });

  const buildingColors = [0xf5deb3, 0xe0a899, 0xb0e0e6, 0xf4a460, 0xfff8dc, 0xfaebd7, 0xdda0dd];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xfffacd, emissive: 0xffd700, emissiveIntensity: 0.6 });

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.7 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffae6 });

  // 1. Environment: Ground, Beach, Sea
  const groundGeo = new THREE.PlaneGeometry(600, 600);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.1, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const beachGeo = new THREE.PlaneGeometry(80, 600);
  const beach = new THREE.Mesh(beachGeo, beachMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-260, -0.05, 0);
  beach.receiveShadow = true;
  scene.add(beach);

  const seaGeo = new THREE.PlaneGeometry(800, 800);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-340, -0.2, 0);
  scene.add(sea);

  // 2. City Grid & Roads
  const gridSize = 5; // 5x5 blocks
  const blockSize = 80;
  const roadWidth = 14;
  const halfCity = (gridSize * blockSize) / 2;

  // Create grid streets
  for (let i = 0; i <= gridSize; i++) {
    const pos = -halfCity + i * blockSize;

    // North-South Road
    const nsRoadGeo = new THREE.PlaneGeometry(roadWidth, gridSize * blockSize);
    const nsRoad = new THREE.Mesh(nsRoadGeo, roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(pos, 0.01, 0);
    nsRoad.receiveShadow = true;
    scene.add(nsRoad);
    roads.push({ type: 'ns', x: pos, minZ: -halfCity, maxZ: halfCity });

    // Sidewalks NS
    const swGeo = new THREE.PlaneGeometry(2, gridSize * blockSize);
    const sw1 = new THREE.Mesh(swGeo, sidewalkMat);
    sw1.rotation.x = -Math.PI / 2;
    sw1.position.set(pos - roadWidth/2 - 1, 0.02, 0);
    scene.add(sw1);
    const sw2 = new THREE.Mesh(swGeo, sidewalkMat);
    sw2.rotation.x = -Math.PI / 2;
    sw2.position.set(pos + roadWidth/2 + 1, 0.02, 0);
    scene.add(sw2);

    // East-West Road
    const ewRoadGeo = new THREE.PlaneGeometry(gridSize * blockSize, roadWidth);
    const ewRoad = new THREE.Mesh(ewRoadGeo, roadMat);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.set(0, 0.01, pos);
    ewRoad.receiveShadow = true;
    scene.add(ewRoad);
    roads.push({ type: 'ew', z: pos, minX: -halfCity, maxX: halfCity });

    // Sidewalks EW
    const swEWGeo = new THREE.PlaneGeometry(gridSize * blockSize, 2);
    const swe1 = new THREE.Mesh(swEWGeo, sidewalkMat);
    swe1.rotation.x = -Math.PI / 2;
    swe1.position.set(0, 0.02, pos - roadWidth/2 - 1);
    scene.add(swe1);
    const swe2 = new THREE.Mesh(swEWGeo, sidewalkMat);
    swe2.rotation.x = -Math.PI / 2;
    swe2.position.set(0, 0.02, pos + roadWidth/2 + 1);
    scene.add(swe2);
  }

  // 3. Buildings (~60 buildings in blocks)
  let buildingCount = 0;
  const bSize = 56; // building footprint inside 80x80 block

  for (let gx = 0; gx < gridSize; gx++) {
    for (let gz = 0; gz < gridSize; gz++) {
      const blockCenterX = -halfCity + gx * blockSize + blockSize / 2;
      const blockCenterZ = -halfCity + gz * blockSize + blockSize / 2;

      // Subdivide block into 2x2 or 2x1 plots for variety
      const plots = [
        { x: blockCenterX - 15, z: blockCenterZ - 15, w: 26, d: 26 },
        { x: blockCenterX + 15, z: blockCenterZ - 15, w: 26, d: 26 },
        { x: blockCenterX - 15, z: blockCenterZ + 15, w: 26, d: 26 },
        { x: blockCenterX + 15, z: blockCenterZ + 15, w: 26, d: 26 },
      ];

      plots.forEach((plot, idx) => {
        // Skip some plots randomly or design density
        if ((gx + gz + idx) % 7 === 0) return;
        if (buildingCount >= 62) return;

        const height = 6 + Math.abs(Math.sin(gx * 12.9898 + gz * 78.233 + idx * 43.12)) * 34;
        const color = buildingColors[(gx + gz + idx) % buildingColors.length];
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

        const bGeo = new THREE.BoxGeometry(plot.w, height, plot.d);
        const building = new THREE.Mesh(bGeo, mat);
        building.position.set(plot.x, height / 2, plot.z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);

        // Roof accent
        const roofGeo = new THREE.BoxGeometry(plot.w * 0.9, 1, plot.d * 0.9);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(plot.x, height + 0.5, plot.z);
        roof.castShadow = true;
        scene.add(roof);

        // Window strips (emissive boxes inset)
        const winGeo = new THREE.BoxGeometry(plot.w * 0.95, height * 0.6, plot.d * 0.95);
        const winMesh = new THREE.Mesh(winGeo, windowMat);
        winMesh.position.set(plot.x, height / 2, plot.z);
        scene.add(winMesh);

        // Register collider
        colliders.push({
          minX: plot.x - plot.w / 2 - 1,
          maxX: plot.x + plot.w / 2 + 1,
          minZ: plot.z - plot.d / 2 - 1,
          maxZ: plot.z + plot.d / 2 + 1,
        });

        buildingCount++;

        // Add palm trees along block edges occasionally
        if (idx === 0 && (gx + gz) % 2 === 0) {
          createPalmTree(scene, plot.x - 18, plot.z - 18, trunkMat, frondMat);
        }
        // Add streetlight
        if (idx === 1 && (gx + gz) % 3 === 0) {
          createStreetLight(scene, plot.x, plot.z - 18, poleMat, lampMat);
        }
      });
    }
  }

  // 4. Lighting & Atmosphere
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.FogExp2(0xffeaa7, 0.003);

  const hemiLight = new THREE.HemisphereLight(0xfff8dc, 0x4682b4, 0.6);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
  dirLight.position.set(150, 250, 100);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 600;
  const d = 250;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  scene.add(dirLight);

  return { colliders, roads };
}

function createPalmTree(scene, x, z, trunkMat, frondMat) {
  const trunkGeo = new THREE.CylinderGeometry(0.6, 0.9, 12, 6);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, 6, z);
  trunk.castShadow = true;
  scene.add(trunk);

  const frondsGeo = new THREE.ConeGeometry(3.5, 4, 6);
  const fronds = new THREE.Mesh(frondsGeo, frondMat);
  fronds.position.set(x, 12.5, z);
  fronds.castShadow = true;
  scene.add(fronds);
}

function createStreetLight(scene, x, z, poleMat, lampMat) {
  const poleGeo = new THREE.CylinderGeometry(0.2, 0.3, 7, 6);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, 3.5, z);
  pole.castShadow = true;
  scene.add(pole);

  const lampGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(x, 7, z);
  scene.add(lamp);
}
