declare module 'topojson-specification' {
  // Minimal subset of the official topojson-specification typings
  // to support this project’s usage.

  export interface GeometryCollection<P = any> {
    type: 'GeometryCollection';
    geometries: any[];
  }

  export interface Objects<P = any> {
    // Keys like "states" map to geometry collections or related objects.
    [key: string]: any;
  }

  export interface Topology<O extends Objects = Objects> {
    type: 'Topology';
    objects: O;
  }
}

