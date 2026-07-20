"""Port of analysis/exp2/src/lib/colorVisionMath.js.

Reconstructs per-participant discrimination ellipsoids in CIE L*u*v*:
the three chromatic staircase thresholds define an ellipse in the u*v* plane
(exact linear solve; deterministic positive-definite fit as fallback), and the
lightness threshold provides the third semi-axis. Volume = 4/3 π a b c.
"""

from __future__ import annotations

import math

from color_analysis.exp2.constants import MAX_LOCATION_BY_VECTOR, RECOVERED_AXES


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def threshold_mean_to_radius(threshold_mean: float, vector: int) -> float:
    """Convert a mean staircase threshold (steps) into a L*u*v* radius."""
    axis = RECOVERED_AXES[vector]
    return threshold_mean / MAX_LOCATION_BY_VECTOR[vector] * axis["maxRadius"]


def solve_linear_3x3(matrix: list[list[float]], rhs: list[float]) -> list[float]:
    """Gaussian elimination with partial pivoting; raises if near-singular."""
    augmented = [row[:] + [rhs[i]] for i, row in enumerate(matrix)]

    for pivot_index in range(3):
        pivot_row = max(
            range(pivot_index, 3), key=lambda r: abs(augmented[r][pivot_index])
        )
        if abs(augmented[pivot_row][pivot_index]) < 1e-12:
            raise ValueError("Ellipse fit matrix is singular")

        if pivot_row != pivot_index:
            augmented[pivot_index], augmented[pivot_row] = (
                augmented[pivot_row],
                augmented[pivot_index],
            )

        pivot = augmented[pivot_index][pivot_index]
        for column in range(pivot_index, 4):
            augmented[pivot_index][column] /= pivot

        for row in range(3):
            if row == pivot_index:
                continue
            factor = augmented[row][pivot_index]
            for column in range(pivot_index, 4):
                augmented[row][column] -= factor * augmented[pivot_index][column]

    return [augmented[0][3], augmented[1][3], augmented[2][3]]


def get_ellipse_semiaxes(alpha: float, beta: float, gamma: float) -> dict:
    trace = alpha + gamma
    determinant = alpha * gamma - beta * beta
    discriminant = math.sqrt(max(0.0, trace * trace - 4 * determinant))
    eigenvalues = [(trace + discriminant) / 2, (trace - discriminant) / 2]

    if any(value <= 0 for value in eigenvalues):
        raise ValueError("Recovered ellipse is not positive definite")

    semiaxes = sorted((1 / math.sqrt(value) for value in eigenvalues), reverse=True)
    return {"eigenvalues": eigenvalues, "major": semiaxes[0], "minor": semiaxes[1]}


def get_ellipse_rotation(alpha: float, beta: float, gamma: float) -> float:
    return 0.5 * math.atan2(2 * beta, alpha - gamma)


def get_chromatic_ellipse_points(ellipse: dict, point_count: int = 96) -> list[tuple[float, float]]:
    cos_r = math.cos(ellipse["rotation"])
    sin_r = math.sin(ellipse["rotation"])
    points = []
    for index in range(point_count):
        theta = index / point_count * math.pi * 2
        base_u = ellipse["major"] * math.cos(theta)
        base_v = ellipse["minor"] * math.sin(theta)
        points.append((base_u * cos_r - base_v * sin_r, base_u * sin_r + base_v * cos_r))
    return points


def get_quadratic_coefficients_from_ellipse(ellipse: dict) -> dict:
    cos_r = math.cos(ellipse["rotation"])
    sin_r = math.sin(ellipse["rotation"])
    inv_major_sq = 1 / (ellipse["major"] ** 2)
    inv_minor_sq = 1 / (ellipse["minor"] ** 2)

    return {
        "alpha": inv_major_sq * cos_r * cos_r + inv_minor_sq * sin_r * sin_r,
        "beta": (inv_major_sq - inv_minor_sq) * sin_r * cos_r,
        "gamma": inv_major_sq * sin_r * sin_r + inv_minor_sq * cos_r * cos_r,
    }


def normalize_ellipse_parameters(ellipse: dict) -> dict:
    major = max(ellipse["major"], 1e-9)
    minor = max(ellipse["minor"], 1e-9)
    rotation = ellipse["rotation"] % math.pi
    if rotation < 0:
        rotation += math.pi

    if minor > major:
        major, minor = minor, major
        rotation = (rotation + math.pi / 2) % math.pi

    return {"major": major, "minor": minor, "rotation": rotation}


