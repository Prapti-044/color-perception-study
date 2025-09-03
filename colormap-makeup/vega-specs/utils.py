#!/usr/bin/env python3
"""
Shared utilities for scatterplot generators
"""

import json
import random
import math
from colorspacious import cspace_convert
import numpy as np

# Default random seed for reproducible results
DEFAULT_SEED = 60

def set_random_seed(seed=DEFAULT_SEED):
    """Set random seed for reproducible results"""
    random.seed(seed)
    np.random.seed(seed)

# === SHARED CONFIGURATION PARAMETERS ===

GRAY_COLOR = "#737373"
MIN_X_COORD = 0
MAX_X_COORD = 10
MIN_Y_COORD = 0
MAX_Y_COORD = 10

# Default Assumptions for visual angle calculations
PPI = 96  # Pixels per inch
DISTANCE_FROM_VIEW_SCREEN_INCHES = 30

# Point distribution parameters
MIN_POINT_SIZE = 50    # Minimum expected point size (most gaussian)
MAX_POINT_SIZE = 1000  # Maximum expected point size (most uniform)

def degree_to_pixels(degrees):
    """Convert visual angle in degrees to pixel distance"""
    return 2 * math.tan(math.radians(degrees / 2)) * DISTANCE_FROM_VIEW_SCREEN_INCHES * PPI / 2

def calculate_target_distance_coords(target_distance_pixels, chart_width):
    """Convert pixel distance to coordinate space distance"""
    return target_distance_pixels * (MAX_X_COORD - MIN_X_COORD) / chart_width

# === COLOR UTILITIES ===

def lab_to_hex(lab):
    """Convert CIELAB to hex RGB"""
    rgb = cspace_convert(lab, start="CIELab", end="sRGB1")
    rgb = [int(max(0, min(1, x)) * 255) for x in rgb]
    return '#{:02x}{:02x}{:02x}'.format(*rgb)

def sample_lab_color():
    """Sample a target LAB color within the valid CIELAB range, avoiding white and gray"""
    # Define problematic colors in LAB space
    WHITE_LAB = (100, 0, 0)  # Pure white in LAB
    GRAY_RGB = tuple(int(GRAY_COLOR[i:i+2], 16) for i in (1, 3, 5))  # Convert hex to RGB
    GRAY_LAB = cspace_convert(GRAY_RGB, start="sRGB255", end="CIELab")  # Convert to LAB
    
    while True:
        L = random.choice(range(30, 66, 5))  # 30 to 65
        a = random.choice(range(-36, 49, 12))
        b = random.choice(range(-48, 49, 12))
        
        candidate_lab = (L, a, b)
        
        # Discard grays (neutral colors)
        if -5 <= a <= 5 and -5 <= b <= 5:
            continue
            
        # Check distance from white (must be > 30 Delta E)
        white_distance = calculate_delta_e(candidate_lab, WHITE_LAB)
        if white_distance < 30:
            continue
            
        # Check distance from gray distractor color (must be > 15 Delta E)
        gray_distance = calculate_delta_e(candidate_lab, GRAY_LAB)
        if gray_distance < 15:
            continue
            
        # Additional safety: avoid very light colors
        if L > 85:
            continue
            
        return candidate_lab

def calculate_delta_e(lab1, lab2):
    """Calculate CIE76 Delta E between two LAB colors"""
    return math.sqrt((lab1[0] - lab2[0])**2 + (lab1[1] - lab2[1])**2 + (lab1[2] - lab2[2])**2)

def is_valid_color(lab_color):
    """Check if a LAB color is valid (not too close to white or gray)"""
    WHITE_LAB = (100, 0, 0)  # Pure white in LAB
    GRAY_RGB = tuple(int(GRAY_COLOR[i:i+2], 16) for i in (1, 3, 5))  # Convert hex to RGB
    GRAY_LAB = cspace_convert(GRAY_RGB, start="sRGB255", end="CIELab")  # Convert to LAB
    
    L, a, b = lab_color
    
    # Reject grays (neutral colors)
    if -5 <= a <= 5 and -5 <= b <= 5:
        return False
        
    # Check distance from white (must be > 30 Delta E)
    white_distance = calculate_delta_e(lab_color, WHITE_LAB)
    if white_distance < 30:
        return False
        
    # Check distance from gray distractor color (must be > 15 Delta E)
    gray_distance = calculate_delta_e(lab_color, GRAY_LAB)
    if gray_distance < 15:
        return False
        
    # Avoid very light colors
    if L > 85:
        return False
        
    return True

