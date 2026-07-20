"""Port of analysis/exp1/src/lib/constants.ts."""

EXCLUDED_PARTICIPANT_IDS = [
    # a*: incomplete (43/72 answers) and near-chance accuracy — never usable
    "58599369-a707-46df-b949-63b3fcacdd9b",
    # a*: completed flag but zero scatterplot answers
    "36956173-0846-4a76-8cf6-93b065ada362",
    # L*: worst engagement (3 wrong samecolor/largediff checks)
    "670d816961bebcb45b53b929",
    # L*: next-worst (2 engagement fails + 1 attention-check fail)
    "5d57062817ee8d0001cda0f6",
]

ATTENTION_CHECK_QUESTIONS = {
    1: {"question": "How many o's are there in Tomorrow?", "answer": "3"},
    2: {"question": "How many r's are there in Strawberry?", "answer": "3"},
    3: {"question": "How many b's are there in blueberry?", "answer": "2"},
    4: {"question": "Please type the third letter of the word banana.", "answer": "n"},
    5: {"question": "Do NOT choose the first option. Choose the third.", "answer": "Option 3"},
    6: {"question": "Which word contains more vowels? (apple/orange)", "answer": "orange"},
    7: {
        "question": "Which of these words contains double letters? (melon/apple/plum)",
        "answer": "apple",
    },
}

# Original paper results from "Modeling Color Difference for Visualization Design"
# Table 1: Regression results for points, where p = m_x * ΔX
ORIGINAL_PAPER_RESULTS = {
    "regression": {
        "L": {
            0.25: {"slope": 0.059, "r2": 0.948, "nd50": 8.37},
            0.5: {"slope": 0.074, "r2": 0.97, "nd50": 6.74},
            0.75: {"slope": 0.087, "r2": 0.981, "nd50": 5.75},
            1.0: {"slope": 0.087, "r2": 0.965, "nd50": 5.75},
            1.5: {"slope": 0.082, "r2": 0.996, "nd50": 6.08},
            2.0: {"slope": 0.091, "r2": 0.974, "nd50": 5.47},
        },
        "a": {
            0.25: {"slope": 0.031, "r2": 0.984, "nd50": 16.11},
            0.5: {"slope": 0.05, "r2": 0.988, "nd50": 9.98},
            0.75: {"slope": 0.059, "r2": 0.987, "nd50": 8.52},
            1.0: {"slope": 0.064, "r2": 0.992, "nd50": 7.81},
            1.5: {"slope": 0.073, "r2": 0.985, "nd50": 6.87},
            2.0: {"slope": 0.073, "r2": 0.994, "nd50": 6.84},
        },
        "b": {
            0.25: {"slope": 0.026, "r2": 0.978, "nd50": 19.46},
            0.5: {"slope": 0.037, "r2": 0.988, "nd50": 13.34},
            0.75: {"slope": 0.044, "r2": 0.994, "nd50": 11.35},
            1.0: {"slope": 0.05, "r2": 0.979, "nd50": 10.03},
            1.5: {"slope": 0.056, "r2": 0.979, "nd50": 8.97},
            2.0: {"slope": 0.063, "r2": 0.99, "nd50": 7.99},
        },
    },
    # Inverse-size model: ND_x(p, s) = p / (c_x + k_x / s)
    "inverse_model": {
        "L": {"c": 0.0937, "k": -0.0085, "r2": 0.9},
        "a": {"c": 0.0775, "k": -0.0121, "r2": 0.97},
        "b": {"c": 0.0611, "k": -0.0096, "r2": 0.9},
    },
    "study_params": {
        "n_per_axis": 24,
        "n_total": 72,
        "trials_per_participant": 72,
        "n_sizes": 6,
        "n_delta_e_levels": 6,
        "n_reps": 2,
    },
}

AXIS_ORDER = {"L": 0, "a": 1, "b": 2}
