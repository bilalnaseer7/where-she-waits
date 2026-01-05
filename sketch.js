// built this game in phases:
// 1 - basic house layout, movement, flashlight
// 2 - keys, clues, pickups
// 3 - menus and UI
// 4 - locked door and escape mechanics
// 5 - enemy AI (patrol, chase, line of sight)
// 6 - bigger map, sounds, 3D models, traps
// 7 - two keys, random spawns, hiding spots, enemy speeds up
// 8 - bronze key room, more traps, enemy checks hiding spots

let world;
const MOVE_STEP = 0.08;
const HOUSE_HALF_X = 14;
const HOUSE_HALF_Z = 18;
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.3;

// three keys total - bronze unlocks the locked room, gold and silver are inside/around the map
let bronzeKey;
let goldKey;
let silverKey;
let playerHasBronzeKey = false;
let playerHasGoldKey = false;
let playerHasSilverKey = false;
let showClueMessage = false;
let clueMessage = "";

// spawn system to make sure keys/traps don't spawn inside furniture or each other

let spawnedPositions = [];
const MIN_SPAWN_DISTANCE = 3;
const MIN_CLOSET_DISTANCE = 6;

function isValidSpawnPosition(x, z, minDist) {
  for (let i = 0; i < spawnedPositions.length; i++) {
    let pos = spawnedPositions[i];
    let distance = Math.sqrt((x - pos.x) * (x - pos.x) + (z - pos.z) * (z - pos.z));
    if (distance < minDist) {
      return false;
    }
  }
  return true;
}

function registerSpawnPosition(x, z) {
  spawnedPositions.push({ x: x, z: z });
}

function clearSpawnPositions() {
  spawnedPositions = [];
}

// mark all furniture positions so keys don't spawn inside them
function registerFurniturePositions() {
  registerSpawnPosition(-10, 12);  // table 1
  registerSpawnPosition(0, 12);     // table 2
  registerSpawnPosition(10, 12);   // shelf
  registerSpawnPosition(-10, 0);   // crate 1
  registerSpawnPosition(10, -6);   // crate 2
  registerSpawnPosition(2, 0);     // cabinet
  registerSpawnPosition(-12, -14); // dresser in locked room
  registerSpawnPosition(10, -14);  // barrel
  registerSpawnPosition(-2, 2);    // debris pile
}

// where keys can spawn - only in areas the player can actually reach
const keySpawnLocations = [
  // front area (always accessible)
  { x: -10, z: 12 },
  { x: -10, z: 15 },
  { x: 0, z: 12 },
  { x: 0, z: 15 },
  { x: 10, z: 12 },
  { x: 10, z: 15 },
  // middle area - center corridor only (between walls)
  { x: 0, z: 3 },
  { x: 0, z: 0 },
  { x: -2, z: 3 },
  { x: 2, z: 3 },
  // back right area (left side is the locked room)
  { x: 8, z: -5 },
  { x: 10, z: -8 }
];

// where traps can spawn
const trapSpawnLocations = [
  { x: -10, z: 14 },
  { x: 10, z: 14 },
  { x: -10, z: 10 },
  { x: 10, z: 10 },
  { x: 0, z: 2 },
  { x: 8, z: -4 },
  { x: 10, z: -6 },
  { x: 2, z: 0 }
];

// locked room door stuff
let lockedRoomDoor;
let lockedRoomDoorCollider;
let lockedRoomOpen = false;
const LOCKED_ROOM_DOOR_X = -9.5;
const LOCKED_ROOM_DOOR_Z = -10;

// where closets can spawn (against walls, player can hide in them)
const closetSpawnLocations = [
  // front area - against walls
  { x: -12, z: 15, rotY: 90 },
  { x: -12, z: 10, rotY: 90 },
  { x: 12, z: 15, rotY: -90 },
  { x: 12, z: 10, rotY: -90 },
  // middle area
  { x: -3, z: 3, rotY: 0 },
  { x: 3, z: 3, rotY: 180 },
  // back right area
  { x: 12, z: -5, rotY: -90 },
  { x: 12, z: -10, rotY: -90 },
  { x: 8, z: -15, rotY: 0 }
];

// clue notes (3 of them, fixed positions)
let clueNote1;
let clueNote2;
let clueNote3;
let clueNote1Collider;
let clueNote2Collider;
let clueNote3Collider;
let clueNote1Read = false;
let clueNote2Read = false;
let clueNote3Read = false;

// trap stuff - player can pick up 2 traps and drop them
let trapPickup1;
let trapPickup2;
let playerTrapCount = 0;
let droppedTrap = null;
let droppedTrapCollider = null;
let enemyTrapped = false;
let enemyTrapTimer = 0;
const TRAP_FREEZE_TIME = 300;

// hiding spots (closets)
let hidingSpot1;
let hidingSpot2;
let hidingSpot3;
let playerIsHiding = false;
let hPressed = false;
let nearHidingSpot = null;

// enemy AI - tracks where player was last seen, checks hiding spots
let lastPlayerSeenPos = null;
let lastPlayerNearHidingSpot = null;
let enemyCheckingSpot = false;
let enemyCheckTimer = 0;
const ENEMY_CHECK_TIME = 180;

// menu and game state
let gameState = 'menu';
let gameStarted = false;
let escPressed = false;
let rPressed = false;
let mPressed = false;
let ePressed = false;
let qPressed = false;

// collision detection
let sensor;

// flashlight
let flashlight;

// exit door (back wall)
let exitDoor;
const EXIT_DOOR_X = 0;
const EXIT_DOOR_Y = 1.25;
const EXIT_DOOR_Z = -HOUSE_HALF_Z + 0.2;

// enemy AI
let enemy;
let enemyState = 'patrol';
let enemyPatrolSpeed = 0.020;
let enemyChaseSpeed = 0.045;
const ENEMY_SIGHT_RANGE = 10;
const ENEMY_CATCH_DISTANCE = 1.5;
let currentWaypoint = 0;
let lastEnemyDirX = 0;
let lastEnemyDirZ = 1;

// enemy speeds up after certain time (frames)
let gameTimer = 0;
const SPEED_INCREASE_TIME_1 = 1000;
const SPEED_INCREASE_TIME_2 = 2500;
let enemySpeedIncreased1 = false;
let enemySpeedIncreased2 = false;

// enemy patrol path
const enemyWaypoints = [
  { x: -10, z: -6 },
  { x: -10, z: 2 },
  { x: -4, z: 6 },
  { x: 4, z: 6 },
  { x: 10, z: 2 },
  { x: 10, z: -6 },
  { x: 4, z: -6 },
  { x: -4, z: -6 }
];

// enemy line of sight (raycasting to see if enemy can see player)
let enemyRayCaster;
let enemyDirection = new THREE.Vector3();
let enemyPosition = new THREE.Vector3();
let playerPosition = new THREE.Vector3();

// granny (spawns after 15 seconds, stays in back-right room, kills player on touch)
let granny;
let grannySpawned = false;
let grannyTimer = 900; // 15 seconds at 60fps
let grannySpeed = 0.010;
let grannyDirection = 1; // 1 = moving right, -1 = moving left
const GRANNY_CATCH_DISTANCE = 1.2;
// back-right room boundaries (x: 5 to 14, z: -18 to -2)
const GRANNY_MIN_X = 5;
const GRANNY_MAX_X = 13;
const GRANNY_MIN_Z = -15;
const GRANNY_MAX_Z = -5;
const GRANNY_SPAWN_X = 10;
const GRANNY_SPAWN_Z = -8;

// keep track of if world is set up
let worldInitialized = false;

// list of all game objects so we can clean them up on restart
let allGameEntities = [];

// lighting
let ambientLight;

// sounds
let bgMusic;
let proximitySound;
let escapeSound;
let gameOverSound;
let soundsInitialized = false;

function setup() {
  noCanvas();
  setupMenuListeners();
  setupSounds();
  if (!gameStarted) {
    showMainMenu();
    return;
  }
  initGame();
}

// set up all the sound files
function setupSounds() {
  if (soundsInitialized) return;
  
  bgMusic = new Audio('assets/bg1.wav');
  bgMusic.loop = true;
  bgMusic.volume = 0.3;
  
  proximitySound = new Audio('assets/horror_sus_2.mp3');
  proximitySound.loop = true;
  proximitySound.volume = 0;
  
  escapeSound = new Audio('assets/escape.ogg');
  escapeSound.loop = true;
  escapeSound.volume = 0.8;
  
  gameOverSound = new Audio('assets/No_Hope.ogg');
  gameOverSound.loop = true;
  gameOverSound.volume = 0.8;
  
  soundsInitialized = true;
}

// start playing background music
function startBackgroundMusic() {
  if (bgMusic) {
    bgMusic.currentTime = 0;
    bgMusic.play().catch(function(e) {
    });
  }
  if (proximitySound) {
    proximitySound.currentTime = 0;
    proximitySound.play().catch(function(e) {
    });
  }
}