def adjust_lab_color(lab, size_radius, nd50_multipliers):
    """Adjust a LAB color by ND(50, size) step, ensuring result is valid"""
    while True:
        multiplier = random.choice(nd50_multipliers)
        delta = 2 + 0.05 * size_radius
        step = multiplier * delta
        axis = random.choice([0, 1, 2])  # L*, a*, or b*
        sign = random.choice([-1, 1])
        adjusted = list(lab)
        adjusted[axis] += sign * step
        
        # Clamp values to valid LAB ranges
        adjusted[0] = max(0, min(100, adjusted[0]))  # L* range [0, 100]
        adjusted[1] = max(-128, min(127, adjusted[1]))  # a* range [-128, 127]
        adjusted[2] = max(-128, min(127, adjusted[2]))  # b* range [-128, 127]
        
        adjusted_lab = tuple(adjusted)
        
        # Check if the adjusted color is valid
        if is_valid_color(adjusted_lab):
            return adjusted_lab

def generate_large_diff_color(base_lab, min_delta_e):
    """Generate a color with Delta E > min_delta_e from the base color, ensuring result is valid"""
    while True:
        # Generate a random color using sample_lab_color (which already validates)
        candidate_lab = sample_lab_color()
        delta_e = calculate_delta_e(base_lab, candidate_lab)
        if delta_e > min_delta_e:
            return candidate_lab
    
# === GEOMETRIC UTILITIES ===

def distance_between_points(p1, p2):
    """Calculate Euclidean distance between two points"""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def calculate_distribution_blend(point_size):
    """Calculate distribution blend factor based on point size
    
    Args:
        point_size: Size of the points (area in pixels)
    
    Returns:
        Blend factor: 0.0 = uniform (large points), 1.0 = gaussian (small points)
    """
    # Normalize point size to [0, 1] range
    normalized_size = (point_size - MIN_POINT_SIZE) / (MAX_POINT_SIZE - MIN_POINT_SIZE)
    # Clamp to [0, 1] range
    normalized_size = max(0.0, min(1.0, normalized_size))
    # Invert: small points (0) -> gaussian (1), large points (1) -> uniform (0)
    return 1.0 - normalized_size

def sample_blended_coordinate(min_coord, max_coord, blend_factor):
    """Sample a coordinate using blended uniform/gaussian distribution
    
    Args:
        min_coord: Minimum coordinate value
        max_coord: Maximum coordinate value
        blend_factor: 0.0 = uniform, 1.0 = gaussian (centered)
    
    Returns:
        Coordinate value within [min_coord, max_coord]
    """
    if blend_factor <= 0.0:
        # Pure uniform distribution
        return random.uniform(min_coord, max_coord)
    elif blend_factor >= 1.0:
        # Pure gaussian distribution (centered, clipped to bounds)
        center = (min_coord + max_coord) / 2
        std_dev = (max_coord - min_coord) / 6  # 3 standard deviations span the range
        value = random.gauss(center, std_dev)
        return max(min_coord, min(max_coord, value))
    else:
        # Blend between uniform and gaussian
        uniform_sample = random.uniform(min_coord, max_coord)
        
        center = (min_coord + max_coord) / 2
        std_dev = (max_coord - min_coord) / 6
        gaussian_sample = random.gauss(center, std_dev)
        gaussian_sample = max(min_coord, min(max_coord, gaussian_sample))
        
        # Linear interpolation between the two samples
        return (1 - blend_factor) * uniform_sample + blend_factor * gaussian_sample

def calculate_point_radius_in_coords(point_size, chart_width):
    """Convert point size (area) to radius in coordinate space"""
    pixel_radius = (point_size / math.pi) ** 0.5
    return pixel_radius * (MAX_X_COORD - MIN_X_COORD) / chart_width

