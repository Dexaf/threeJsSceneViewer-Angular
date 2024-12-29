import { IVector2, IVector3, IVector4 } from "./vectors";

export interface ILight {
  type: "AmbientLight" | "DirectionalLight" | "SpotLight",
  color: number,
  intensity: number,
  castShadow?: boolean,
  mapSize?: IVector2,
  distances?: IVector2,
  cameraClippingPlane?: IVector4,
  normalBias?: number,
  position?: IVector3
}