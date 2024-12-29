#  THREE JS SCENE VIEWER - ANGULAR
The code in this repo is just a blueprint to handle some orbital gltf scenes in angular.
It could be better but as i'm not intersted in three js i'll update utilities only when i need them.
already used and it works, the only bug is that the audio callback overlap audio if you switch scene in the same instance of the component, either disable the input change during audio load or destroy and recreate the component.

## Used npm packages
you need to install the THREE npm packages

## USAGE
for the most basic start you just need 

the assetsRoot, sceneFolderName, sceneName which makes the path to GLTF to load the scene
and a control for the orbit camera, use this:

  controls: IControls = {
    target: { x: 0, y: 0, z: 0 },
    enableDamping: true,
    dampingFactor: 0.1,
    distance: { x: 0.1, y: 20 },
    enablePan: true
  }