def calculate_padding(point_size, chart_width):
    """Calculate padding needed around chart edges"""
    # Calculate padding based on point size
    point_based_padding = calculate_point_radius_in_coords(point_size, chart_width) * 3.0
    
    # Minimum padding in pixels (converted to coordinate space)
    MIN_PADDING_PIXELS = 0
    min_padding_coords = MIN_PADDING_PIXELS * (MAX_X_COORD - MIN_X_COORD) / chart_width
    
    # Use the larger of the two paddings
    return max(point_based_padding, min_padding_coords)

def generate_test_pair(target_distance_coords, point_size, chart_width):
    """Generate two fixed-distance points"""
    coord_padding = calculate_padding(point_size, chart_width)
    blend_factor = calculate_distribution_blend(point_size)
    attempts = 0
    while attempts < 500:
        x1 = sample_blended_coordinate(MIN_X_COORD + coord_padding, MAX_X_COORD - coord_padding, blend_factor)
        y1 = sample_blended_coordinate(MIN_Y_COORD + coord_padding, MAX_Y_COORD - coord_padding, blend_factor)
        angle = random.uniform(0, 2 * math.pi)
        dx = target_distance_coords * math.cos(angle)
        dy = target_distance_coords * math.sin(angle)
        x2, y2 = x1 + dx, y1 + dy
        if (MIN_X_COORD + coord_padding <= x2 <= MAX_X_COORD - coord_padding and
            MIN_Y_COORD + coord_padding <= y2 <= MAX_Y_COORD - coord_padding):
            return (x1, y1), (x2, y2)
        attempts += 1
    raise ValueError("Could not place two test points with required distance.")

def generate_random_points(n, point_size, excluded_points, chart_width):
    """Generate n random points with minimum distance constraints"""
    points = []
    min_distance = calculate_point_radius_in_coords(point_size, chart_width) * 2.5
    padding = calculate_padding(point_size, chart_width)
    blend_factor = calculate_distribution_blend(point_size)
    attempts = 0
    while len(points) < n and attempts < 100000:
        x = sample_blended_coordinate(MIN_X_COORD + padding, MAX_X_COORD - padding, blend_factor)
        y = sample_blended_coordinate(MIN_Y_COORD + padding, MAX_Y_COORD - padding, blend_factor)
        candidate = (x, y)
        if all(distance_between_points(candidate, p) >= min_distance for p in points + excluded_points):
            points.append(candidate)
        attempts += 1
    return points

# === VEGA-LITE UTILITIES ===

def create_base_vega_lite_spec(data_values, point_size, num_points, description, chart_width, chart_height=250):
    """Create base Vega-Lite specification with common settings"""
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": description,
        "width": chart_width,
        "height": chart_height,
        "data": {"values": data_values},
        "mark": {"type": "point", "filled": True, "size": point_size},
        "encoding": {
            "x": {"field": "x", "type": "quantitative", "scale": {"domain": [0, 10], "zero": False}, 
                  "axis": {"title": "", "grid": False, "domainColor": "#808080", "domainWidth": 1, "labels": False}},
            "y": {"field": "y", "type": "quantitative", "scale": {"domain": [0, 10], "zero": False}, 
                  "axis": {"title": "", "grid": False, "domainColor": "#808080", "domainWidth": 1, "labels": False}},
            "color": {"field": "color", "type": "nominal", "scale": None, "legend": None}
        },
        "padding": 60
    }

def create_data_values(test1, test2, distractors, hex1, hex2):
    """Create data values array for Vega-Lite specification"""
    data_values = [{"x": test1[0], "y": test1[1], "color": hex1},
                   {"x": test2[0], "y": test2[1], "color": hex2}]
    for (x, y) in distractors:
        data_values.append({"x": x, "y": y, "color": GRAY_COLOR})
    return data_values

def save_scatterplot(spec, filename):
    """Save scatterplot specification to JSON file"""
    with open(filename, 'w') as f:
        json.dump(spec, f, indent=4)
