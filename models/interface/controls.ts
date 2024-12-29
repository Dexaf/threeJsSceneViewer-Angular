import { IVector2, IVector3 } from "./vectors";

export interface IControls {
  target: IVector3,
  enableDamping: boolean,
  enablePan: boolean,
  dampingFactor: number,
  distance: IVector2,
  minPolarAngle?: number
  maxPolarAngle?: number
}