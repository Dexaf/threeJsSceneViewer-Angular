import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from "@angular/core";
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from '../../utils/threeJs/OrbitControls.js';
// @ts-ignore
import { GLTFLoader } from '../../utils/threeJs/GLTFLoader.js'
// @ts-ignore
import { Water } from '../../utils/threeJs/Water.js'
import { LoadingBarComponent } from "../loadingBar/loadingBar.component.js";
import { IWater } from "../../../models/interface/water.js";
import { ILight } from "../../../models/interface/lights.js";
import { IVector2, IVector3 } from "../../../models/interface/vectors.js";
import { IControls } from "../../../models/interface/controls.js";

@Component({
  selector: 'threeD-scene-viewer',
  templateUrl: './threeDSceneViewer.component.html',
  imports: [LoadingBarComponent],
  styleUrl: './threeDSceneViewer.component.css'
})
export class ThreeDSceneViewerComponent implements OnChanges, AfterViewInit {
  @Input() assetsRoot: string = "";
  @Input() sceneLabel: string = "";
  @Input() sceneFolderName: string = "";
  @Input() sceneName: string = "";
  @Input() cameraPosition!: IVector3;
  @Input() cameraRenderDistances: IVector2 = { x: 0.1, y: 5000 };
  @Input() controlsData!: IControls;
  @Input() watersData: IWater[] = [];
  @Input() lightsData: ILight[] = [];
  @Input() shadowReceiver: string[] = [];
  @Input() objWithAlpha: string[] = [];
  @Input() skyboxFolder: string = "ND";
  @Input() hasAudio = false;
  @Input() audioVolume = 0.5;
  @Input() isPlaying: boolean = false;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Output() onLoading = new EventEmitter();
  @Output() onLoadAudio = new EventEmitter();
  @Output() onLoadScene = new EventEmitter();

  private _renderer!: THREE.WebGLRenderer;
  private _scene = new THREE.Scene();
  private _camera!: THREE.PerspectiveCamera;
  private _controls!: OrbitControls;
  private _clock = new THREE.Clock();
  private _waters: Water[] = [];
  private _mixer!: THREE.AnimationMixer;
  private _listener!: THREE.AudioListener;
  private _sound: THREE.Audio | null = null;
  private _audioLoader!: THREE.AudioLoader;
  private _animationId!: number;

  gotDestroyed: boolean = false;
  loadingProgressPercentage: number = 0;
  isLoading: boolean = true;
  sceneHasError: boolean = false;
  resizeObserver: ResizeObserver;
  isMuted: boolean = false;
  isFullscreen: boolean = false;

