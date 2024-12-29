import { IVector2, IVector3 } from "./vectors"

export interface IWater {
  planeSize: IVector2,
  textureSize: IVector2,
  position: IVector3,
  rotation: IVector3,
  distortionScale: number,
  sunColor: number,
  waterColor: number,
  speed: number,
  textureFileName: string
}