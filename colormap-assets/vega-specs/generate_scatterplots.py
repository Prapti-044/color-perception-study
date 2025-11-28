import pandas as pd
import os
import numpy as np
import json
import math

# Load CSV files
base_dir = os.path.dirname(os.path.abspath(__file__))
colorset_df = pd.read_csv(os.path.join(base_dir, "colorset.csv"))
diffs_df = pd.read_csv(os.path.join(base_dir, "diffs.csv"))

# Extract first 72 rows from colorset (small_diff)
small_diff = colorset_df.iloc[:72]
no_diff = colorset_df.iloc[72:76]
large_diff = colorset_df.iloc[76:79]

# Filter diffs by axis and drop the Axis column
L_values = diffs_df[diffs_df['Axis'] == 'L'].drop(columns=['Axis'])
a_values = diffs_df[diffs_df['Axis'] == 'a'].drop(columns=['Axis'])
b_values = diffs_df[diffs_df['Axis'] == 'b'].drop(columns=['Axis'])

# Default Assumptions for visual angle calculations
PPI = 96  # Pixels per inch
DISTANCE_FROM_VIEW_SCREEN_INCHES = 30

def degree_to_pixels(degrees):
    """Convert visual angle in degrees to pixel distance"""
    return math.ceil(2 * math.tan(math.radians(degrees / 2)) * DISTANCE_FROM_VIEW_SCREEN_INCHES * PPI / 2)

def expand_df(df):
    """Expand DataFrame by interleaving positive and negative DE values."""
    df_neg = df.copy()
    df_neg['DE'] = -df_neg['DE']
    
    n = len(df)
    data = {}
    for col in df.columns:
        arr = np.empty(2 * n, dtype=df[col].dtype)
        arr[0::2] = df[col].values
        arr[1::2] = df_neg[col].values
        data[col] = arr
    
    return pd.DataFrame(data)


def create_merged_diff(small_diff, expanded_values, axis):
    """Create merged DataFrame for a given axis (L, a, or b)."""
    origin_col = f"{axis}_origin"
    renamed = small_diff.rename(columns={axis: origin_col})
    merged = pd.concat([renamed.reset_index(drop=True), 
                       expanded_values.reset_index(drop=True)], axis=1)
    merged[axis] = merged[origin_col] + merged['DE']
    return merged


def lab_to_rgb(L, a, b):
    """Convert LAB color to RGB hex string."""
    # LAB to XYZ conversion
    fy = (L + 16) / 116
    fx = a / 500 + fy
    fz = fy - b / 200
    
    # XYZ tristimulus values with D65 white point
    xr = 95.047
    yr = 100.000
    zr = 108.883
    
    epsilon = 0.008856
    kappa = 903.3
    
    def f_inv(t):
        if t > epsilon ** (1/3):
            return t ** 3
        else:
            return (116 * t - 16) / kappa
    
    X = xr * f_inv(fx)
    Y = yr * f_inv(fy)
    Z = zr * f_inv(fz)
    
    # XYZ to RGB (sRGB)
    X /= 100
    Y /= 100
    Z /= 100
    
    R = X * 3.2406 + Y * -1.5372 + Z * -0.4986
    G = X * -0.9689 + Y * 1.8758 + Z * 0.0415
    B = X * 0.0557 + Y * -0.2040 + Z * 1.0570
    
    # Apply gamma correction
    def gamma_correction(c):
        if c > 0.0031308:
            return 1.055 * (c ** (1 / 2.4)) - 0.055
        else:
            return 12.92 * c
    
    R = gamma_correction(R)
    G = gamma_correction(G)
    B = gamma_correction(B)
    
    # Convert to 0-255 range and clamp
    R = max(0, min(255, int(R * 255)))
    G = max(0, min(255, int(G * 255)))
    B = max(0, min(255, int(B * 255)))
    
    return f"#{R:02x}{G:02x}{B:02x}"


