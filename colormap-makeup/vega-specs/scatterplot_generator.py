#!/usr/bin/env python3
"""
Scatterplot Generator for Vega-Lite JSON files
Generates multiple scatterplot JSON files with random points and configurable parameters.
"""

import json
import random
import os

# === CONFIGURATION PARAMETERS ===

# Total number of plots to generate
TOTAL_PLOTS = 20

# Point radius values to test (these will determine point size and number of points)
POINT_RADII = [200, 500, 800, 1000, 1200, 1500, 2000]

# Color pairs for the two special points (each tuple contains two colors)
COLOR_PAIRS = [
    ("#519443", "#65ad70", 0.5),
    ("#65ad70", "#65ad70", 0.25),
    ("#519443", "#519443", 0.25),
]

# Gray color for non-special points
GRAY_COLOR = "#727972"

# Chart dimensions
CHART_WIDTH = 500
CHART_HEIGHT = 500

# Coordinate range for points
MIN_COORD = 1
MAX_COORD = 9

# === HELPER FUNCTIONS ===

def calculate_num_points(radius):
    """Calculate number of points based on radius (inverse relationship)"""
    # Base calculation: smaller radius = more points
    # Using a formula that gives reasonable point counts
    base_points = 40000 // radius
    return max(6, min(50, base_points))  # Ensure between 6-50 points

def calculate_point_radius_in_coords(point_size):
    """Calculate point radius in coordinate space"""
    # Convert point size (area) to approximate radius in coordinate space
    # Point size is area in pixels, approximate radius = sqrt(size/π)
    # Scale it to coordinate space (1-9 range spans ~500 pixels)
    pixel_radius = (point_size / 3.14159) ** 0.5
    coord_radius = pixel_radius * (MAX_COORD - MIN_COORD) / 500
    return coord_radius

def calculate_min_distance(point_size):
    """Calculate minimum distance between points based on point size"""
    coord_radius = calculate_point_radius_in_coords(point_size)
    # Add some padding factor to ensure clear separation
    return coord_radius * 2.5

def calculate_padding(point_size):
    """Calculate padding from chart edges based on point size"""
    coord_radius = calculate_point_radius_in_coords(point_size)
    # Add extra margin to ensure points don't get clipped at edges
    return coord_radius * 1.2

def distance_between_points(p1, p2):
    """Calculate Euclidean distance between two points"""
    return ((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2) ** 0.5

def weighted_random_choice(items_with_weights):
    """Select a random item based on probability weights"""
    # Extract items and weights
    items = [item[:-1] for item in items_with_weights]  # All except last element (weight)
    weights = [item[-1] for item in items_with_weights]  # Last element (weight)
    
    # Use random.choices for weighted selection
    return random.choices(items, weights=weights, k=1)[0]

def generate_random_points(num_points, point_size):
    """Generate random x,y coordinates for points with no overlap and proper padding"""
    points = []
    min_distance = calculate_min_distance(point_size)
    padding = calculate_padding(point_size)
    max_attempts = 1000  # Prevent infinite loops
    
    # Calculate effective coordinate boundaries with padding
    min_x = MIN_COORD + padding
    max_x = MAX_COORD - padding
    min_y = MIN_COORD + padding
    max_y = MAX_COORD - padding
    
    # Ensure we have valid coordinate ranges
    if min_x >= max_x or min_y >= max_y:
        print(f"Warning: Point size {point_size} too large for coordinate space. Using minimal padding.")
        min_x = MIN_COORD + 0.1
        max_x = MAX_COORD - 0.1
        min_y = MIN_COORD + 0.1
        max_y = MAX_COORD - 0.1
    
    for _ in range(num_points):
        attempts = 0
        while attempts < max_attempts:
            x = random.uniform(min_x, max_x)
            y = random.uniform(min_y, max_y)
            new_point = (x, y)
            
            # Check if this point is far enough from all existing points
            valid = True
            for existing_point in points:
                if distance_between_points(new_point, existing_point) < min_distance:
                    valid = False
                    break
            
            if valid:
                points.append(new_point)
                break
            
            attempts += 1
        
        # If we couldn't find a valid position after max_attempts, 
        # place it anyway to avoid infinite loops
        if attempts >= max_attempts:
            points.append((x, y))
            print(f"Warning: Could not find non-overlapping position for point {len(points)}")
    
    return points

def create_scatterplot_data(num_points, color_pair, point_size):
    """Create the data array for the scatterplot"""
    points = generate_random_points(num_points, point_size)
    data_values = []
    
    # Choose 2 random indices for the colored points
    colored_indices = random.sample(range(num_points), 2)
    
    for i, (x, y) in enumerate(points):
        if i == colored_indices[0]:
            color = color_pair[0]
        elif i == colored_indices[1]:
            color = color_pair[1]
        else:
            color = GRAY_COLOR
            
        data_values.append({
            "x": x,
            "y": y,
            "color": color
        })
    
    return data_values

def create_vega_lite_spec(data_values, point_size, num_points):
    """Create the complete Vega-Lite specification"""
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": f"Scatterplot of {num_points} random points. 2 points are colored, others are gray.",
        "width": CHART_WIDTH,
        "height": CHART_HEIGHT,
        "data": {
            "values": data_values
        },
        "mark": {
            "type": "point",
            "filled": True,
            "size": point_size
        },
        "encoding": {
            "x": {
                "field": "x",
                "type": "quantitative",
                "scale": {
                    "zero": False,
                    "padding": 0.2
                },
                "axis": {
                    "title": None,
                    "labels": False,
                    "ticks": False,
                    "grid": False
                }
            },
            "y": {
                "field": "y",
                "type": "quantitative",
                "scale": {
                    "zero": False,
                    "padding": 0.2
                },
                "axis": {
                    "title": None,
                    "labels": False,
                    "grid": False
                }
            },
            "color": {
                "field": "color",
                "type": "nominal",
                "scale": None,
                "legend": None
            }
        },
        "padding": 30
    }

def generate_scatterplots():
    """Generate scatterplot JSON files with random parameter selection"""
    
    for i in range(1, TOTAL_PLOTS + 1):
        # Randomly select radius and color pair for each plot
        radius = random.choice(POINT_RADII)
        color_pair = weighted_random_choice(COLOR_PAIRS)  # Use weighted selection
        
        num_points = calculate_num_points(radius)
        data_values = create_scatterplot_data(num_points, color_pair, radius)
        vega_spec = create_vega_lite_spec(data_values, radius, num_points)
        
        filename = f"scatterplot-{i}.json"
        
        with open(filename, 'w+') as f:
            json.dump(vega_spec, f, indent=4)
        
        print(f"Generated {filename}: {num_points} points, radius {radius}, colors {color_pair}")

if __name__ == "__main__":
    # Set random seed for reproducibility (optional)
    random.seed(42)
    
    print("Generating Vega-Lite scatterplot JSON files...")
    print(f"Total files to generate: {TOTAL_PLOTS}")
    print(f"Point radii options: {POINT_RADII}")
    print(f"Color pair options: {len(COLOR_PAIRS)} pairs with weights:")
    for i, (color1, color2, weight) in enumerate(COLOR_PAIRS):
        print(f"  {i+1}. {color1} & {color2} (weight: {weight})")
    print("-" * 50)
    
    generate_scatterplots()
    
    print("-" * 50)
    print("Generation complete!")
