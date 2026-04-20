<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';
	import { downloadSvgString } from '$lib/svgDownload';
	import {
		buildEllipsoidModelFromThresholdMeans,
		MAX_LOCATION_BY_VECTOR,
		RECOVERED_AXIS_LIST
	} from '$lib/colorVisionMath.js';

	type WorkedExample = {
		thresholdMeans: Record<number, number>;
	};
	type ThresholdState = Record<1 | 2 | 3 | 4, number>;

	let { workedExample }: { workedExample: WorkedExample } = $props();

	const POINT_COLORS = {
		blue: '#9156e7',
		lightness: '#f59e0b',
		magenta: '#d33685',
		pink: '#da325c'
	};
	const prettyName = new Map(
		RECOVERED_AXIS_LIST.map((axis) => [axis.vector, axis.name[0].toUpperCase() + axis.name.slice(1)])
	);
	let ellipsoidHost: HTMLDivElement | undefined = $state();
	let thresholds = $state<ThresholdState>({
		1: 0,
		2: 0,
		3: 0,
		4: 0
	});

	$effect(() => {
		thresholds = {
			1: workedExample.thresholdMeans[1],
			2: workedExample.thresholdMeans[2],
			3: workedExample.thresholdMeans[3],
			4: workedExample.thresholdMeans[4]
		};
	});

	const model = $derived(buildEllipsoidModelFromThresholdMeans(thresholds));
	const chromaticPoints = $derived(
		model
			? RECOVERED_AXIS_LIST.filter((axis) => axis.vector !== 4).map((axis) => ({
					name: axis.name,
					u: axis.unitUv[0] * model.chromaticRadii[axis.name as 'pink' | 'magenta' | 'blue'],
					v: axis.unitUv[1] * model.chromaticRadii[axis.name as 'pink' | 'magenta' | 'blue']
				}))
			: []
	);
	const ellipsoidPoints = $derived(
		model
			? [
					...chromaticPoints.map((point) => ({
						color: POINT_COLORS[point.name as keyof typeof POINT_COLORS],
						label: point.name,
						x: point.u,
						y: 0,
						z: point.v
					})),
					{
						color: POINT_COLORS.lightness,
						label: 'lighter',
						x: 0,
						y: model.lightness,
						z: 0
					},
					{
						color: '#94a3b8',
						label: 'mirrored lightness',
						x: 0,
						y: -model.lightness,
						z: 0
					}
				]
			: []
	);

	let scene: any;
	let camera: any;
	let renderer: any;
	let controls: any;
	let animationFrame = 0;
	let ellipsoidGroup: any;
	let sceneReady = $state(false);

	function setRendererSize() {
		if (!ellipsoidHost || !renderer || !camera) {
			return;
		}

		const widthPx = Math.max(260, ellipsoidHost.clientWidth || 420);
		const heightPx = Math.max(260, ellipsoidHost.clientHeight || 320);

		renderer.setSize(widthPx, heightPx, false);
		camera.aspect = widthPx / heightPx;
		camera.updateProjectionMatrix();
	}

	function buildAxisLine(
		start: any,
		end: any,
		color: string
	) {
		const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);

		return new THREE.Line(
			geometry,
			new THREE.LineBasicMaterial({
				color,
				transparent: true,
				opacity: 0.95
			})
		);
	}

	function rebuildEllipsoidScene() {
		if (!scene) {
			return;
		}

		if (ellipsoidGroup) {
			scene.remove(ellipsoidGroup);
		}

		ellipsoidGroup = new THREE.Group();
		scene.add(ellipsoidGroup);

		if (!model) {
			return;
		}

		const extent = Math.max(model.ellipse.major, model.ellipse.minor, model.lightness, 8);
		const grid = new THREE.GridHelper(extent * 3, 12, 0xcbd5e1, 0xe2e8f0);

		grid.position.y = 0;
		ellipsoidGroup.add(grid);
		ellipsoidGroup.add(
			buildAxisLine(new THREE.Vector3(-extent * 1.8, 0, 0), new THREE.Vector3(extent * 1.8, 0, 0), '#0f766e')
		);
		ellipsoidGroup.add(
			buildAxisLine(new THREE.Vector3(0, -extent * 1.8, 0), new THREE.Vector3(0, extent * 1.8, 0), '#334155')
		);
		ellipsoidGroup.add(
			buildAxisLine(new THREE.Vector3(0, 0, -extent * 1.8), new THREE.Vector3(0, 0, extent * 1.8), '#d55e00')
		);

		const ellipsoidMesh = new THREE.Mesh(
			new THREE.SphereGeometry(1, 56, 40),
			new THREE.MeshPhongMaterial({
				color: 0x0f766e,
				transparent: true,
				opacity: 0.2,
				shininess: 70,
				side: THREE.DoubleSide
			})
		);

		ellipsoidMesh.scale.set(model.ellipse.major, model.lightness, model.ellipse.minor);
		ellipsoidMesh.rotation.y = model.ellipse.rotation;
		ellipsoidGroup.add(ellipsoidMesh);

		const wireframe = new THREE.LineSegments(
			new THREE.EdgesGeometry(new THREE.SphereGeometry(1, 28, 18)),
			new THREE.LineBasicMaterial({
				color: 0x0f172a,
				transparent: true,
				opacity: 0.45
			})
		);

		wireframe.scale.copy(ellipsoidMesh.scale);
		wireframe.rotation.copy(ellipsoidMesh.rotation);
		ellipsoidGroup.add(wireframe);

		for (const point of ellipsoidPoints) {
			const position = new THREE.Vector3(point.x, point.y, point.z);
			const stem = buildAxisLine(new THREE.Vector3(0, 0, 0), position, point.color);
			const marker = new THREE.Mesh(
				new THREE.SphereGeometry(point.label === 'mirrored lightness' ? 0.32 : 0.38, 24, 24),
				new THREE.MeshStandardMaterial({
					color: new THREE.Color(point.color),
					emissive: new THREE.Color(point.color),
					emissiveIntensity: point.label === 'mirrored lightness' ? 0.08 : 0.18,
					metalness: 0.1,
					roughness: 0.35,
					transparent: point.label === 'mirrored lightness',
					opacity: point.label === 'mirrored lightness' ? 0.55 : 1
				})
			);

			marker.position.copy(position);
			ellipsoidGroup.add(stem);
			ellipsoidGroup.add(marker);
		}
	}

	$effect(() => {
		if (!sceneReady) {
			return;
		}

		rebuildEllipsoidScene();
	});

	onMount(() => {
		if (!ellipsoidHost) {
			return;
		}

		scene = new THREE.Scene();
		scene.background = new THREE.Color('#f8fafc');

		camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
		camera.position.set(22, 18, 22);

		renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		ellipsoidHost.appendChild(renderer.domElement);

		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.enablePan = true;
		controls.screenSpacePanning = true;
		controls.target.set(0, 0, 0);

		scene.add(new THREE.AmbientLight(0xffffff, 1.15));

		const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
		keyLight.position.set(16, 24, 14);
		scene.add(keyLight);

		const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
		fillLight.position.set(-10, 8, -18);
		scene.add(fillLight);

		setRendererSize();
		sceneReady = true;

		const resizeObserver = new ResizeObserver(() => {
			setRendererSize();
		});
		resizeObserver.observe(ellipsoidHost);

		const animate = () => {
			animationFrame = window.requestAnimationFrame(animate);
			controls?.update();
			renderer?.render(scene!, camera!);
		};

		animate();

		return () => {
			window.cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			controls?.dispose();
			renderer?.dispose();
			renderer?.domElement.remove();
			sceneReady = false;
		};
	});

	function updateThreshold(vector: 1 | 2 | 3 | 4, value: string) {
		thresholds = {
			...thresholds,
			[vector]: Number(value)
		};
	}

	function downloadSvgSnapshot() {
		if (!scene || !camera) {
			return;
		}

		const exportW = 1200;
		const exportH = 900;
		const svgRenderer = new SVGRenderer();
		svgRenderer.setSize(exportW, exportH);

		const exportCam = camera.clone() as {
			aspect: number;
			updateProjectionMatrix: () => void;
		};
		exportCam.aspect = exportW / exportH;
		exportCam.updateProjectionMatrix();

		svgRenderer.render(scene, exportCam);
		downloadSvgString(svgRenderer.domElement.outerHTML, 'volume-simulator-3d.svg');
	}
