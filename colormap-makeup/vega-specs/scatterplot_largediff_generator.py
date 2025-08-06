#!/usr/bin/env python3
"""
Scatterplot Generator with Fixed Color Difference and Target Distance
"""

import json
import random
import math
import os
from colorspacious import cspace_convert

# === CONFIGURATION PARAMETERS ===

TOTAL_PLOTS = 3
FIXED_RADIUS = 800  # Medium fixed radius
GRAY_COLOR = "#727972"
CHART_WIDTH = 500
CHART_HEIGHT = 500
MIN_COORD = 1
MAX_COORD = 9

# Fixed distance between target points in pixels (5 degrees at 96 DPI)
DPI = 96
DEGREES = 5
VIEWING_DISTANCE_INCHES = 30
PIXELS_PER_DEGREE = 2 * math.tan(math.radians(DEGREES / 2)) * VIEWING_DISTANCE_INCHES * DPI / 2.54
TARGET_DISTANCE_PIXELS = PIXELS_PER_DEGREE
TARGET_DISTANCE_COORDS = TARGET_DISTANCE_PIXELS * (MAX_COORD - MIN_COORD) / CHART_WIDTH

# Minimum color difference for target points (CIE76 Delta E)
MIN_DELTA_E = 20

def lab_to_hex(lab):
    """Convert CIELAB to hex RGB"""
    rgb = cspace_convert(lab, start="CIELab", end="sRGB1")
    rgb = [int(max(0, min(1, x)) * 255) for x in rgb]
    return '#{:02x}{:02x}{:02x}'.format(*rgb)

def sample_lab_color():
    """Sample a target LAB color within the valid CIELAB range"""
    while True:
        L = random.choice(range(30, 66, 5))  # 30 to 65
        a = random.choice(range(-36, 49, 12))
        b = random.choice(range(-48, 49, 12))
        if not (-5 <= a <= 5 and -5 <= b <= 5):  # discard grays
            return (L, a, b)

def calculate_delta_e(lab1, lab2):
    """Calculate CIE76 Delta E between two LAB colors"""
    return math.sqrt((lab1[0] - lab2[0])**2 + (lab1[1] - lab2[1])**2 + (lab1[2] - lab2[2])**2)

def generate_large_diff_color(base_lab):
    """Generate a color with Delta E > MIN_DELTA_E from the base color"""
    attempts = 0
    while attempts < 1000:
        # Generate a random color
        candidate_lab = sample_lab_color()
        delta_e = calculate_delta_e(base_lab, candidate_lab)
        if delta_e > MIN_DELTA_E:
            return candidate_lab
        attempts += 1
    
    # Fallback: force a large difference by adjusting L*, a*, b* significantly
    adjusted = list(base_lab)
    # Make a large change to ensure Delta E > 20
    adjusted[0] = max(30, min(65, adjusted[0] + random.choice([-30, 30])))  # Large L* change
    adjusted[1] = max(-36, min(48, adjusted[1] + random.choice([-25, 25])))  # Large a* change  
    adjusted[2] = max(-48, min(48, adjusted[2] + random.choice([-25, 25])))  # Large b* change
    return tuple(adjusted)

def distance_between_points(p1, p2):
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def generate_test_pair(num_points, point_size):
    """Generate two fixed-distance points and random distractors"""
    coord_padding = calculate_padding(point_size)
    attempts = 0
    while attempts < 500:
        x1 = random.uniform(MIN_COORD + coord_padding, MAX_COORD - coord_padding)
        y1 = random.uniform(MIN_COORD + coord_padding, MAX_COORD - coord_padding)
        angle = random.uniform(0, 2 * math.pi)
        dx = TARGET_DISTANCE_COORDS * math.cos(angle)
        dy = TARGET_DISTANCE_COORDS * math.sin(angle)
        x2, y2 = x1 + dx, y1 + dy
        if (MIN_COORD + coord_padding <= x2 <= MAX_COORD - coord_padding and
            MIN_COORD + coord_padding <= y2 <= MAX_COORD - coord_padding):
            return (x1, y1), (x2, y2)
        attempts += 1
    raise ValueError("Could not place two test points with required distance.")

def calculate_point_radius_in_coords(point_size):
    pixel_radius = (point_size / math.pi) ** 0.5
    return pixel_radius * (MAX_COORD - MIN_COORD) / CHART_WIDTH

def calculate_padding(point_size):
    return calculate_point_radius_in_coords(point_size) * 1.5

def generate_random_points(n, point_size, excluded_points):
    points = []
    min_distance = calculate_point_radius_in_coords(point_size) * 2.5
    padding = calculate_padding(point_size)
    attempts = 0
    while len(points) < n and attempts < 1000:
        x = random.uniform(MIN_COORD + padding, MAX_COORD - padding)
        y = random.uniform(MIN_COORD + padding, MAX_COORD - padding)
        candidate = (x, y)
        if all(distance_between_points(candidate, p) >= min_distance for p in points + excluded_points):
            points.append(candidate)
        attempts += 1
    return points

def create_scatterplot_data(num_points, point_size):
    # Sample LAB colors with large difference (Delta E > 20)
    lab1 = sample_lab_color()
    lab2 = generate_large_diff_color(lab1)
    hex1 = lab_to_hex(lab1)
    hex2 = lab_to_hex(lab2)
    
    # Verify the color difference
    delta_e = calculate_delta_e(lab1, lab2)
    
    # Place fixed-distance test points
    test1, test2 = generate_test_pair(num_points, point_size)
    distractors = generate_random_points(num_points - 2, point_size, [test1, test2])
    
    data_values = [{"x": test1[0], "y": test1[1], "color": hex1},
                   {"x": test2[0], "y": test2[1], "color": hex2}]
    for (x, y) in distractors:
        data_values.append({"x": x, "y": y, "color": GRAY_COLOR})
    
    return data_values, hex1, hex2, delta_e

def create_vega_lite_spec(data_values, point_size, num_points, hex1, hex2, delta_e):
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": f"Scatterplot of {num_points} random points. 2 target colors: {hex1} vs {hex2} (ΔE={delta_e:.1f})",
        "width": CHART_WIDTH,
        "height": CHART_HEIGHT,
        "data": {"values": data_values},
        "mark": {"type": "point", "filled": True, "size": point_size},
        "encoding": {
            "x": {"field": "x", "type": "quantitative", "scale": {"zero": False}, "axis": None},
            "y": {"field": "y", "type": "quantitative", "scale": {"zero": False}, "axis": None},
            "color": {"field": "color", "type": "nominal", "scale": None, "legend": None}
        },
        "padding": 30
    }

def generate_scatterplots():
    os.makedirs("scatterplots_largediff", exist_ok=True)
    for i in range(1, TOTAL_PLOTS + 1):
        radius = FIXED_RADIUS
        num_points = max(6, min(50, 40000 // radius))
        data_values, hex1, hex2, delta_e = create_scatterplot_data(num_points, radius)
        spec = create_vega_lite_spec(data_values, radius, num_points, hex1, hex2, delta_e)
        filename = f"scatterplots_largediff/scatterplot-{i}.json"
        with open(filename, 'w') as f:
            json.dump(spec, f, indent=4)
        print(f"Generated {filename} — {num_points} pts, radius={radius}, colors: {hex1} vs {hex2} (ΔE={delta_e:.1f})")

if __name__ == "__main__":
    random.seed(42)
    print("Generating scatterplots with large color difference (ΔE > 20) for target points...")
    generate_scatterplots()
    print("Done.")