// stop all sounds
function stopAllSounds() {
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
  if (proximitySound) {
    proximitySound.pause();
    proximitySound.currentTime = 0;
  }
  if (escapeSound) {
    escapeSound.pause();
    escapeSound.currentTime = 0;
  }
  if (gameOverSound) {
    gameOverSound.pause();
    gameOverSound.currentTime = 0;
  }
}

// make proximity sound louder when enemy is closer
function updateProximitySound(distToEnemy) {
  if (!proximitySound) return;
  
  let maxDist = 15;
  let minDist = 2;
  
  if (distToEnemy > maxDist) {
    proximitySound.volume = 0;
  } else if (distToEnemy < minDist) {
    proximitySound.volume = 1.0;
  } else {
    let t = 1 - (distToEnemy - minDist) / (maxDist - minDist);
    proximitySound.volume = t * t;
  }
}

function initGame() {
  // clean up old game objects if restarting
  if (worldInitialized && world) {
    for (let i = 0; i < allGameEntities.length; i++) {
      if (allGameEntities[i]) {
        try {
          world.remove(allGameEntities[i]);
        } catch (e) {
        }
      }
    }
    allGameEntities = [];
  }

  // reset spawn tracking
  clearSpawnPositions();

  // reset all object variables
  bronzeKey = null;
  goldKey = null;
  silverKey = null;
  lockedRoomDoor = null;
  lockedRoomDoorCollider = null;
  clueNote1 = null;
  clueNote2 = null;
  clueNote3 = null;
  clueNote1Collider = null;
  clueNote2Collider = null;
  clueNote3Collider = null;
  trapPickup1 = null;
  trapPickup2 = null;
  droppedTrap = null;
  droppedTrapCollider = null;
  exitDoor = null;
  enemy = null;
  granny = null;
  flashlight = null;
  ambientLight = null;
  sensor = null;
  hidingSpot1 = null;
  hidingSpot2 = null;
  hidingSpot3 = null;

  // reset game state
  playerHasBronzeKey = false;
  playerHasGoldKey = false;
  playerHasSilverKey = false;
  lockedRoomOpen = false;
  playerTrapCount = 0;
  playerIsHiding = false;
  nearHidingSpot = null;
  lastPlayerSeenPos = null;
  lastPlayerNearHidingSpot = null;
  enemyCheckingSpot = false;
  enemyCheckTimer = 0;
  clueNote1Read = false;
  clueNote2Read = false;
  clueNote3Read = false;
  enemyTrapped = false;
  enemyTrapTimer = 0;
  showClueMessage = false;
  clueMessage = "";
  enemyState = 'patrol';
  currentWaypoint = 0;
  lastEnemyDirX = 0;
  lastEnemyDirZ = 1;
  
  // reset timer and enemy speed
  gameTimer = 0;
  enemySpeedIncreased1 = false;
  enemySpeedIncreased2 = false;
  enemyPatrolSpeed = 0.020;
  enemyChaseSpeed = 0.045;
  
  // reset granny
  grannySpawned = false;
  grannyTimer = 900;
  grannyDirection = 1;

  // hide UI
  document.getElementById('keyIndicator').style.display = 'none';
  document.getElementById('trapIndicator').style.display = 'none';
  document.getElementById('grannyTimer').style.display = 'block';
  document.getElementById('grannyTimer').innerHTML = '0:15';

  // create world only once
  if (!worldInitialized) {
  world = new AFrameP5.World('VRScene');
    worldInitialized = true;
  }

  world.setBackground(0, 0, 0);
  world.setFlying(false);
  world.setUserPosition(0, 1.6, 16);

  // disable default WASD controls (we handle movement ourselves)
  if (world.camera && world.camera.cameraEl) {
    world.camera.cameraEl.removeAttribute('wasd-controls');
  }

  // build everything
  setupHouseGeometry();
  setupLighting();
  setupPickups();
  setupHidingSpots();
  setupLockedRoomDoor();
  setupExitDoor();
  setupEnemy();
  
  // collision detection
  sensor = new Sensor();
  enemyRayCaster = new THREE.Raycaster();
  enemyDirection = new THREE.Vector3();
  enemyPosition = new THREE.Vector3();
  playerPosition = new THREE.Vector3();
  
  // start music
  startBackgroundMusic();
  
  gameState = 'playing';
  hideAllMenus();
}

