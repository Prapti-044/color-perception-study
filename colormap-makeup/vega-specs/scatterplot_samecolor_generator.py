#!/usr/bin/env python3
"""
Scatterplot Generator with Same Color for Target Points
"""

import json
import random
import math
import os
from utils import (
    degree_to_pixels, calculate_target_distance_coords, lab_to_hex, sample_lab_color, 
    generate_test_pair, generate_random_points, create_base_vega_lite_spec,
    create_data_values, save_scatterplot, set_random_seed
)

# === CONFIGURATION PARAMETERS ===

TOTAL_PLOTS = 79
POINT_RADII_MIN = 50
POINT_RADII_MAX = 1200
CHART_HEIGHT = 250
CHART_WIDTH = 375

# Fixed distance between target points in pixels (5 degrees)
MARK_DISTANCE_VISUAL_ANGLE_DEGREES = 5
TARGET_DISTANCE_PIXELS = degree_to_pixels(MARK_DISTANCE_VISUAL_ANGLE_DEGREES)
print(f"Target distance pixels: {TARGET_DISTANCE_PIXELS}")
TARGET_DISTANCE_COORDS = calculate_target_distance_coords(TARGET_DISTANCE_PIXELS, CHART_WIDTH)

def create_scatterplot_data(num_points, point_size):
    # Sample LAB color (same for both target points)
    lab1 = sample_lab_color()
    hex1 = lab_to_hex(lab1)
    hex2 = hex1  # Both target points use the same color
    
    # Place fixed-distance test points
    test1, test2 = generate_test_pair(TARGET_DISTANCE_COORDS, point_size, CHART_WIDTH)
    distractors = generate_random_points(num_points - 2, point_size, [test1, test2], CHART_WIDTH)
    
    data_values = create_data_values(test1, test2, distractors, hex1, hex2)
    
    return data_values, hex1, hex2

def create_vega_lite_spec(data_values, point_size, num_points, hex1, hex2):
    description = f"Scatterplot of {num_points} random points. 2 target points with same color: {hex1}"
    return create_base_vega_lite_spec(data_values, point_size, num_points, description, CHART_WIDTH, CHART_HEIGHT)

def generate_scatterplots():
    os.makedirs("scatterplots_same", exist_ok=True)
    for i in range(1, TOTAL_PLOTS + 1):
        radius = random.choice(range(POINT_RADII_MIN, POINT_RADII_MAX + 1, 100))
        num_points = max(15, 1600 // radius)
        data_values, hex1, hex2 = create_scatterplot_data(num_points, radius)
        spec = create_vega_lite_spec(data_values, radius, num_points, hex1, hex2)
        filename = f"scatterplots_same/scatterplot-{i}.json"
        save_scatterplot(spec, filename)
        print(f"Generated {filename} — {num_points} pts, radius={radius}, same target color: {hex1}")

if __name__ == "__main__":
    set_random_seed()
    print("Generating scatterplots with same color for target points...")
    generate_scatterplots()
    print("Done.")