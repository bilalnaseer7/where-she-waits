# where-she-waits
First-person horror escape game built with AFrameP5, featuring stealth, AI enemies, and environmental puzzles.

# Where She Waits

**Where She Waits** is a first-person horror escape game inspired by the mobile game *Granny*. The player wakes up trapped inside a dark, abandoned house with no memory of how they got there. Somewhere in the shadows, a zombie patrols the halls, hunting for anyone who wanders too far. The goal is simple: find the hidden keys, unlock the exit door, and escape before she finds you.

The game focuses on tension and atmosphere rather than jump scares or gore. Fear comes from limited visibility, sound cues, and the constant uncertainty of where the enemy might be.

## Gameplay Overview
- Explore a single haunted house environment
- Collect keys hidden throughout the house
- Avoid or outmaneuver a patrolling enemy
- Use hiding spots and traps strategically
- Escape before being caught

A twist occurs partway through the game when a character named Granny spawns. The player is told she may help them escape, but approaching her results in instant death, revealing a darkly humorous bait-and-switch.

## Mechanics and Systems
- **Movement:** First-person WASD movement with mouse look
- **Collision Detection:** Custom sensor-based raycasting prevents walking through walls
- **Key System:** Bronze, Silver, and Gold keys unlock progression and the exit door
- **Enemy AI:** Waypoint patrol with line-of-sight detection and chase behavior
- **Hiding System:** Closets allow hiding, but the enemy remembers last known locations
- **Traps:** Deployable traps freeze the enemy temporarily
- **Difficulty Scaling:** Enemy speed increases over time
- **Sound Design:** Distance-based proximity audio, background music, win and lose sounds
- **UI:** Key counter, trap counter, countdown timer, and contextual messages

## Technology
- **AFrameP5** for 3D rendering and world building
- **p5.js** for game logic and interactivity
- **Three.js Raycaster** for enemy vision and collision detection

## Development Process
The project was developed in stages:
1. Environment setup, movement, and collision
2. Pickups, UI, and menu systems
3. Enemy AI and patrol logic
4. Expanded level design, hiding spots, traps, and sound
5. Randomized spawning and the Granny troll mechanic

One of the biggest challenges was implementing a reliable random spawn system that ensured all items were reachable. Another challenge involved handling restart logic without duplicating world entities.

## Reflections
The most challenging aspects were spawn logic and enemy behavior tuning. One design decision I am especially happy with is the hiding mechanic, which prevents hiding from being a guaranteed escape and forces strategic decision-making.

## Future Improvements
- Larger environments and multi-floor layouts
- Additional enemy types with unique behaviors
- Expanded trap system
- Difficulty selection
- Visual and environmental polish

## Live Demo
https://bilalnaseer7.github.io/where-she-waits/