def generate_normal_positions(n, width, height, radius, avoid_points=None, max_attempts=10000):
    """Generate n points with normal distribution, avoiding overlaps."""
    positions = []
    
    # Center of the plot
    cx = 0.5 * width
    cy = 0.5 * height
    
    # Standard deviation
    std_x = 1.0 * width
    std_y = 1.0 * height
    
    attempts = 0
    while len(positions) < n and attempts < max_attempts:
        x = np.random.normal(cx, std_x)
        y = np.random.normal(cy, std_y)
        
        # Check bounds with margin for radius
        if x < radius or x > width - radius or y < radius or y > height - radius:
            attempts += 1
            continue
        
        # Check for overlaps with existing points
        overlap = False
        min_dist = 2 * radius  # Minimum distance between centers
        
        # Check against avoid_points (target points)
        if avoid_points:
            for ax, ay in avoid_points:
                dist = np.sqrt((x - ax) ** 2 + (y - ay) ** 2)
                if dist < min_dist:
                    overlap = True
                    break
        
        if not overlap:
            # Check against already placed distractor points
            for px, py in positions:
                dist = np.sqrt((x - px) ** 2 + (y - py) ** 2)
                if dist < min_dist:
                    overlap = True
                    break
        
        if not overlap:
            positions.append((x, y))
        
        attempts += 1
    
    return positions


def create_scatterplot_spec(row, axis, width, height, point_diameter_degrees, diff_type='small'):
    """Create a Vega-Lite scatterplot specification.
    
    Args:
        row: Data row with color information
        axis: Which axis to test ('L', 'a', 'b', or None for no_diff/large_diff)
        width: Plot width in pixels
        height: Plot height in pixels
        point_diameter_degrees: Point diameter in degrees of visual angle
        diff_type: Type of difference ('small', 'none', or 'large')
    
    Returns:
        tuple: (spec, metadata) where spec is the Vega-Lite spec and metadata is a dict
    """
    
    # Convert visual angle to pixels
    point_radius = degree_to_pixels(point_diameter_degrees) / 2
    
    # Calculate number of distractor points
    plot_area = width * height
    point_area = np.pi * point_radius * point_radius
    n_total = int(np.sqrt(plot_area / point_area))
    n_distractors = n_total - 2  # Subtract the 2 target points
    
    # Target points: horizontally aligned, 125 pixels apart
    # Randomize y position (but keep both points at same y)
    # Keep enough margin from edges for point radius
    min_y = point_radius + 10
    max_y = height - point_radius - 10
    target_y = np.random.uniform(min_y, max_y)
    
    # Randomize x center position, ensuring both points fit within bounds
    min_x_center = 62.5 + point_radius + 10
    max_x_center = width - 62.5 - point_radius - 10
    x_center = np.random.uniform(min_x_center, max_x_center)
    
    target_x1 = x_center - 62.5  # 125 pixels apart horizontally
    target_x2 = x_center + 62.5
    
    target_points = [(target_x1, target_y), (target_x2, target_y)]
    
    # Generate distractor points
    distractor_positions = generate_normal_positions(
        n_distractors, width, height, point_radius, avoid_points=target_points
    )
    
    # Get colors and LAB values for target points based on diff_type
    lab1 = {}
    lab2 = {}
    delta_e = 0
    
    if diff_type == 'none':
        # Both points same color
        lab1 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b'])}
        lab2 = lab1.copy()
        color1 = lab_to_rgb(row['L'], row['a'], row['b'])
        color2 = color1
        delta_e = 0
    elif diff_type == 'large':
        # Apply large DE of 30 on a random axis
        delta_e = 30
        if axis == 'L':
            lab1 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b'])}
            lab2 = {"L": float(row['L'] + 30), "a": float(row['a']), "b": float(row['b'])}
            color1 = lab_to_rgb(row['L'], row['a'], row['b'])
            color2 = lab_to_rgb(row['L'] + 30, row['a'], row['b'])
        elif axis == 'a':
            lab1 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b'])}
            lab2 = {"L": float(row['L']), "a": float(row['a'] + 30), "b": float(row['b'])}
            color1 = lab_to_rgb(row['L'], row['a'], row['b'])
            color2 = lab_to_rgb(row['L'], row['a'] + 30, row['b'])
        else:  # axis == 'b'
            lab1 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b'])}
            lab2 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b'] + 30)}
            color1 = lab_to_rgb(row['L'], row['a'], row['b'])
            color2 = lab_to_rgb(row['L'], row['a'], row['b'] + 30)
    else:  # diff_type == 'small'
        # Get colors for target points from merged data
        delta_e = float(row['DE']) if 'DE' in row else 0
        if axis == 'L':
            lab1 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b'])}
            lab2 = {"L": float(row['L_origin']), "a": float(row['a']), "b": float(row['b'])}
            color1 = lab_to_rgb(row['L'], row['a'], row['b'])
            color2 = lab_to_rgb(row['L_origin'], row['a'], row['b'])
        elif axis == 'a':
            lab1 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b'])}
            lab2 = {"L": float(row['L']), "a": float(row['a_origin']), "b": float(row['b'])}
            color1 = lab_to_rgb(row['L'], row['a'], row['b'])
            color2 = lab_to_rgb(row['L'], row['a_origin'], row['b'])
        else:  # axis == 'b'
            lab1 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b'])}
            lab2 = {"L": float(row['L']), "a": float(row['a']), "b": float(row['b_origin'])}
            color1 = lab_to_rgb(row['L'], row['a'], row['b'])
            color2 = lab_to_rgb(row['L'], row['a'], row['b_origin'])
    
    # Gray color for distractors
    gray_color = "#767676"
    
    # Build data
    data_values = []
    
    # Add target points
    data_values.append({"x": target_x1, "y": target_y, "color": color1, "type": "target"})
    data_values.append({"x": target_x2, "y": target_y, "color": color2, "type": "target"})
    
    # Add distractor points
    for x, y in distractor_positions:
        data_values.append({"x": x, "y": y, "color": gray_color, "type": "distractor"})
    
    # Create Vega-Lite spec
    spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": width,
        "height": height,
        "background": "white",
        "padding": 0,
        "data": {"values": data_values},
        "mark": {
            "type": "circle",
            "size": point_area,
            "opacity": 1
        },
        "encoding": {
            "x": {
                "field": "x",
                "type": "quantitative",
                "scale": {"domain": [0, width]},
                "axis": {
                    "grid": False,
                    "ticks": True,
                    "tickCount": 15,
                    "labels": False,
                    "title": None,
                    "domainColor": "#a0a0a0",
                    "domainWidth": 1
                }
            },
            "y": {
                "field": "y",
                "type": "quantitative",
                "scale": {"domain": [0, height]},
                "axis": {
                    "grid": False,
                    "ticks": True,
                    "tickCount": 10,
                    "labels": False,
                    "title": None,
                    "domainColor": "#a0a0a0",
                    "domainWidth": 1
                }
            },
            "color": {
                "field": "color",
                "type": "nominal",
                "scale": None,
                "legend": None
            }
        },
        "config": {
            "view": {"stroke": None}
        }
    }
    
    # Create metadata
    metadata = {
        "axis": axis,
        "diff_type": diff_type,
        "delta_e": delta_e,
        "point_radius_pixels": float(point_radius),
        "point_diameter_degrees": float(point_diameter_degrees),
        "point_area_pixels": float(point_area),
        "plot_width": width,
        "plot_height": height,
        "target_color1_hex": color1,
        "target_color2_hex": color2,
        "target_color1_lab": lab1,
        "target_color2_lab": lab2,
        "distractor_color_hex": gray_color,
        "target_positions": [
            {"x": float(target_x1), "y": float(target_y)},
            {"x": float(target_x2), "y": float(target_y)}
        ],
        "target_separation_pixels": 125.0,
        "n_distractors": n_distractors,
        "n_total_points": n_distractors + 2,
        "ppi": PPI,
        "viewing_distance_inches": DISTANCE_FROM_VIEW_SCREEN_INCHES
    }
    
    return spec, metadata