</script>

<div class="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm">
	<p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Volume simulator</p>
	<h3 class="mt-1 font-display text-2xl font-semibold text-slate-950">
		Thresholds, ellipse, and ellipsoid
	</h3>
	<p class="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
		Adjust the recovered thresholds for the four vectors. The chromatic fit updates immediately,
		the semiaxes update, and the ellipsoid volume recomputes from `V = 4/3πabc`.
	</p>

	<div class="mt-6 grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
		<div class="space-y-4">
			{#each RECOVERED_AXIS_LIST as axis}
				<label class="block rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
					<div class="flex items-center justify-between gap-3">
						<span class="font-semibold text-slate-800">{prettyName.get(axis.vector)}</span>
						<span class="font-mono text-sm text-slate-600">
							{thresholds[axis.vector].toFixed(1)} / {MAX_LOCATION_BY_VECTOR[axis.vector]}
						</span>
					</div>
					<input
						class="mt-3 w-full accent-teal-600"
						type="range"
						min="1"
						max={MAX_LOCATION_BY_VECTOR[axis.vector]}
						step="0.5"
						value={thresholds[axis.vector]}
						oninput={(event) =>
							updateThreshold(
								axis.vector as 1 | 2 | 3 | 4,
								(event.currentTarget as HTMLInputElement).value
							)}
					/>
				</label>
			{/each}

			{#if model}
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="rounded-2xl border border-slate-200 bg-white p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Semiaxes</p>
						<p class="mt-3 text-sm text-slate-700">a = {model.ellipse.major.toFixed(2)}</p>
						<p class="text-sm text-slate-700">b = {model.ellipse.minor.toFixed(2)}</p>
						<p class="text-sm text-slate-700">c = {model.lightness.toFixed(2)}</p>
					</div>

					<div class="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-50">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Volume</p>
						<p class="mt-3 font-mono text-2xl font-semibold">{model.volume.toFixed(1)}</p>
						<p class="mt-2 text-sm text-slate-400">reconstructed units³</p>
					</div>
				</div>
			{/if}
		</div>

		<div>
			<div class="rounded-3xl border border-slate-200/80 bg-slate-50/60 p-4">
				<p class="text-sm font-semibold text-slate-800">Interactive 3D ellipsoid</p>
				<p class="mt-2 text-sm leading-relaxed text-slate-600">
					Drag to orbit, scroll to zoom, and pan to inspect the ellipsoid in 3D. Chromatic points lie in
					the `u*–v*` plane, while the lightness point extends along the vertical axis.
				</p>
				<div class="mt-2 flex justify-end">
					<button
						type="button"
						class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
						onclick={downloadSvgSnapshot}>Download SVG (vector snapshot)</button
					>
				</div>
				<div
					bind:this={ellipsoidHost}
					class="mt-4 h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
					role="img"
					aria-label="Interactive 3D ellipsoid with recovered threshold points"
				></div>
				<div class="mt-3 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
					<span class="flex items-center gap-2">
						<span class="h-2.5 w-2.5 rounded-full bg-[#da325c]"></span> Pink
					</span>
					<span class="flex items-center gap-2">
						<span class="h-2.5 w-2.5 rounded-full bg-[#d33685]"></span> Magenta
					</span>
					<span class="flex items-center gap-2">
						<span class="h-2.5 w-2.5 rounded-full bg-[#9156e7]"></span> Blue
					</span>
					<span class="flex items-center gap-2">
						<span class="h-2.5 w-2.5 rounded-full bg-[#f59e0b]"></span> Lightness
					</span>
				</div>
			</div>
		</div>
	</div>
</div>
