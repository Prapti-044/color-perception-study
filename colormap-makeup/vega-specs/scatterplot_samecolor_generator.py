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

TOTAL_PLOTS = 4
FIXED_RADIUS = 800  # Medium fixed radius
GRAY_COLOR = "#727972"
CHART_WIDTH = 420
CHART_HEIGHT = 420
MIN_COORD = 0
MAX_COORD = 10

# Fixed distance between target points in pixels (5 degrees at 96 DPI)
DPI = 96
DEGREES = 5
VIEWING_DISTANCE_INCHES = 30
PIXELS_PER_DEGREE = 2 * math.tan(math.radians(DEGREES / 2)) * VIEWING_DISTANCE_INCHES * DPI / 2.54
TARGET_DISTANCE_PIXELS = PIXELS_PER_DEGREE
TARGET_DISTANCE_COORDS = TARGET_DISTANCE_PIXELS * (MAX_COORD - MIN_COORD) / CHART_WIDTH

# ND(50, size) approximate mapping (simplified, you can make this precise if needed)
ND50_MULTIPLIERS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

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

def adjust_lab_color(lab, size_radius):
    """Adjust a LAB color by ND(50, size) step"""
    multiplier = random.choice(ND50_MULTIPLIERS)
    delta = 5 + 0.02 * size_radius  # Very rough ND50(size) interpolator
    step = multiplier * delta
    axis = random.choice([0, 1, 2])  # L*, a*, or b*
    sign = random.choice([-1, 1])
    adjusted = list(lab)
    adjusted[axis] += sign * step
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
    return calculate_point_radius_in_coords(point_size) * 3.0

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
    # Sample LAB color (same for both target points)
    lab1 = sample_lab_color()
    hex1 = lab_to_hex(lab1)
    hex2 = hex1  # Both target points use the same color
    
    # Place fixed-distance test points
    test1, test2 = generate_test_pair(num_points, point_size)
    distractors = generate_random_points(num_points - 2, point_size, [test1, test2])
    
    data_values = [{"x": test1[0], "y": test1[1], "color": hex1},
                   {"x": test2[0], "y": test2[1], "color": hex2}]
    for (x, y) in distractors:
        data_values.append({"x": x, "y": y, "color": GRAY_COLOR})
    
    return data_values, hex1, hex2

def create_vega_lite_spec(data_values, point_size, num_points, hex1, hex2):
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": f"Scatterplot of {num_points} random points. 2 target points with same color: {hex1}",
        "width": CHART_WIDTH,
        "height": CHART_HEIGHT,
        "data": {"values": data_values},
        "mark": {"type": "point", "filled": True, "size": point_size},
        "encoding": {
            "x": {"field": "x", "type": "quantitative", "scale": {"domain": [0, 10], "zero": False}, "axis": {"title": "X Coordinate", "grid": False}},
            "y": {"field": "y", "type": "quantitative", "scale": {"domain": [0, 10], "zero": False}, "axis": {"title": "Y Coordinate", "grid": False}},
            "color": {"field": "color", "type": "nominal", "scale": None, "legend": None}
        },
        "padding": 60
    }

def generate_scatterplots():
    os.makedirs("scatterplots_same", exist_ok=True)
    for i in range(1, TOTAL_PLOTS + 1):
        radius = FIXED_RADIUS
        num_points = max(6, min(50, 40000 // radius))
        data_values, hex1, hex2 = create_scatterplot_data(num_points, radius)
        spec = create_vega_lite_spec(data_values, radius, num_points, hex1, hex2)
        filename = f"scatterplots_same/scatterplot-{i}.json"
        with open(filename, 'w') as f:
            json.dump(spec, f, indent=4)
        print(f"Generated {filename} — {num_points} pts, radius={radius}, same target color: {hex1}")

if __name__ == "__main__":
    random.seed(42)
    print("Generating scatterplots with same color for target points...")
    generate_scatterplots()
    print("Done.")

