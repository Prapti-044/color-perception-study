#!/usr/bin/env python3
"""
Scatterplot Generator with Large Color Difference and Target Distance
"""

import json
import random
import math
import os
from utils import (
    degree_to_pixels, calculate_target_distance_coords, lab_to_hex, sample_lab_color, 
    calculate_delta_e, generate_large_diff_color, generate_test_pair, generate_random_points, 
    create_base_vega_lite_spec, create_data_values, save_scatterplot, set_random_seed
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

# Minimum color difference for target points (CIE76 Delta E) - reduced for subtler differences
MIN_DELTA_E = 12

def create_scatterplot_data(num_points, point_size):
    # Sample LAB colors with large difference (Delta E > MIN_DELTA_E)
    lab1 = sample_lab_color()
    lab2 = generate_large_diff_color(lab1, MIN_DELTA_E)
    hex1 = lab_to_hex(lab1)
    hex2 = lab_to_hex(lab2)
    
    # Verify the color difference
    delta_e = calculate_delta_e(lab1, lab2)
    
    # Place fixed-distance test points
    test1, test2 = generate_test_pair(TARGET_DISTANCE_COORDS, point_size, CHART_WIDTH)
    distractors = generate_random_points(num_points - 2, point_size, [test1, test2], CHART_WIDTH)
    
    data_values = create_data_values(test1, test2, distractors, hex1, hex2)
    
    return data_values, hex1, hex2, delta_e

def create_vega_lite_spec(data_values, point_size, num_points, hex1, hex2, delta_e):
    description = f"Scatterplot of {num_points} random points. 2 target colors: {hex1} vs {hex2} (ΔE={delta_e:.1f})"
    return create_base_vega_lite_spec(data_values, point_size, num_points, description, CHART_WIDTH, CHART_HEIGHT)

def generate_scatterplots():
    os.makedirs("scatterplots_largediff", exist_ok=True)
    for i in range(1, TOTAL_PLOTS + 1):
        radius = random.choice(range(POINT_RADII_MIN, POINT_RADII_MAX + 1, 100))
        num_points = max(15, 1600 // radius)
        data_values, hex1, hex2, delta_e = create_scatterplot_data(num_points, radius)
        spec = create_vega_lite_spec(data_values, radius, num_points, hex1, hex2, delta_e)
        filename = f"scatterplots_largediff/scatterplot-{i}.json"
        save_scatterplot(spec, filename)
        print(f"Generated {filename} — {num_points} pts, radius={radius}, colors: {hex1} vs {hex2} (ΔE={delta_e:.1f})")

if __name__ == "__main__":
    set_random_seed()
    print("Generating scatterplots with large color difference (ΔE > 12) for target points...")
    generate_scatterplots()
    print("Done.")