def generate_scatterplots(merged_df, axis, output_dir, diff_type='small'):
    """Generate all scatterplots for a given axis.
    
    Args:
        merged_df: DataFrame with color and width information
        axis: Which axis to test ('L', 'a', 'b')
        output_dir: Output directory path
        diff_type: Type of difference ('small', 'none', or 'large')
    
    Returns:
        list: List of metadata dictionaries for each generated scatterplot
    """
    os.makedirs(output_dir, exist_ok=True)
    
    width = 375
    height = 250
    
    metadata_list = []
    
    for idx, row in merged_df.iterrows():
        point_diameter_degrees = row['Width']
        spec, metadata = create_scatterplot_spec(row, axis, width, height, point_diameter_degrees, diff_type)
        
        # Create filename
        filename = f"scatterplot_{idx:03d}.json"
        filepath = os.path.join(output_dir, filename)
        
        # Add file information to metadata
        metadata['filename'] = filename
        metadata['filepath'] = filepath
        metadata['output_directory'] = output_dir
        metadata['index'] = int(idx)
        
        # Save specification
        with open(filepath, 'w') as f:
            json.dump(spec, f, indent=2)
        
        metadata_list.append(metadata)
        print(f"Generated: {filepath}")
    
    return metadata_list


# Expand diff values (interleave positive and negative)
L_values_expanded = expand_df(L_values)
a_values_expanded = expand_df(a_values)
b_values_expanded = expand_df(b_values)