  constructor() {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = window.innerHeight * (this.isFullscreen ? 1 : 0.6);
        this._renderer.setSize(width, height, false);
        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();
      }
    });
  }

  // Lifecycle Methods
  // Goes off on switch input and in first play
  // (first play doesn't trigger after view on init)
  ngOnChanges(): void {
    if (this.isPlaying && this.canvasRef)
      this._initSceneRoutine();
  }

  // Goes off on switch page after first play
  ngAfterViewInit(): void {
    if (this.isPlaying && this.canvasRef)
      this._initSceneRoutine();
  }

  ngOnDestroy(): void {
    this.gotDestroyed = true;
    this._disposeSceneMedia();
    if (this.canvasRef.nativeElement) this.canvasRef.nativeElement.remove();
    this.resizeObserver.disconnect();
  }

  // Public Methods
  playScene() {
    // NOTE - from here we have to change the isPlaying input from outside to trigger
    //        ngOnChange, a bit tricky but goddamnit it's 21:41 of sunday
    this.onLoading.emit();
  }

  toggleMute(): void {
    if (this._sound) {
      this.isMuted = !this.isMuted;
      this._sound.setVolume(this.isMuted ? 0 : this.audioVolume);
    }
  }

  toggleFullscreen(): void {
    const canvasContainer = document.getElementById("canvas-container");
    if (!canvasContainer) return;

    if (!this.isFullscreen) {
      if (canvasContainer.requestFullscreen) {
        canvasContainer.requestFullscreen();
      } else if ((canvasContainer as any).mozRequestFullScreen) {
        (canvasContainer as any).mozRequestFullScreen();
      } else if ((canvasContainer as any).webkitRequestFullscreen) {
        (canvasContainer as any).webkitRequestFullscreen();
      } else if ((canvasContainer as any).msRequestFullscreen) {
        (canvasContainer as any).msRequestFullscreen();
      }
      this.isFullscreen = true;
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      this.isFullscreen = false;
    }
  }

  // Private Methods
  private _initSceneRoutine() {
    this.isMuted = !this.hasAudio;
    this.isFullscreen = false;
    this._setLoaders();
    this._disposeSceneMedia();
    this._main(this.canvasRef.nativeElement);
  }

  private _disposeSceneMedia() {
    cancelAnimationFrame(this._animationId);
    this._controls?.dispose();
    this._renderer?.dispose();
    this._listener?.clear();
    if (this._sound) {
      this._sound.stop();
      this._sound.disconnect();
      this._sound = null;
    }

    this._waters = [];
    while (this._scene.children.length > 0) {
      const object = this._scene.children[0];
      this._scene.remove(object);
    }
  }

  private async _setLoaders() {
    this.loadingProgressPercentage = 0;
    this.isLoading = true;
  }

  private async _main(canvas: HTMLCanvasElement) {
    try {
      this.onLoading.emit();
      this._initializeCamera();
      this._initializeRenderer(canvas);
      this._initializeControls();
      this._initializeLights();
      this._loadGLTFScene();
      this._initializeWaters();
      this._initializeSkybox();
      this._setDynamicResizer();
      this._renderer.setAnimationLoop(this._animate.bind(this));
    } catch (error) {
      this.sceneHasError = true;
    }
  }

  private _initializeCamera() {
    this._camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, this.cameraRenderDistances.x, this.cameraRenderDistances.y);
    this._camera.position.set(this.cameraPosition.x ?? 0, this.cameraPosition.y ?? 0, this.cameraPosition.z ?? 0);
  }

  private _initializeRenderer(canvas: HTMLCanvasElement) {
    this._renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    this._renderer.shadowMap.enabled = true;
  }

  private async _initializeControls() {
    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.target.set(
      this.controlsData.target?.x ?? 0,
      this.controlsData.target?.y ?? 0,
      this.controlsData.target?.z ?? 0
    );
    this._controls.enableDamping = this.controlsData.enableDamping ?? false;
    this._controls.dampingFactor = this.controlsData.dampingFactor ?? 0.1;
    this._controls.enablePan = this.controlsData.enablePan ?? true;
    this._controls.minDistance = this.controlsData.distance?.x ?? 1;
    this._controls.maxDistance = this.controlsData.distance?.y ?? 10;
    this._controls.minPolarAngle = this.controlsData.minPolarAngle ?? 0;
    this._controls.maxPolarAngle = this.controlsData.maxPolarAngle ?? Math.PI;
  }

  private async _initializeLights() {
    this.lightsData.forEach(lightData => {
      if (lightData.type === "AmbientLight") {
        this._scene.add(new THREE.AmbientLight(lightData.color, lightData.intensity));
      } else if (lightData.type === "SpotLight") {
        const light = new THREE.SpotLight(lightData.color, lightData.intensity);
        light.castShadow = lightData.castShadow ?? false;
        light.shadow.mapSize.width = lightData.mapSize?.x ?? 512;
        light.shadow.mapSize.height = lightData.mapSize?.y ?? 512;
        light.position.set(lightData.position?.x ?? 0, lightData.position?.y ?? 10, lightData.position?.z ?? 10);
        this._scene.add(light);

      } else if (lightData.type === "DirectionalLight") {
        const light = new THREE.DirectionalLight(lightData.color, lightData.intensity);
        light.castShadow = lightData.castShadow ?? false;
        light.shadow.mapSize.width = lightData.mapSize?.x ?? 512;
        light.shadow.mapSize.height = lightData.mapSize?.y ?? 512;
        light.shadow.camera.near = lightData.distances?.x ?? 0.1;
        light.shadow.camera.far = lightData.distances?.y ?? 2000;
        light.shadow.camera.top = lightData.cameraClippingPlane?.y ?? 1;
        light.shadow.camera.right = lightData.cameraClippingPlane?.y ?? 1;
        light.shadow.camera.bottom = lightData.cameraClippingPlane?.z ?? -1;
        light.shadow.camera.left = lightData.cameraClippingPlane?.x ?? -1;
        if (lightData.normalBias)
          light.shadow.normalBias = lightData.normalBias;
        light.position.set(lightData.position?.x ?? 0, lightData.position?.y ?? 10, lightData.position?.z ?? 10);
        this._scene.add(light);
      }
    });
  }

  private _loadGLTFScene() {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      // resource URL
      `${this.assetsRoot}/${this.sceneFolderName}/${this.sceneName}.gltf`,
      // called when the resource is loaded
      (gltf: any) => {
        this._scene.add(gltf.scene);
        gltf.scene.traverse((obj: any) => {
          if (obj.isMesh) {
            obj.castShadow = true;
          }

          //NOTE - wildcard
          if (this.shadowReceiver.includes("*"))
            obj.receiveShadow = true;
          else if (this.shadowReceiver.includes(obj.name))
            obj.receiveShadow = true;
          //TODO - implement add texture to alphatexture
          if (this.objWithAlpha.includes(obj.name))
            obj.material.alphaTest = 0.1;
        })

        gltf.animations;
        this._mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((clip: any) => {
          this._mixer.clipAction(clip).play();
        });
        this.onLoadScene.emit();
        setTimeout(() => {
          this.isLoading = false;
          //NOTE - we load this here to sync the audio with the scene
          this._initializeAudio();
        }, 1000)
      },
      // called while loading is progressing
      (xhr: any) => {
        this.loadingProgressPercentage = xhr.loaded / xhr.total * 100;
      },
      // called when loading has errors
      (error: any) => {
        this.sceneHasError = true;
        console.log(error);
      }
    );
  }

  private async _initializeAudio() {
    if (this.hasAudio) {
      this._listener = new THREE.AudioListener();
      this._camera.add(this._listener);
      this._sound = new THREE.Audio(this._listener);
      this._audioLoader = new THREE.AudioLoader();
      this._audioLoader.load(`${this.assetsRoot}/${this.sceneFolderName}/bgx.ogg`,
        buffer => {
          if (!this.gotDestroyed) {
            this._sound?.stop();
            this._sound?.setBuffer(buffer);
            this._sound?.setLoop(true);
            this._sound?.setVolume(this.audioVolume);
            this._sound?.play();
            this.onLoadAudio.emit();
          }
        }
      )
    }
  }

  private async _initializeWaters() {
    this.watersData.forEach(waterData => {
      const water = new Water(
        new THREE.PlaneGeometry(waterData.planeSize.x, waterData.planeSize.y, 256, 256),
        {
          textureWidth: waterData.textureSize.x,
          textureHeight: waterData.textureSize.y,
          waterNormals: new THREE.TextureLoader()
            .load(`${this.assetsRoot}/waterTextures/${waterData.textureFileName}`, function (texture) {
              texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
          sunDirection: new THREE.Vector3(),
          sunColor: waterData.sunColor,
          waterColor: waterData.waterColor,
          distortionScale: waterData.distortionScale,
          fog: this._scene.fog !== undefined
        }
      );
      water.rotation.x = waterData.rotation.x;
      water.rotation.y = waterData.rotation.y;
      water.rotation.z = waterData.rotation.z;
      water.position.x = waterData.position.x;
      water.position.y = waterData.position.y;
      water.position.z = waterData.position.z;
      this._waters.push(water);
      this._scene.add(water);
    })
  }

  private async _initializeSkybox() {
    if (this.skyboxFolder !== 'ND') {
      const CTloader = new THREE.CubeTextureLoader();
      CTloader.setPath(`${this.assetsRoot}/skybox/${this.skyboxFolder}/`);
      const textureCube = CTloader.load([
        'left.png', 'right.png',
        'top.png', 'bottom.png',
        'front.png', 'back.png',
      ]);
      this._scene.background = textureCube;
    }
  }

  private _setDynamicResizer() {
    const canvasContainer = document.getElementById("canvas-container");
    if (!canvasContainer) return;
    this.resizeObserver.observe(canvasContainer);
  }

  private _animate() {
    this._controls.update();
    const delta = this._clock.getDelta();
    if (this._mixer) this._mixer.update(delta);
    for (let index = 0; index < this._waters.length; index++) {
      const water = this._waters[index];
      water.material.uniforms['time'].value += (1.0 / 60.0) * (this.watersData[index]?.speed ?? 1);

    }
    this._renderer.render(this._scene, this._camera);
  }
}