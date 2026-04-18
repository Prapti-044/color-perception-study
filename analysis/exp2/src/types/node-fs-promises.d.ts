declare module 'node:fs/promises' {
	export function readFile(path: string, encoding: 'utf-8'): Promise<string>;
}