# Create final merged DataFrames
merged_small_diff_L = create_merged_diff(small_diff, L_values_expanded, 'L')
merged_small_diff_a = create_merged_diff(small_diff, a_values_expanded, 'a')
merged_small_diff_b = create_merged_diff(small_diff, b_values_expanded, 'b')

# Collect all metadata
all_metadata = []

# Generate small diff scatterplots
print("Generating scatterplots for L axis (small diff)...")
metadata_L = generate_scatterplots(merged_small_diff_L, 'L', os.path.join(base_dir, 'scatterplots_smalldiff_L'))
all_metadata.extend(metadata_L)

print("\nGenerating scatterplots for a axis (small diff)...")
metadata_a = generate_scatterplots(merged_small_diff_a, 'a', os.path.join(base_dir, 'scatterplots_smalldiff_a'))
all_metadata.extend(metadata_a)

print("\nGenerating scatterplots for b axis (small diff)...")
metadata_b = generate_scatterplots(merged_small_diff_b, 'b', os.path.join(base_dir, 'scatterplots_smalldiff_b'))
all_metadata.extend(metadata_b)

# Generate no diff scatterplots (3 scatterplots with same color targets)
print("\nGenerating no diff scatterplots...")
# Add Width column (use 1.0 degree as default)
no_diff_with_width = no_diff.copy()
no_diff_with_width['Width'] = 1.0

output_dir_nodiff = os.path.join(base_dir, 'scatterplots_no_diff')
os.makedirs(output_dir_nodiff, exist_ok=True)

for idx, row in no_diff_with_width.iterrows():
    spec, metadata = create_scatterplot_spec(row, None, 375, 250, row['Width'], diff_type='none')
    filename = f"scatterplot_{idx:03d}.json"
    filepath = os.path.join(output_dir_nodiff, filename)
    
    # Add file information to metadata
    metadata['filename'] = filename
    metadata['filepath'] = filepath
    metadata['output_directory'] = output_dir_nodiff
    metadata['index'] = int(idx)
    
    with open(filepath, 'w') as f:
        json.dump(spec, f, indent=2)
    
    all_metadata.append(metadata)
    print(f"Generated: {filepath}")

# Generate large diff scatterplots (4 scatterplots with DE=30)
print("\nGenerating large diff scatterplots...")
# Add Width column (use 1.0 degree as default)
large_diff_with_width = large_diff.copy()
large_diff_with_width['Width'] = 1.0

output_dir_largediff = os.path.join(base_dir, 'scatterplots_large_diff')
os.makedirs(output_dir_largediff, exist_ok=True)

# Cycle through axes for the 4 large diff scatterplots
axes_cycle = ['L', 'a', 'b', 'L']
for i, (idx, row) in enumerate(large_diff_with_width.iterrows()):
    axis = axes_cycle[i]
    spec, metadata = create_scatterplot_spec(row, axis, 375, 250, row['Width'], diff_type='large')
    filename = f"scatterplot_{idx:03d}.json"
    filepath = os.path.join(output_dir_largediff, filename)
    
    # Add file information to metadata
    metadata['filename'] = filename
    metadata['filepath'] = filepath
    metadata['output_directory'] = output_dir_largediff
    metadata['index'] = int(idx)
    
    with open(filepath, 'w') as f:
        json.dump(spec, f, indent=2)
    
    all_metadata.append(metadata)
    print(f"Generated: {filepath} (axis: {axis})")

# Write all metadata to a single JSON file
metadata_filepath = os.path.join(base_dir, 'scatterplots_metadata.json')
with open(metadata_filepath, 'w') as f:
    json.dump({
        "generated_date": pd.Timestamp.now().isoformat(),
        "total_scatterplots": len(all_metadata),
        "scatterplots": all_metadata
    }, f, indent=2)

print(f"\nAll scatterplots generated successfully!")
print(f"Metadata written to: {metadata_filepath}")