// build the house - walls, floor, ceiling, furniture
function setupHouseGeometry() {
  // floor
  let floor = new AFrameP5.Plane({
    x: 0, y: 0, z: 0,
    width: HOUSE_HALF_X * 2,
    height: HOUSE_HALF_Z * 2,
    red: 25, green: 20, blue: 18,
    rotationX: -90
  });
  floor.tag.object3D.userData.solid = true;
  world.add(floor);
  allGameEntities.push(floor);

  // ceiling
  let ceiling = new AFrameP5.Plane({
    x: 0, y: WALL_HEIGHT, z: 0,
    width: HOUSE_HALF_X * 2,
    height: HOUSE_HALF_Z * 2,
    red: 12, green: 10, blue: 8,
    rotationX: 90
  });
  world.add(ceiling);
  allGameEntities.push(ceiling);

  // outer walls
  
  // back wall (north) - has exit door in the middle
  let wallBackLeft = new AFrameP5.Box({
    x: -7.5, y: WALL_HEIGHT / 2, z: -HOUSE_HALF_Z,
    width: 13,
    height: WALL_HEIGHT,
    depth: WALL_THICKNESS,
    red: 45, green: 40, blue: 35
  });
  wallBackLeft.tag.object3D.userData.solid = true;
  world.add(wallBackLeft);
  allGameEntities.push(wallBackLeft);

  let wallBackRight = new AFrameP5.Box({
    x: 7.5, y: WALL_HEIGHT / 2, z: -HOUSE_HALF_Z,
    width: 13,
    height: WALL_HEIGHT,
    depth: WALL_THICKNESS,
    red: 45, green: 40, blue: 35
  });
  wallBackRight.tag.object3D.userData.solid = true;
  world.add(wallBackRight);
  allGameEntities.push(wallBackRight);

  let wallAboveDoor = new AFrameP5.Box({
    x: 0, y: 2.75, z: -HOUSE_HALF_Z,
    width: 2,
    height: 0.5,
    depth: WALL_THICKNESS,
    red: 45, green: 40, blue: 35
  });
  wallAboveDoor.tag.object3D.userData.solid = true;
  world.add(wallAboveDoor);
  allGameEntities.push(wallAboveDoor);

  // front wall (south)
  let wallFront = new AFrameP5.Box({
    x: 0, y: WALL_HEIGHT / 2, z: HOUSE_HALF_Z,
    width: HOUSE_HALF_X * 2,
    height: WALL_HEIGHT,
    depth: WALL_THICKNESS,
    red: 45, green: 40, blue: 35
  });
  wallFront.tag.object3D.userData.solid = true;
  world.add(wallFront);
  allGameEntities.push(wallFront);

  // left wall (west)
  let wallLeft = new AFrameP5.Box({
    x: -HOUSE_HALF_X, y: WALL_HEIGHT / 2, z: 0,
    width: WALL_THICKNESS,
    height: WALL_HEIGHT,
    depth: HOUSE_HALF_Z * 2,
    red: 45, green: 40, blue: 35
  });
  wallLeft.tag.object3D.userData.solid = true;
  world.add(wallLeft);
  allGameEntities.push(wallLeft);

  // right wall (east)
  let wallRight = new AFrameP5.Box({
    x: HOUSE_HALF_X, y: WALL_HEIGHT / 2, z: 0,
    width: WALL_THICKNESS,
    height: WALL_HEIGHT,
    depth: HOUSE_HALF_Z * 2,
    red: 45, green: 40, blue: 35
  });
  wallRight.tag.object3D.userData.solid = true;
  world.add(wallRight);
  allGameEntities.push(wallRight);

  // inner walls (create rooms, have doorways)
  
  // horizontal wall at z=6 - left side (gap in center for doorway)
  let innerWallH1a = new AFrameP5.Box({
    x: -10, y: WALL_HEIGHT / 2, z: 6,
    width: 8,
    height: WALL_HEIGHT,
    depth: WALL_THICKNESS,
    red: 50, green: 45, blue: 40
  });
  innerWallH1a.tag.object3D.userData.solid = true;
  world.add(innerWallH1a);
  allGameEntities.push(innerWallH1a);

  // horizontal wall at z=6 - right side (gap in center)
  let innerWallH1b = new AFrameP5.Box({
    x: 10, y: WALL_HEIGHT / 2, z: 6,
    width: 8,
    height: WALL_HEIGHT,
    depth: WALL_THICKNESS,
    red: 50, green: 45, blue: 40
  });
  innerWallH1b.tag.object3D.userData.solid = true;
  world.add(innerWallH1b);
  allGameEntities.push(innerWallH1b);

  // middle wall at z=-2 - right side only (leaves gap to access back-right room)
  let innerWallH2b = new AFrameP5.Box({
    x: 11, y: WALL_HEIGHT / 2, z: -2,
    width: 6,
    height: WALL_HEIGHT,
    depth: WALL_THICKNESS,
    red: 50, green: 45, blue: 40
  });
  innerWallH2b.tag.object3D.userData.solid = true;
  world.add(innerWallH2b);
  allGameEntities.push(innerWallH2b);

  // locked room (back left corner)
  // room from x=-14 to x=-5, z=-18 to z=-10
  // can only get in through door on south wall
  
  // east wall of locked room
  let lockedRoomEast = new AFrameP5.Box({
    x: -5, y: WALL_HEIGHT / 2, z: -14,
    width: WALL_THICKNESS,
    height: WALL_HEIGHT,
    depth: 8,
    red: 55, green: 45, blue: 40
  });
  lockedRoomEast.tag.object3D.userData.solid = true;
  world.add(lockedRoomEast);
  allGameEntities.push(lockedRoomEast);

  // south wall of locked room (has door gap)
  // left section
  let lockedRoomSouthLeft = new AFrameP5.Box({
    x: -12.1, y: WALL_HEIGHT / 2, z: -10,
    width: 3.8,
    height: WALL_HEIGHT,
    depth: WALL_THICKNESS,
    red: 55, green: 45, blue: 40
  });
  lockedRoomSouthLeft.tag.object3D.userData.solid = true;
  world.add(lockedRoomSouthLeft);
  allGameEntities.push(lockedRoomSouthLeft);

  // right section
  let lockedRoomSouthRight = new AFrameP5.Box({
    x: -6.9, y: WALL_HEIGHT / 2, z: -10,
    width: 3.8,
    height: WALL_HEIGHT,
    depth: WALL_THICKNESS,
    red: 55, green: 45, blue: 40
  });
  lockedRoomSouthRight.tag.object3D.userData.solid = true;
  world.add(lockedRoomSouthRight);
  allGameEntities.push(lockedRoomSouthRight);
  // wall above door
  let lockedRoomAboveDoor = new AFrameP5.Box({
    x: -9.5, y: 2.75, z: -10,
    width: 2,
    height: 0.5,
    depth: WALL_THICKNESS,
    red: 55, green: 45, blue: 40
  });
  lockedRoomAboveDoor.tag.object3D.userData.solid = true;
  world.add(lockedRoomAboveDoor);
  allGameEntities.push(lockedRoomAboveDoor);

  // vertical wall - front left area
  let innerWallV1 = new AFrameP5.Box({
    x: -5, y: WALL_HEIGHT / 2, z: 14,
    width: WALL_THICKNESS,
    height: WALL_HEIGHT,
    depth: 8,
    red: 50, green: 45, blue: 40
  });
  innerWallV1.tag.object3D.userData.solid = true;
  world.add(innerWallV1);
  allGameEntities.push(innerWallV1);

  // vertical wall - front right area
  let innerWallV2 = new AFrameP5.Box({
    x: 5, y: WALL_HEIGHT / 2, z: 14,
    width: WALL_THICKNESS,
    height: WALL_HEIGHT,
    depth: 8,
    red: 50, green: 45, blue: 40
  });
  innerWallV2.tag.object3D.userData.solid = true;
  world.add(innerWallV2);
  allGameEntities.push(innerWallV2);

  // vertical wall - back right area (stops before z=-2 so player can get in)
  let innerWallV3 = new AFrameP5.Box({
    x: 4, y: WALL_HEIGHT / 2, z: -12,
    width: WALL_THICKNESS,
    height: WALL_HEIGHT,
    depth: 12,
    red: 50, green: 45, blue: 40
  });
  innerWallV3.tag.object3D.userData.solid = true;
  world.add(innerWallV3);
  allGameEntities.push(innerWallV3);

  // furniture (tables, crates, etc.)
  
  // table in front left room
  let table1 = new AFrameP5.Box({
    x: -10, y: 0.4, z: 12,
    width: 1.5, height: 0.8, depth: 1,
    red: 70, green: 45, blue: 25
  });
  world.add(table1);
  allGameEntities.push(table1);
  
  // invisible collision box for table (taller so player can't walk through)
  let table1Collider = new AFrameP5.Box({
    x: -10,
    y: 1.0,
    z: 12,
    width: 1.7,
    height: 1.5,
    depth: 1.2,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  table1Collider.tag.object3D.userData.solid = true;
  world.add(table1Collider);
  allGameEntities.push(table1Collider);

  // large table in front center
  let table2 = new AFrameP5.Box({
    x: 0, y: 0.4, z: 12,
    width: 2, height: 0.8, depth: 1.2,
    red: 65, green: 42, blue: 22
  });
  table2.tag.object3D.userData.solid = true;
  world.add(table2);
  allGameEntities.push(table2);

  // shelf in front right
  let shelf1 = new AFrameP5.Box({
    x: 10, y: 1, z: 12,
    width: 2, height: 2, depth: 0.4,
    red: 55, green: 38, blue: 22
  });
  shelf1.tag.object3D.userData.solid = true;
  world.add(shelf1);
  allGameEntities.push(shelf1);

  // crates in middle area
  let crate1 = new AFrameP5.Box({
    x: -10, y: 0.4, z: 0,
    width: 0.8, height: 0.8, depth: 0.8,
    red: 80, green: 60, blue: 40
  });
  world.add(crate1);
  allGameEntities.push(crate1);
  
  // invisible collision box for crate (taller so player can't walk through)
  let crate1Collider = new AFrameP5.Box({
    x: -10,
    y: 1.0,
    z: 0,
    width: 1.0,
    height: 1.5,
    depth: 1.0,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  crate1Collider.tag.object3D.userData.solid = true;
  world.add(crate1Collider);
  allGameEntities.push(crate1Collider);

  let crate2 = new AFrameP5.Box({
    x: 10, y: 0.4, z: -6,
    width: 0.8, height: 0.8, depth: 0.8,
    red: 75, green: 55, blue: 35
  });
  world.add(crate2);
  allGameEntities.push(crate2);
  
  // invisible collision box for crate (taller so player can't walk through)
  let crate2Collider = new AFrameP5.Box({
    x: 10,
    y: 1.0,
    z: -6,
    width: 1.0,
    height: 1.5,
    depth: 1.0,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  crate2Collider.tag.object3D.userData.solid = true;
  world.add(crate2Collider);
  allGameEntities.push(crate2Collider);

  // cabinet in middle
  let cabinet1 = new AFrameP5.Box({
    x: 2, y: 0.6, z: 0,
    width: 1, height: 1.2, depth: 0.6,
    red: 58, green: 40, blue: 25
  });
  cabinet1.tag.object3D.userData.solid = true;
  world.add(cabinet1);
  allGameEntities.push(cabinet1);

  // dresser in locked room
  let dresser1 = new AFrameP5.Box({
    x: -12, y: 0.5, z: -14,
    width: 1.2, height: 1, depth: 0.6,
    red: 52, green: 35, blue: 20
  });
  world.add(dresser1);
  allGameEntities.push(dresser1);
  
  // invisible collision box for dresser (taller so player can't walk through)
  let dresser1Collider = new AFrameP5.Box({
    x: -12,
    y: 1.0,
    z: -14,
    width: 1.4,
    height: 1.5,
    depth: 0.8,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  dresser1Collider.tag.object3D.userData.solid = true;
  world.add(dresser1Collider);
  allGameEntities.push(dresser1Collider);

  // barrel in back right area
  let barrel1 = new AFrameP5.Box({
    x: 10, y: 0.4, z: -14,
    width: 0.6, height: 0.8, depth: 0.6,
    red: 85, green: 65, blue: 45
  });
  world.add(barrel1);
  allGameEntities.push(barrel1);
  
  // invisible collision box for barrel (taller so player can't walk through)
  let barrel1Collider = new AFrameP5.Box({
    x: 10,
    y: 1.0,
    z: -14,
    width: 0.8,
    height: 1.5,
    depth: 0.8,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  barrel1Collider.tag.object3D.userData.solid = true;
  world.add(barrel1Collider);
  allGameEntities.push(barrel1Collider);

  // debris pile
  let debris1 = new AFrameP5.Box({
    x: -2, y: 0.15, z: 2,
    width: 1.5, height: 0.3, depth: 1,
    red: 40, green: 35, blue: 30
  });
  world.add(debris1);
  allGameEntities.push(debris1);
  
  // invisible collision box for debris (taller so player can't walk through)
  let debris1Collider = new AFrameP5.Box({
    x: -2,
    y: 1.0,
    z: 2,
    width: 1.7,
    height: 1.5,
    depth: 1.2,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  debris1Collider.tag.object3D.userData.solid = true;
  world.add(debris1Collider);
  allGameEntities.push(debris1Collider);
}

// set up menu button listeners
function setupMenuListeners() {
  document.getElementById('startBtn').addEventListener('click', function() {
    gameStarted = true;
    hideAllMenus();
    initGame();
  });

  document.getElementById('instructionsBtn').addEventListener('click', function() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('instructionsMenu').style.display = 'flex';
  });

  document.getElementById('backFromInstructions').addEventListener('click', function() {
    document.getElementById('instructionsMenu').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
  });

  document.getElementById('conceptBtn').addEventListener('click', function() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('conceptMenu').style.display = 'flex';
  });

  document.getElementById('backFromConcept').addEventListener('click', function() {
    document.getElementById('conceptMenu').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
  });

  document.getElementById('resumeBtn').addEventListener('click', function() {
    hideAllMenus();
    gameState = 'playing';
    startBackgroundMusic();
  });

  document.getElementById('restartFromOptions').addEventListener('click', function() {
    restartGame();
  });

  document.getElementById('mainMenuFromOptions').addEventListener('click', function() {
    stopAllSounds();
    hideAllMenus();
    showMainMenu();
    gameState = 'menu';
    gameStarted = false;
  });

  document.getElementById('retryBtn').addEventListener('click', function() {
    restartGame();
  });

  document.getElementById('gameOverMainMenuBtn').addEventListener('click', function() {
    stopAllSounds();
    hideAllMenus();
    showMainMenu();
    gameState = 'menu';
    gameStarted = false;
  });

  document.getElementById('winMainMenuBtn').addEventListener('click', function() {
    stopAllSounds();
    hideAllMenus();
    showMainMenu();
    gameState = 'menu';
    gameStarted = false;
  });
}

function hideAllMenus() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('instructionsMenu').style.display = 'none';
  document.getElementById('conceptMenu').style.display = 'none';
  document.getElementById('optionsMenu').style.display = 'none';
  document.getElementById('winScreen').style.display = 'none';
  document.getElementById('gameOverScreen').style.display = 'none';
}

function showMainMenu() {
  hideAllMenus();
  document.getElementById('mainMenu').style.display = 'flex';
  document.getElementById('grannyTimer').style.display = 'none';
}

function showOptionsMenu() {
  document.getElementById('optionsMenu').style.display = 'flex';
  gameState = 'paused';
  if (bgMusic) bgMusic.pause();
  if (proximitySound) proximitySound.pause();
}

function showWinScreen() {
  stopAllSounds();
  if (escapeSound) {
    escapeSound.play().catch(function(e) {});
  }
  document.getElementById('winScreen').style.display = 'flex';
  document.getElementById('keyIndicator').style.display = 'none';
  document.getElementById('trapIndicator').style.display = 'none';
  document.getElementById('grannyTimer').style.display = 'none';
  gameState = 'won';
}

function showGameOverScreen() {
  stopAllSounds();
  if (gameOverSound) {
    gameOverSound.play().catch(function(e) {});
  }
  // reset to normal message (in case it was changed by granny)
  document.getElementById('gameOverScreen').querySelector('p').textContent = 'She caught you...';
  document.getElementById('gameOverScreen').style.display = 'flex';
  document.getElementById('keyIndicator').style.display = 'none';
  document.getElementById('trapIndicator').style.display = 'none';
  document.getElementById('grannyTimer').style.display = 'none';
  gameState = 'gameover';
}

function restartGame() {
  stopAllSounds();
  hideAllMenus();
  hideClueMessage();
  initGame();
}

function displayClueMessage(message) {
  let clueDiv = document.getElementById('clueMessage');
  let clueText = document.getElementById('clueText');
  if (clueDiv && clueText) {
    clueText.textContent = message;
    clueDiv.style.display = 'block';
  }
}

function hideClueMessage() {
  let clueDiv = document.getElementById('clueMessage');
  if (clueDiv) {
    clueDiv.style.display = 'none';
  }
}

// set up lighting (ambient + flashlight)
function setupLighting() {
  ambientLight = new AFrameP5.Light({
    color: '#ffffff',
    type: 'ambient',
    intensity: 0.08
  });
  world.add(ambientLight);
  allGameEntities.push(ambientLight);

  flashlight = new AFrameP5.Light({
    x: 0, y: 1.6, z: 16,
    color: '#ffffee',
    type: 'point',
    intensity: 1.8
  });
  world.add(flashlight);
  allGameEntities.push(flashlight);
}

// spawn keys, traps, and clue notes (make sure they don't overlap)
function setupPickups() {
  // mark furniture positions first so keys don't spawn inside them
  clearSpawnPositions();
  registerFurniturePositions();
  
  // mark clue note positions (they're fixed)
  registerSpawnPosition(0, 12);
  registerSpawnPosition(2, 0);
  registerSpawnPosition(10, -14);
  
  // shuffle key spawn locations
  let shuffledKeys = keySpawnLocations.slice();
  for (let i = shuffledKeys.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = shuffledKeys[i];
    shuffledKeys[i] = shuffledKeys[j];
    shuffledKeys[j] = temp;
  }
  
  // find valid bronze key position (keep trying random spots until we find one that works)
  let bronzePos = null;
  let attempts = 0;
  const MAX_ATTEMPTS = 50;
  while (!bronzePos && attempts < MAX_ATTEMPTS) {
    let randomIndex = Math.floor(Math.random() * shuffledKeys.length);
    let candidate = shuffledKeys[randomIndex];
    if (isValidSpawnPosition(candidate.x, candidate.z, MIN_SPAWN_DISTANCE)) {
      bronzePos = candidate;
      registerSpawnPosition(bronzePos.x, bronzePos.z);
      break;
    }
    attempts++;
  }
  // fallback if we can't find a good spot
  if (!bronzePos) {
    bronzePos = shuffledKeys[0];
    registerSpawnPosition(bronzePos.x, bronzePos.z);
  }

  // bronze key - unlocks the locked room
  bronzeKey = new AFrameP5.GLTF({
    asset: 'bronzeKeyModel',
    x: bronzePos.x,
    y: 0.5,
    z: bronzePos.z,
    scaleX: 1.5,
    scaleY: 1.5,
    scaleZ: 1.5
  });
  world.add(bronzeKey);
  allGameEntities.push(bronzeKey);

  // gold key - always in the locked room
  registerSpawnPosition(-10, -14);
  goldKey = new AFrameP5.GLTF({
    asset: 'goldKeyModel',
    x: -10,
    y: 0.5,
    z: -14,
    scaleX: 1.5,
    scaleY: 1.5,
    scaleZ: 1.5
  });
  world.add(goldKey);
  allGameEntities.push(goldKey);

  // find valid silver key position (same while loop approach)
  let silverPos = null;
  attempts = 0;
  while (!silverPos && attempts < MAX_ATTEMPTS) {
    let randomIndex = Math.floor(Math.random() * shuffledKeys.length);
    let candidate = shuffledKeys[randomIndex];
    if (isValidSpawnPosition(candidate.x, candidate.z, MIN_SPAWN_DISTANCE)) {
      silverPos = candidate;
      registerSpawnPosition(silverPos.x, silverPos.z);
      break;
    }
    attempts++;
  }
  // fallback
  if (!silverPos) {
    silverPos = shuffledKeys[shuffledKeys.length - 1];
    registerSpawnPosition(silverPos.x, silverPos.z);
  }

  // silver key - random spawn
  silverKey = new AFrameP5.GLTF({
    asset: 'silverKeyModel',
    x: silverPos.x,
    y: 0.5,
    z: silverPos.z,
    scaleX: 1.5,
    scaleY: 1.5,
    scaleZ: 1.5
  });
  world.add(silverKey);
  allGameEntities.push(silverKey);

  // clue notes (fixed positions, already registered above)
  clueNote1 = new AFrameP5.Box({
    x: 0,
    y: 0.85,
    z: 12,
    width: 0.25,
    height: 0.02,
    depth: 0.35,
    red: 220,
    green: 210,
    blue: 190
  });
  world.add(clueNote1);
  allGameEntities.push(clueNote1);
  
  // invisible collision box for clue note (matches box size so player can't walk through from any side)
  clueNote1Collider = new AFrameP5.Box({
    x: 0,
    y: 1.0,
    z: 12,
    width: 0.5,
    height: 1.5,
    depth: 0.6,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  clueNote1Collider.tag.object3D.userData.solid = true;
  world.add(clueNote1Collider);
  allGameEntities.push(clueNote1Collider);

  clueNote2 = new AFrameP5.Box({
    x: 2,
    y: 1.3,
    z: 0,
    width: 0.25,
    height: 0.02,
    depth: 0.35,
    red: 220,
    green: 210,
    blue: 190
  });
  world.add(clueNote2);
  allGameEntities.push(clueNote2);
  
  // invisible collision box for clue note (matches box size so player can't walk through from any side)
  clueNote2Collider = new AFrameP5.Box({
    x: 2,
    y: 1.0,
    z: 0,
    width: 0.5,
    height: 1.5,
    depth: 0.6,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  clueNote2Collider.tag.object3D.userData.solid = true;
  world.add(clueNote2Collider);
  allGameEntities.push(clueNote2Collider);

  clueNote3 = new AFrameP5.Box({
    x: 10,
    y: 0.85,
    z: -14,
    width: 0.25,
    height: 0.02,
    depth: 0.35,
    red: 220,
    green: 210,
    blue: 190
  });
  world.add(clueNote3);
  allGameEntities.push(clueNote3);
  
  // invisible collision box for clue note (taller so player can't walk through)
  clueNote3Collider = new AFrameP5.Box({
    x: 10,
    y: 1.0,
    z: -14,
    width: 0.5,
    height: 1.5,
    depth: 0.6,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  clueNote3Collider.tag.object3D.userData.solid = true;
  world.add(clueNote3Collider);
  allGameEntities.push(clueNote3Collider);

  // shuffle trap spawn locations
  let shuffledTraps = trapSpawnLocations.slice();
  for (let i = shuffledTraps.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = shuffledTraps[i];
    shuffledTraps[i] = shuffledTraps[j];
    shuffledTraps[j] = temp;
  }

  // find valid trap 1 position (while loop to avoid overlaps)
  let trap1Pos = null;
  attempts = 0;
  while (!trap1Pos && attempts < MAX_ATTEMPTS) {
    let randomIndex = Math.floor(Math.random() * shuffledTraps.length);
    let candidate = shuffledTraps[randomIndex];
    if (isValidSpawnPosition(candidate.x, candidate.z, MIN_SPAWN_DISTANCE)) {
      trap1Pos = candidate;
      registerSpawnPosition(trap1Pos.x, trap1Pos.z);
      break;
    }
    attempts++;
  }
  if (!trap1Pos) {
    trap1Pos = shuffledTraps[0];
    registerSpawnPosition(trap1Pos.x, trap1Pos.z);
  }

  trapPickup1 = new AFrameP5.GLTF({
    asset: 'trapModel',
    x: trap1Pos.x,
    y: 0.1,
    z: trap1Pos.z,
    scaleX: 0.15,
    scaleY: 0.15,
    scaleZ: 0.15
  });
  world.add(trapPickup1);
  allGameEntities.push(trapPickup1);

  // find valid trap 2 position (same approach)
  let trap2Pos = null;
  attempts = 0;
  while (!trap2Pos && attempts < MAX_ATTEMPTS) {
    let randomIndex = Math.floor(Math.random() * shuffledTraps.length);
    let candidate = shuffledTraps[randomIndex];
    if (isValidSpawnPosition(candidate.x, candidate.z, MIN_SPAWN_DISTANCE)) {
      trap2Pos = candidate;
      registerSpawnPosition(trap2Pos.x, trap2Pos.z);
      break;
    }
    attempts++;
  }
  if (!trap2Pos) {
    trap2Pos = shuffledTraps[shuffledTraps.length - 1];
    registerSpawnPosition(trap2Pos.x, trap2Pos.z);
  }

  trapPickup2 = new AFrameP5.GLTF({
    asset: 'trapModel',
    x: trap2Pos.x,
    y: 0.1,
    z: trap2Pos.z,
    scaleX: 0.15,
    scaleY: 0.15,
    scaleZ: 0.15
  });
  world.add(trapPickup2);
  allGameEntities.push(trapPickup2);
}

// set up hiding spots (closets) - make sure they're spaced out
function setupHidingSpots() {
  // shuffle closet locations
  let shuffledClosets = closetSpawnLocations.slice();
  for (let i = shuffledClosets.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = shuffledClosets[i];
    shuffledClosets[i] = shuffledClosets[j];
    shuffledClosets[j] = temp;
  }
  
  // pick 3 closets that are far enough from each other and other objects
  let selectedClosets = [];
  
  for (let i = 0; i < shuffledClosets.length && selectedClosets.length < 3; i++) {
    let candidate = shuffledClosets[i];
    
    // check if far from keys/traps/etc
    if (!isValidSpawnPosition(candidate.x, candidate.z, MIN_SPAWN_DISTANCE)) {
      continue;
    }
    
    // check if far from other closets (they need more space)
    let tooCloseToOtherCloset = false;
    for (let j = 0; j < selectedClosets.length; j++) {
      let d = dist(candidate.x, candidate.z, selectedClosets[j].x, selectedClosets[j].z);
      if (d < MIN_CLOSET_DISTANCE) {
        tooCloseToOtherCloset = true;
        break;
      }
    }
    
    if (!tooCloseToOtherCloset) {
      selectedClosets.push(candidate);
      registerSpawnPosition(candidate.x, candidate.z);
    }
  }
  
  // fallback: if we can't get 3 properly spaced, just use first 3
  if (selectedClosets.length < 3) {
    for (let i = 0; i < shuffledClosets.length && selectedClosets.length < 3; i++) {
      let alreadySelected = false;
      for (let j = 0; j < selectedClosets.length; j++) {
        if (selectedClosets[j].x === shuffledClosets[i].x && selectedClosets[j].z === shuffledClosets[i].z) {
          alreadySelected = true;
          break;
        }
      }
      if (!alreadySelected) {
        selectedClosets.push(shuffledClosets[i]);
        registerSpawnPosition(shuffledClosets[i].x, shuffledClosets[i].z);
      }
    }
  }
  
  let closet1Pos = selectedClosets[0];
  let closet2Pos = selectedClosets[1];
  let closet3Pos = selectedClosets[2];

  // hiding spot 1
  hidingSpot1 = new AFrameP5.GLTF({
    asset: 'closetModel',
    x: closet1Pos.x,
    y: 0,
    z: closet1Pos.z,
    scaleX: 1.2,
    scaleY: 1.2,
    scaleZ: 1.2,
    rotationY: closet1Pos.rotY
  });
  hidingSpot1.tag.object3D.userData.solid = true;
  hidingSpot1.tag.object3D.userData.hidingSpot = true;
  world.add(hidingSpot1);
  allGameEntities.push(hidingSpot1);

  // hiding spot 2
  hidingSpot2 = new AFrameP5.GLTF({
    asset: 'closetModel',
    x: closet2Pos.x,
    y: 0,
    z: closet2Pos.z,
    scaleX: 1.2,
    scaleY: 1.2,
    scaleZ: 1.2,
    rotationY: closet2Pos.rotY
  });
  hidingSpot2.tag.object3D.userData.solid = true;
  hidingSpot2.tag.object3D.userData.hidingSpot = true;
  world.add(hidingSpot2);
  allGameEntities.push(hidingSpot2);

  // hiding spot 3
  hidingSpot3 = new AFrameP5.GLTF({
    asset: 'closetModel',
    x: closet3Pos.x,
    y: 0,
    z: closet3Pos.z,
    scaleX: 1.2,
    scaleY: 1.2,
    scaleZ: 1.2,
    rotationY: closet3Pos.rotY
  });
  hidingSpot3.tag.object3D.userData.solid = true;
  hidingSpot3.tag.object3D.userData.hidingSpot = true;
  world.add(hidingSpot3);
  allGameEntities.push(hidingSpot3);
}

// set up locked room door (3D model with invisible collision box)
function setupLockedRoomDoor() {
  // door gap is at x=-9.5, z=-10, door faces toward player
  lockedRoomDoor = new AFrameP5.GLTF({
    asset: 'doorModel',
    x: -8.8,
    y: 0,
    z: -9.85,
    scaleX: 0.9,
    scaleY: 1.0,
    scaleZ: 0.9,
    rotationY: 180
  });
  world.add(lockedRoomDoor);
  allGameEntities.push(lockedRoomDoor);

  // invisible collision box (player can't walk through when locked)
  lockedRoomDoorCollider = new AFrameP5.Box({
    x: LOCKED_ROOM_DOOR_X,
    y: 1.25,
    z: LOCKED_ROOM_DOOR_Z,
    width: 2,
    height: 2.5,
    depth: 0.5,
    red: 0,
    green: 0,
    blue: 0,
    opacity: 0,
    transparent: true
  });
  lockedRoomDoorCollider.tag.object3D.userData.solid = true;
  world.add(lockedRoomDoorCollider);
  allGameEntities.push(lockedRoomDoorCollider);
}

// set up exit door (back wall)
function setupExitDoor() {
  exitDoor = new AFrameP5.Box({
    x: EXIT_DOOR_X,
    y: EXIT_DOOR_Y,
    z: EXIT_DOOR_Z,
    width: 2,
    height: 2.5,
    depth: 0.2,
    red: 139,
    green: 0,
    blue: 0
  });
  exitDoor.tag.object3D.userData.solid = true;
  world.add(exitDoor);
  allGameEntities.push(exitDoor);
}

// set up enemy (3D model, starts at first waypoint)
function setupEnemy() {
  enemy = new AFrameP5.GLTF({
    asset: 'zombieModel',
    x: enemyWaypoints[0].x,
    y: 0,
    z: enemyWaypoints[0].z,
    scaleX: 1.2,
    scaleY: 1.2,
    scaleZ: 1.2
  });
  world.add(enemy);
  allGameEntities.push(enemy);

  enemy.tag.setAttribute('animation-mixer', 'clip: *; loop: repeat');
}

// spawn granny in back-right room (called when timer hits 0)
function spawnGranny() {
  granny = new AFrameP5.GLTF({
    asset: 'grannyModel',
    x: GRANNY_SPAWN_X,
    y: 0.8,
    z: GRANNY_SPAWN_Z,
    scaleX: 4.0,
    scaleY: 4.0,
    scaleZ: 4.0
  });
  world.add(granny);
  allGameEntities.push(granny);
  
  granny.tag.setAttribute('animation-mixer', 'clip: *; loop: repeat');
  grannySpawned = true;
}

// update granny (moves slowly in back-right room, kills player on touch)
function updateGranny() {
  if (!granny) return;
  
  let grannyPos = granny.getPosition();
  let playerPos = world.getUserPosition();
  
  // check if granny catches player
  let distToPlayer = dist(grannyPos.x, grannyPos.z, playerPos.x, playerPos.z);
  if (distToPlayer < GRANNY_CATCH_DISTANCE && !playerIsHiding) {
    showGrannyGameOver();
    return;
  }
  
  // move granny back and forth in her room
  let newX = grannyPos.x + (grannySpeed * grannyDirection);
  
  // reverse direction if hitting room boundaries
  if (newX >= GRANNY_MAX_X) {
    grannyDirection = -1;
    newX = GRANNY_MAX_X;
  }
  if (newX <= GRANNY_MIN_X) {
    grannyDirection = 1;
    newX = GRANNY_MIN_X;
  }
  
  // set new position
  granny.setPosition(newX, grannyPos.y, grannyPos.z);
  
  // rotate granny to face direction of movement
  if (grannyDirection > 0) {
    granny.setRotation(0, -90, 0);
  } else {
    granny.setRotation(0, 90, 0);
  }
}

// game over screen for granny (different message)
function showGrannyGameOver() {
  stopAllSounds();
  if (gameOverSound) {
    gameOverSound.play().catch(function(e) {});
  }
  // change the message to show player got baited
  let baitMessage = 'You got baited LOL!<br><br>The granny was a troll... she was never here to help you.<br><br>"Moral: Don’t believe everything you hear."';
  document.getElementById('gameOverScreen').querySelector('p').innerHTML = baitMessage;
  document.getElementById('gameOverScreen').style.display = 'flex';
  document.getElementById('keyIndicator').style.display = 'none';
  document.getElementById('trapIndicator').style.display = 'none';
  document.getElementById('grannyTimer').style.display = 'none';
  gameState = 'gameover';
}

// update enemy AI (patrol, chase, check hiding spots)
function updateEnemy() {
  if (!enemy) return;

  let enemyPos = enemy.getPosition();
  let playerPos = world.getUserPosition();

  // distance to player
  let distToPlayer = dist(enemyPos.x, enemyPos.z, playerPos.x, playerPos.z);

  // update proximity sound (quiet if hiding)
  if (playerIsHiding) {
    updateProximitySound(100);
  } else {
    updateProximitySound(distToPlayer);
  }

  // check if enemy is trapped
  if (enemyTrapped) {
    enemyTrapTimer--;
    if (enemyTrapTimer <= 0) {
      enemyTrapped = false;
      if (droppedTrap) {
        try {
          world.remove(droppedTrap);
        } catch (e) {}
        droppedTrap = null;
      }
      if (droppedTrapCollider) {
        try {
          world.remove(droppedTrapCollider);
        } catch (e) {}
        droppedTrapCollider = null;
      }
    }
    return;
  }

  // check if enemy is checking a hiding spot
  if (enemyCheckingSpot) {
    enemyCheckTimer--;
    if (enemyCheckTimer <= 0) {
      enemyCheckingSpot = false;
      lastPlayerNearHidingSpot = null;
      enemyState = 'patrol';
    }
    // if player leaves hiding while enemy is checking, they get caught
    if (!playerIsHiding && lastPlayerNearHidingSpot) {
      let spotPos = lastPlayerNearHidingSpot.getPosition();
      let playerDistToSpot = dist(playerPos.x, playerPos.z, spotPos.x, spotPos.z);
      if (playerDistToSpot < 3) {
        showGameOverScreen();
        return;
      }
    }
    return;
  }

  // check if enemy catches player (can't catch if hiding)
  if (distToPlayer < ENEMY_CATCH_DISTANCE && !playerIsHiding) {
    showGameOverScreen();
    return;
  }

  // check if enemy hits a trap
  if (droppedTrapCollider) {
    let trapPos = droppedTrapCollider.getPosition();
    let distToTrap = dist(enemyPos.x, enemyPos.z, trapPos.x, trapPos.z);
    if (distToTrap < 1.5) {
      enemyTrapped = true;
      enemyTrapTimer = TRAP_FREEZE_TIME;
      clueMessage = "She's trapped! Run!";
      showClueMessage = true;
      displayClueMessage(clueMessage);
      setTimeout(function() {
        showClueMessage = false;
        hideClueMessage();
      }, 2000);
      return;
    }
  }

  // check line of sight (can't see player if hiding)
  let canSeePlayer = false;
  if (!playerIsHiding) {
    canSeePlayer = checkLineOfSight(enemyPos, playerPos);
  }

  if (canSeePlayer && distToPlayer < ENEMY_SIGHT_RANGE) {
    enemyState = 'chase';
    // remember where player was last seen and if they were near a hiding spot
    lastPlayerSeenPos = { x: playerPos.x, z: playerPos.z };
    if (nearHidingSpot) {
      lastPlayerNearHidingSpot = nearHidingSpot;
    }
  } else if (enemyState === 'chase' && !canSeePlayer) {
    // player disappeared - check if they were near a hiding spot
    if (lastPlayerNearHidingSpot && playerIsHiding) {
      enemyCheckingSpot = true;
      enemyCheckTimer = ENEMY_CHECK_TIME;
      // move toward the hiding spot
      let spotPos = lastPlayerNearHidingSpot.getPosition();
      let dirX = spotPos.x - enemyPos.x;
      let dirZ = spotPos.z - enemyPos.z;
      let length = Math.sqrt(dirX * dirX + dirZ * dirZ);
      if (length > 0.5) {
        dirX /= length;
        dirZ /= length;
        enemy.setPosition(
          enemyPos.x + dirX * enemyChaseSpeed,
          enemyPos.y,
          enemyPos.z + dirZ * enemyChaseSpeed
        );
        lastEnemyDirX = dirX;
        lastEnemyDirZ = dirZ;
      }
      return;
    }
    enemyState = 'patrol';
  }

  let dirX = 0;
  let dirZ = 0;

  if (enemyState === 'patrol') {
    let waypoint = enemyWaypoints[currentWaypoint];
    let distToWaypoint = dist(enemyPos.x, enemyPos.z, waypoint.x, waypoint.z);

    if (distToWaypoint < 0.5) {
      currentWaypoint = (currentWaypoint + 1) % enemyWaypoints.length;
    } else {
      dirX = waypoint.x - enemyPos.x;
      dirZ = waypoint.z - enemyPos.z;
      let length = Math.sqrt(dirX * dirX + dirZ * dirZ);
      dirX /= length;
      dirZ /= length;

      enemy.setPosition(
        enemyPos.x + dirX * enemyPatrolSpeed,
        enemyPos.y,
        enemyPos.z + dirZ * enemyPatrolSpeed
      );
    }
  } else if (enemyState === 'chase') {
    dirX = playerPos.x - enemyPos.x;
    dirZ = playerPos.z - enemyPos.z;
    let length = Math.sqrt(dirX * dirX + dirZ * dirZ);
    dirX /= length;
    dirZ /= length;

    enemy.setPosition(
      enemyPos.x + dirX * enemyChaseSpeed,
      enemyPos.y,
      enemyPos.z + dirZ * enemyChaseSpeed
    );
  }

  // rotate enemy to face where it's moving
  if (dirX !== 0 || dirZ !== 0) {
    lastEnemyDirX = dirX;
    lastEnemyDirZ = dirZ;
  }
  let angle = Math.atan2(lastEnemyDirX, lastEnemyDirZ) * (180 / Math.PI);
  enemy.setRotation(0, angle, 0);
}

// check if enemy can see player (raycasting through walls)
function checkLineOfSight(enemyPos, playerPos) {
  enemyPosition.set(enemyPos.x, enemyPos.y + 1, enemyPos.z);
  playerPosition.set(playerPos.x, playerPos.y, playerPos.z);

  enemyDirection.subVectors(playerPosition, enemyPosition);
  let distanceToPlayer = enemyDirection.length();
  enemyDirection.normalize();

  enemyRayCaster.set(enemyPosition, enemyDirection);
  let intersects = enemyRayCaster.intersectObjects(world.threeSceneReference.children, true);

  for (let i = 0; i < intersects.length; i++) {
    if (!intersects[i].object.el || !intersects[i].object.el.object3D.userData.solid) {
      intersects.splice(i, 1);
      i--;
    }
  }

  if (intersects.length === 0) {
    return true;
  }

  if (intersects[0].distance > distanceToPlayer) {
    return true;
  }

  return false;
}

// collision sensor - checks if player can move in a direction
class Sensor {
  constructor() {
    this.rayCaster = new THREE.Raycaster();
    this.direction = new THREE.Vector3();
    this.origin = new THREE.Vector3();
    this.intersects = [];
  }

  getEntityInDirection(dir) {
    if (world && world.camera && world.camera.cameraEl) {
      let camPos = world.getUserPosition();
      this.origin.set(camPos.x, camPos.y, camPos.z);

      let cameraRotation = world.camera.cameraEl.getAttribute('rotation');
      let yRot = THREE.MathUtils.degToRad(cameraRotation.y);

      if (dir === 'forward') {
        this.direction.set(-Math.sin(yRot), 0, -Math.cos(yRot));
      } else if (dir === 'backward') {
        this.direction.set(Math.sin(yRot), 0, Math.cos(yRot));
      } else if (dir === 'left') {
        this.direction.set(-Math.cos(yRot), 0, Math.sin(yRot));
      } else if (dir === 'right') {
        this.direction.set(Math.cos(yRot), 0, -Math.sin(yRot));
      }

      this.direction.normalize();
      this.rayCaster.set(this.origin, this.direction);
      this.intersects = this.rayCaster.intersectObjects(world.threeSceneReference.children, true);

      for (let i = 0; i < this.intersects.length; i++) {
        if (!this.intersects[i].object.el.object3D.userData.solid) {
          this.intersects.splice(i, 1);
          i--;
        }
      }

      if (this.intersects.length > 0) {
        return this.intersects[0];
      }
    }
    return false;
  }
}

// update the key count display
function updateKeyIndicator() {
  let keyCount = 0;
  if (playerHasGoldKey) keyCount++;
  if (playerHasSilverKey) keyCount++;
  
  document.getElementById('keyIndicator').style.display = 'block';
  let text = '';
  if (playerHasBronzeKey) text += 'BRONZE ✓ | ';
  text += 'KEYS: ' + keyCount + '/2';
  document.getElementById('keyIndicator').innerHTML = text;
}

// main game loop - runs every frame
function draw() {
  if (!world || gameState !== 'playing' || !sensor) return;

  let playerPos = world.getUserPosition();
  
  // update flashlight position (only if not hiding)
  if (!playerIsHiding) {
    flashlight.setPosition(playerPos.x, playerPos.y, playerPos.z);
  }

  // update timer and check if enemy should speed up
  gameTimer++;
  if (gameTimer >= SPEED_INCREASE_TIME_1 && !enemySpeedIncreased1) {
    enemySpeedIncreased1 = true;
    enemyPatrolSpeed = 0.028;
    enemyChaseSpeed = 0.065;
    clueMessage = "She's getting faster...";
    showClueMessage = true;
    displayClueMessage(clueMessage);
    setTimeout(function() {
      showClueMessage = false;
      hideClueMessage();
    }, 3000);
  }
  if (gameTimer >= SPEED_INCREASE_TIME_2 && !enemySpeedIncreased2) {
    enemySpeedIncreased2 = true;
    enemyPatrolSpeed = 0.038;
    enemyChaseSpeed = 0.085;
    clueMessage = "She's even faster now!";
    showClueMessage = true;
    displayClueMessage(clueMessage);
    setTimeout(function() {
      showClueMessage = false;
      hideClueMessage();
    }, 3000);
  }

  // update granny countdown timer
  if (!grannySpawned) {
    grannyTimer--;
    // update timer display
    let secondsLeft = Math.ceil(grannyTimer / 60);
    if (secondsLeft < 0) secondsLeft = 0;
    document.getElementById('grannyTimer').innerHTML = '0:' + (secondsLeft < 10 ? '0' : '') + secondsLeft;
    
    // spawn granny when timer hits 0
    if (grannyTimer <= 0) {
      spawnGranny();
      document.getElementById('grannyTimer').innerHTML = 'Granny has spawned. She might help you escape. Go find her.';
      document.getElementById('grannyTimer').style.color = '#00ff00';
    }
  }
  
  // update granny if spawned
  if (grannySpawned) {
    updateGranny();
  }

  // update enemy AI
  updateEnemy();

  // check if player is near any hiding spots
  nearHidingSpot = null;
  if (hidingSpot1) {
    let hs1Pos = hidingSpot1.getPosition();
    if (dist(playerPos.x, playerPos.z, hs1Pos.x, hs1Pos.z) < 2) {
      nearHidingSpot = hidingSpot1;
    }
  }
  if (hidingSpot2) {
    let hs2Pos = hidingSpot2.getPosition();
    if (dist(playerPos.x, playerPos.z, hs2Pos.x, hs2Pos.z) < 2) {
      nearHidingSpot = hidingSpot2;
    }
  }
  if (hidingSpot3) {
    let hs3Pos = hidingSpot3.getPosition();
    if (dist(playerPos.x, playerPos.z, hs3Pos.x, hs3Pos.z) < 2) {
      nearHidingSpot = hidingSpot3;
    }
  }

  // update exit door color (red = no keys, yellow = 1 key, green = both keys)
  if (exitDoor) {
    if (playerHasGoldKey && playerHasSilverKey) {
      exitDoor.setColor(0, 139, 0);
    } else if (playerHasGoldKey || playerHasSilverKey) {
      exitDoor.setColor(139, 139, 0);
    } else {
      exitDoor.setColor(139, 0, 0);
    }
  }

  // movement controls (can't move when hiding)
  if (!playerIsHiding) {
    if (keyIsDown(87)) {
      let objectAhead = sensor.getEntityInDirection('forward');
      let okToMove = true;
      if (objectAhead && objectAhead.distance < 0.35 && objectAhead.object.el.object3D.userData.solid) {
        okToMove = false;
      }
      if (okToMove) {
        world.moveUserForward(MOVE_STEP);
      }
    }

    if (keyIsDown(83)) {
      let objectAhead = sensor.getEntityInDirection('backward');
      let okToMove = true;
      if (objectAhead && objectAhead.distance < 0.35 && objectAhead.object.el.object3D.userData.solid) {
        okToMove = false;
      }
      if (okToMove) {
        world.moveUserBackward(MOVE_STEP);
      }
    }

    if (keyIsDown(65)) {
      let objectAhead = sensor.getEntityInDirection('left');
      let okToMove = true;
      if (objectAhead && objectAhead.distance < 0.35 && objectAhead.object.el.object3D.userData.solid) {
        okToMove = false;
      }
      if (okToMove) {
        world.moveUserLeft(MOVE_STEP);
      }
    }

    if (keyIsDown(68)) {
      let objectAhead = sensor.getEntityInDirection('right');
      let okToMove = true;
      if (objectAhead && objectAhead.distance < 0.35 && objectAhead.object.el.object3D.userData.solid) {
        okToMove = false;
      }
      if (okToMove) {
        world.moveUserRight(MOVE_STEP);
      }
    }
  }

  // H key - hide/unhide in closets
  if (keyIsDown(72) && !hPressed) {
    hPressed = true;
    if (playerIsHiding) {
      playerIsHiding = false;
      clueMessage = "You left the hiding spot.";
      showClueMessage = true;
      displayClueMessage(clueMessage);
      setTimeout(function() {
        showClueMessage = false;
        hideClueMessage();
      }, 1500);
    } else if (nearHidingSpot) {
      playerIsHiding = true;
      clueMessage = "You're hiding. Press H to exit.";
      showClueMessage = true;
      displayClueMessage(clueMessage);
      setTimeout(function() {
        showClueMessage = false;
        hideClueMessage();
      }, 2000);
    }
  } else if (!keyIsDown(72)) {
    hPressed = false;
  }

  // R key - restart game
  if (keyIsDown(82) && !rPressed) {
    rPressed = true;
    restartGame();
  } else if (!keyIsDown(82)) {
    rPressed = false;
  }

  // M key - go to main menu
  if (keyIsDown(77) && !mPressed) {
    mPressed = true;
    stopAllSounds();
    showMainMenu();
    gameState = 'menu';
    gameStarted = false;
  } else if (!keyIsDown(77)) {
    mPressed = false;
  }

  // ESC key - pause/unpause
  if (keyIsDown(27) && !escPressed) {
    escPressed = true;
    if (gameState === 'playing') {
      showOptionsMenu();
    } else if (gameState === 'paused') {
      hideAllMenus();
      gameState = 'playing';
      startBackgroundMusic();
    }
  } else if (!keyIsDown(27)) {
    escPressed = false;
  }

  // Q key - drop trap
  if (keyIsDown(81) && !qPressed) {
    qPressed = true;
    if (playerTrapCount > 0 && !droppedTrap) {
      // create visible trap model
      droppedTrap = new AFrameP5.GLTF({
        asset: 'trapModel',
        x: playerPos.x,
        y: 0,
        z: playerPos.z,
        scaleX: 0.4,
        scaleY: 0.4,
        scaleZ: 0.4
      });
      world.add(droppedTrap);
      allGameEntities.push(droppedTrap);
      
      // create invisible collision box (enemy hits this)
      droppedTrapCollider = new AFrameP5.Box({
        x: playerPos.x,
        y: 0.2,
        z: playerPos.z,
        width: 1.0,
        height: 0.4,
        depth: 1.0,
        red: 0,
        green: 0,
        blue: 0,
        opacity: 0,
        transparent: true
      });
      world.add(droppedTrapCollider);
      allGameEntities.push(droppedTrapCollider);
      
      playerTrapCount--;
      if (playerTrapCount > 0) {
        document.getElementById('trapIndicator').innerHTML = 'TRAPS: ' + playerTrapCount + ' [Q to drop]';
      } else {
        document.getElementById('trapIndicator').style.display = 'none';
      }
      
      clueMessage = "Trap placed!";
      showClueMessage = true;
      displayClueMessage(clueMessage);
      setTimeout(function() {
        showClueMessage = false;
        hideClueMessage();
      }, 2000);
    }
  } else if (!keyIsDown(81)) {
    qPressed = false;
  }

  // E key - interact with keys, doors, clues, traps
  if (keyIsDown(69) && !ePressed) {
    ePressed = true;

    // bronze key pickup
    if (!playerHasBronzeKey && bronzeKey) {
      let keyPos = bronzeKey.getPosition();
      let distToKey = dist(playerPos.x, playerPos.z, keyPos.x, keyPos.z);
      if (distToKey < 2) {
        playerHasBronzeKey = true;
        world.remove(bronzeKey);
        bronzeKey = null;
        updateKeyIndicator();
        clueMessage = "Bronze key found! Opens the locked room.";
        showClueMessage = true;
        displayClueMessage(clueMessage);
        setTimeout(function() {
          showClueMessage = false;
          hideClueMessage();
        }, 3000);
      }
    }

    // gold key pickup
    if (!playerHasGoldKey && goldKey) {
      let keyPos = goldKey.getPosition();
      let distToKey = dist(playerPos.x, playerPos.z, keyPos.x, keyPos.z);
      if (distToKey < 2) {
        playerHasGoldKey = true;
        world.remove(goldKey);
        goldKey = null;
        updateKeyIndicator();
        clueMessage = "Gold key found! Find the silver key too.";
        showClueMessage = true;
        displayClueMessage(clueMessage);
        setTimeout(function() {
          showClueMessage = false;
          hideClueMessage();
        }, 3000);
      }
    }

    // silver key pickup
    if (!playerHasSilverKey && silverKey) {
      let keyPos = silverKey.getPosition();
      let distToKey = dist(playerPos.x, playerPos.z, keyPos.x, keyPos.z);
      if (distToKey < 2) {
        playerHasSilverKey = true;
        world.remove(silverKey);
        silverKey = null;
        updateKeyIndicator();
        if (playerHasGoldKey) {
          clueMessage = "Silver key found! Both keys acquired!";
        } else {
          clueMessage = "Silver key found! Find the gold key too.";
        }
        showClueMessage = true;
        displayClueMessage(clueMessage);
        setTimeout(function() {
          showClueMessage = false;
          hideClueMessage();
        }, 3000);
      }
    }

    // locked room door (need bronze key)
    if (lockedRoomDoor && !lockedRoomOpen) {
      let distToDoor = dist(playerPos.x, playerPos.z, LOCKED_ROOM_DOOR_X, LOCKED_ROOM_DOOR_Z);
      if (distToDoor < 3) {
        if (playerHasBronzeKey) {
          lockedRoomOpen = true;
          // Remove door model
          world.remove(lockedRoomDoor);
          lockedRoomDoor = null;
          // Remove collider
          if (lockedRoomDoorCollider) {
            lockedRoomDoorCollider.tag.object3D.userData.solid = false;
            world.remove(lockedRoomDoorCollider);
            lockedRoomDoorCollider = null;
          }
          clueMessage = "Door unlocked! The gold key is inside.";
          showClueMessage = true;
          displayClueMessage(clueMessage);
          setTimeout(function() {
            showClueMessage = false;
            hideClueMessage();
          }, 3000);
        } else {
          clueMessage = "This door is locked. Find the bronze key.";
          showClueMessage = true;
          displayClueMessage(clueMessage);
          setTimeout(function() {
            showClueMessage = false;
            hideClueMessage();
          }, 3000);
        }
      }
    }

    // clue note 1
    if (clueNote1 && !clueNote1Read) {
      let notePos = clueNote1.getPosition();
      let distToNote = dist(playerPos.x, playerPos.z, notePos.x, notePos.z);
      if (distToNote < 2) {
        clueNote1Read = true;
        clueMessage = "'Three keys total. Bronze opens the room, gold and silver open the exit.'";
        showClueMessage = true;
        displayClueMessage(clueMessage);
        setTimeout(function() {
          showClueMessage = false;
          hideClueMessage();
        }, 5000);
      }
    }

    // clue note 2
    if (clueNote2 && !clueNote2Read) {
      let notePos = clueNote2.getPosition();
      let distToNote = dist(playerPos.x, playerPos.z, notePos.x, notePos.z);
      if (distToNote < 2) {
        clueNote2Read = true;
        clueMessage = "'Hide in the closets when she comes. Press H. But don't leave while she's checking!'";
        showClueMessage = true;
        displayClueMessage(clueMessage);
        setTimeout(function() {
          showClueMessage = false;
          hideClueMessage();
        }, 5000);
      }
    }

    // clue note 3
    if (clueNote3 && !clueNote3Read) {
      let notePos = clueNote3.getPosition();
      let distToNote = dist(playerPos.x, playerPos.z, notePos.x, notePos.z);
      if (distToNote < 2) {
        clueNote3Read = true;
        clueMessage = "'Two traps are hidden. Use them wisely - she fears them.'";
        showClueMessage = true;
        displayClueMessage(clueMessage);
        setTimeout(function() {
          showClueMessage = false;
          hideClueMessage();
        }, 5000);
      }
    }

    // trap pickup 1
    if (trapPickup1) {
      let trapPos = trapPickup1.getPosition();
      let distToTrap = dist(playerPos.x, playerPos.z, trapPos.x, trapPos.z);
      if (distToTrap < 2) {
        playerTrapCount++;
        world.remove(trapPickup1);
        trapPickup1 = null;
        document.getElementById('trapIndicator').style.display = 'block';
        document.getElementById('trapIndicator').innerHTML = 'TRAPS: ' + playerTrapCount + ' [Q to drop]';
        clueMessage = "Trap acquired! Press Q to drop it.";
        showClueMessage = true;
        displayClueMessage(clueMessage);
        setTimeout(function() {
          showClueMessage = false;
          hideClueMessage();
        }, 3000);
      }
    }

    // trap pickup 2
    if (trapPickup2) {
      let trapPos = trapPickup2.getPosition();
      let distToTrap = dist(playerPos.x, playerPos.z, trapPos.x, trapPos.z);
      if (distToTrap < 2) {
        playerTrapCount++;
        world.remove(trapPickup2);
        trapPickup2 = null;
        document.getElementById('trapIndicator').style.display = 'block';
        document.getElementById('trapIndicator').innerHTML = 'TRAPS: ' + playerTrapCount + ' [Q to drop]';
        clueMessage = "Trap acquired! Press Q to drop it.";
        showClueMessage = true;
        displayClueMessage(clueMessage);
        setTimeout(function() {
          showClueMessage = false;
          hideClueMessage();
        }, 3000);
      }
    }

    // exit door (need both gold and silver keys)
    if (exitDoor) {
      let distToDoor = dist(playerPos.x, playerPos.z, EXIT_DOOR_X, EXIT_DOOR_Z);
      if (distToDoor < 2) {
        if (playerHasGoldKey && playerHasSilverKey) {
          showWinScreen();
        } else if (playerHasGoldKey || playerHasSilverKey) {
          clueMessage = "You need both gold and silver keys!";
          showClueMessage = true;
          displayClueMessage(clueMessage);
          setTimeout(function() {
            showClueMessage = false;
            hideClueMessage();
          }, 3000);
        } else {
          clueMessage = "The exit is locked. Find both keys!";
          showClueMessage = true;
          displayClueMessage(clueMessage);
          setTimeout(function() {
            showClueMessage = false;
            hideClueMessage();
          }, 3000);
        }
      }
    }

  } else if (!keyIsDown(69)) {
    ePressed = false;
  }

  // update clue message display
  if (showClueMessage) {
    displayClueMessage(clueMessage);
  } else {
    hideClueMessage();
  }
}

