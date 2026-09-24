declare module 'obj2gltf' {
  type Options = { binary?: boolean; checkTransparency?: boolean; doubleSidedMaterial?: boolean }
  export default function obj2gltf(objPath: string, options?: Options): Promise<Buffer>
}
