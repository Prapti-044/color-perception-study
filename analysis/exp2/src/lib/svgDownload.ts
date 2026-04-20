export function downloadSvgString(svgMarkup: string, filename: string): void {
	const name = filename.endsWith('.svg') ? filename : `${filename}.svg`;
	const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function serializeSvgElement(svg: SVGSVGElement): string {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	if (!clone.getAttribute('xmlns')) {
		clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	}
	return new XMLSerializer().serializeToString(clone);
}

export function downloadSvgElement(svg: SVGSVGElement, filename: string): void {
	downloadSvgString(serializeSvgElement(svg), filename);
}