def project_to_positive_definite_ellipse(
    alpha: float, beta: float, gamma: float, minimum_eigenvalue: float = 1e-9
) -> dict:
    trace = alpha + gamma
    determinant = alpha * gamma - beta * beta
    discriminant = math.sqrt(max(0.0, trace * trace - 4 * determinant))
    raw_eigenvalues = [(trace + discriminant) / 2, (trace - discriminant) / 2]
    clipped = [max(value, minimum_eigenvalue) for value in raw_eigenvalues]
    rotation = get_ellipse_rotation(alpha, beta, gamma)
    major = 1 / math.sqrt(min(clipped))
    minor = 1 / math.sqrt(max(clipped))
    normalized_rotation = normalize_ellipse_parameters(
        {"major": major, "minor": minor, "rotation": rotation}
    )["rotation"]

    return {
        "eigenvalues": clipped,
        **get_quadratic_coefficients_from_ellipse(
            {"major": major, "minor": minor, "rotation": normalized_rotation}
        ),
        "major": major,
        "minor": minor,
        "rotation": normalized_rotation,
    }


def predict_radius_along_direction(coefficients: dict, direction: tuple[float, float]) -> float:
    u, v = direction
    denominator = (
        coefficients["alpha"] * u * u
        + 2 * coefficients["beta"] * u * v
        + coefficients["gamma"] * v * v
    )
    if not (denominator > 0) or not math.isfinite(denominator):
        return math.inf
    return 1 / math.sqrt(denominator)


def score_ellipse_fit(ellipse: dict, target_radii: dict) -> dict:
    normalized = normalize_ellipse_parameters(ellipse)
    coefficients = get_quadratic_coefficients_from_ellipse(normalized)
    relative_errors = []
    for vector in (1, 2, 3):
        predicted = predict_radius_along_direction(
            coefficients, RECOVERED_AXES[vector]["unitUv"]
        )
        target = target_radii[vector]
        relative_errors.append((predicted - target) / target)

    return {
        "coefficients": coefficients,
        "loss": sum(error * error for error in relative_errors),
        "maxRelativeRadiusError": max(abs(error) for error in relative_errors),
        "relativeErrors": relative_errors,
    }


def build_fitted_chromatic_ellipse(target_radii: dict, seed_coefficients: dict) -> dict:
    """Deterministic coordinate-descent fit of a positive-definite ellipse."""
    projected_seed = project_to_positive_definite_ellipse(
        seed_coefficients["alpha"], seed_coefficients["beta"], seed_coefficients["gamma"]
    )
    radius_values = [target_radii[1], target_radii[2], target_radii[3]]
    min_radius = min(radius_values)
    max_radius = max(radius_values)
    min_bound = max(min_radius * 0.35, 1e-6)
    max_bound = max_radius * 3

    def clamp_ellipse(ellipse: dict) -> dict:
        normalized = normalize_ellipse_parameters(ellipse)
        return normalize_ellipse_parameters(
            {
                "major": min(max(normalized["major"], min_bound), max_bound),
                "minor": min(max(normalized["minor"], min_bound), max_bound),
                "rotation": normalized["rotation"],
            }
        )

    seed_options = [
        clamp_ellipse(
            {
                "major": projected_seed["major"],
                "minor": projected_seed["minor"],
                "rotation": projected_seed["rotation"],
            }
        ),
        clamp_ellipse(
            {"major": max_radius, "minor": min_radius, "rotation": projected_seed["rotation"]}
        ),
        clamp_ellipse(
            {
                "major": max(target_radii[1], target_radii[3]),
                "minor": min(target_radii[1], target_radii[3]),
                "rotation": 0.0,
            }
        ),
    ]

    best_ellipse = seed_options[0]
    best_score = score_ellipse_fit(best_ellipse, target_radii)

    for seed in seed_options[1:]:
        seed_score = score_ellipse_fit(seed, target_radii)
        if seed_score["loss"] < best_score["loss"]:
            best_ellipse = seed
            best_score = seed_score

    log_major_step = 0.18
    log_minor_step = 0.18
    rotation_step = math.pi / 24

    for _ in range(28):
        improved = False
        candidates = [
            {**best_ellipse, "major": best_ellipse["major"] * math.exp(log_major_step)},
            {**best_ellipse, "major": best_ellipse["major"] * math.exp(-log_major_step)},
            {**best_ellipse, "minor": best_ellipse["minor"] * math.exp(log_minor_step)},
            {**best_ellipse, "minor": best_ellipse["minor"] * math.exp(-log_minor_step)},
            {**best_ellipse, "rotation": best_ellipse["rotation"] + rotation_step},
            {**best_ellipse, "rotation": best_ellipse["rotation"] - rotation_step},
        ]

        for candidate in candidates:
            normalized_candidate = clamp_ellipse(candidate)
            candidate_score = score_ellipse_fit(normalized_candidate, target_radii)
            if candidate_score["loss"] + 1e-12 < best_score["loss"]:
                best_ellipse = normalized_candidate
                best_score = candidate_score
                improved = True

        if not improved:
            log_major_step *= 0.5
            log_minor_step *= 0.5
            rotation_step *= 0.5
            if max(log_major_step, log_minor_step, rotation_step) < 1e-5:
                break

    return {"ellipse": best_ellipse, **best_score}


