// Colorblind-safe qualitative palette for all analytical plots.
//
// Uses the Okabe–Ito "Color Universal Design" palette, which is the de-facto
// standard for color-vision-deficiency (protanopia / deuteranopia / tritanopia)
// safe categorical encoding and is widely accepted for IEEE VIS submissions.
// Reference: Okabe & Ito (2008), https://jfly.uni-koeln.de/color/
//
// The palette is designed so that every pair of colors remains distinguishable
// under all common forms of color-vision deficiency, and it also reproduces well
// in grayscale print. Categorical distinctions in the plots are additionally
// reinforced with non-color channels (line style, marker shape) so figures remain
// readable even when printed in black and white.

export const OKABE_ITO = {
	black: '#000000',
	orange: '#E69F00',
	skyBlue: '#56B4E9',
	bluishGreen: '#009E73',
	yellow: '#F0E442',
	blue: '#0072B2',
	vermillion: '#D55E00',
	reddishPurple: '#CC79A7'
} as const;

export interface AxisColor {
	/** Strong hue used for the primary (current-study / expert) series. */
	main: string;
	/** Lighter tint of the same hue used for the secondary (reference / non-expert) series. */
	muted: string;
	/** Very light translucent fill of the same hue (bands, subtle backgrounds). */
	faint: string;
}

// Per-axis colors for the L*/a*/b* JND plots. Blue / vermillion / bluish-green
// is a maximally distinct, CVD-safe triple from the Okabe–Ito palette.
export const AXIS_COLORS: Record<'L' | 'a' | 'b', AxisColor> = {
	L: { main: OKABE_ITO.blue, muted: '#74B3DB', faint: 'rgba(0, 114, 178, 0.15)' },
	a: { main: OKABE_ITO.vermillion, muted: '#F0A16A', faint: 'rgba(213, 94, 0, 0.15)' },
	b: { main: OKABE_ITO.bluishGreen, muted: '#66C6A9', faint: 'rgba(0, 158, 115, 0.15)' }
};

export interface GroupColorPair {
	group1: string;
	group2: string;
}

// Two-group comparison palettes. Each pair is internally CVD-safe and high in
// luminance contrast so the two groups never collapse under color-vision deficiency.
export const GROUP_COLORS: Record<'expertise' | 'makeupUse' | 'training', GroupColorPair> = {
	expertise: { group1: OKABE_ITO.blue, group2: OKABE_ITO.orange },
	makeupUse: { group1: OKABE_ITO.reddishPurple, group2: OKABE_ITO.bluishGreen },
	training: { group1: OKABE_ITO.blue, group2: OKABE_ITO.vermillion }
};

// Default colors for single-series scatter / histogram marks.
export const SCATTER_POINT_FILL = 'rgba(0, 114, 178, 0.55)';
export const SCATTER_POINT_STROKE = OKABE_ITO.blue;
