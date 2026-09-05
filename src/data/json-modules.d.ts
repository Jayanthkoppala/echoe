// Ambient module so routes.json can be imported without needing
// "resolveJsonModule" in the shared tsconfig.json (out of scope for this
// module's edits).
declare module '*.json' {
  const value: any;
  export default value;
}
