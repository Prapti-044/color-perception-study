// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	var process: {
		cwd(): string;
	};

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'node:fs/promises' {
	export function readFile(path: string, encoding: 'utf-8'): Promise<string>;
}

declare module 'three';
declare module 'three/examples/jsm/controls/OrbitControls.js';

export {};
