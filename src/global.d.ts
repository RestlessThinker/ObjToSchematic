declare module '*.vs';

declare module '*.fs';

declare module '*.png';
declare module '*.png?inline';
declare module '*.obj';
declare module '*.mtl';

declare module '*.atlas' {
    const atlas: string;
    export default atlas;
}

declare module '*.worker.ts' {
    export default {} as typeof Worker & (new () => Worker);
}