def _valid_threshold_means(threshold_means: dict) -> bool:
    for vector in (1, 2, 3, 4):
        value = threshold_means.get(vector)
        if (
            not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not math.isfinite(value)
            or value <= 0
        ):
            return False
    return True


def _radii_from_threshold_means(threshold_means: dict) -> dict:
    return {v: threshold_mean_to_radius(threshold_means[v], v) for v in (1, 2, 3, 4)}


def _chromatic_system(radii: dict) -> tuple[list[list[float]], list[float]]:
    rows = []
    for vector in (1, 2, 3):
        u, v = RECOVERED_AXES[vector]["unitUv"]
        rows.append([u * u, 2 * u * v, v * v])
    rhs = [1 / (radii[vector] ** 2) for vector in (1, 2, 3)]
    return rows, rhs


def build_exact_ellipsoid_model(threshold_means: dict) -> dict | None:
    """Exact ellipsoid from the three chromatic radii; None if not positive definite."""
    if not _valid_threshold_means(threshold_means):
        return None

    radii = _radii_from_threshold_means(threshold_means)
    rows, rhs = _chromatic_system(radii)

    try:
        alpha, beta, gamma = solve_linear_3x3(rows, rhs)
        semiaxes = get_ellipse_semiaxes(alpha, beta, gamma)
    except ValueError:
        return None

    lightness = radii[4]
    rotation = get_ellipse_rotation(alpha, beta, gamma)
    volume = 4 / 3 * math.pi * semiaxes["major"] * semiaxes["minor"] * lightness

    return {
        "fitKind": "exact",
        "fitLoss": 0.0,
        "maxRelativeRadiusError": 0.0,
        "chromaticRadii": {"pink": radii[1], "magenta": radii[2], "blue": radii[3]},
        "coefficients": {"alpha": alpha, "beta": beta, "gamma": gamma},
        "ellipse": {
            "major": semiaxes["major"],
            "minor": semiaxes["minor"],
            "rotation": rotation,
        },
        "eigenvalues": semiaxes["eigenvalues"],
        "lightness": lightness,
        "volume": volume,
    }


def build_fitted_ellipsoid_model(threshold_means: dict) -> dict | None:
    """Fallback: deterministic positive-definite fit to the chromatic radii."""
    if not _valid_threshold_means(threshold_means):
        return None

    radii = _radii_from_threshold_means(threshold_means)
    rows, rhs = _chromatic_system(radii)

    try:
        coefficients = solve_linear_3x3(rows, rhs)
    except ValueError:
        coefficients = [1 / (radii[1] ** 2), 0.0, 1 / (radii[3] ** 2)]

    fitted = build_fitted_chromatic_ellipse(
        {1: radii[1], 2: radii[2], 3: radii[3]},
        {"alpha": coefficients[0], "beta": coefficients[1], "gamma": coefficients[2]},
    )
    normalized = normalize_ellipse_parameters(fitted["ellipse"])
    normalized_coefficients = get_quadratic_coefficients_from_ellipse(normalized)
    lightness = radii[4]
    volume = 4 / 3 * math.pi * normalized["major"] * normalized["minor"] * lightness

    return {
        "fitKind": "fitted",
        "fitLoss": fitted["loss"],
        "maxRelativeRadiusError": fitted["maxRelativeRadiusError"],
        "chromaticRadii": {"pink": radii[1], "magenta": radii[2], "blue": radii[3]},
        "coefficients": normalized_coefficients,
        "ellipse": normalized,
        "eigenvalues": [1 / normalized["minor"] ** 2, 1 / normalized["major"] ** 2],
        "lightness": lightness,
        "volume": volume,
    }


def compute_ellipsoid_proxy_volume(thresholds: list[float]) -> float:
    return mean(thresholds) ** 3
