"""Port of analysis/exp1/src/lib/data-loader.ts.

Loads the three ReVISit condition exports, extracts demographics, attention
checks, experiment info, and scatterplot trial responses, then joins trials
with the ground-truth scatterplot metadata.
"""

from __future__ import annotations

import re
from pathlib import Path

import orjson
import pandas as pd

from color_analysis import EXP1_DATA_DIR
from color_analysis.exp1.constants import (
    ATTENTION_CHECK_QUESTIONS,
    EXCLUDED_PARTICIPANT_IDS,
)

_TRIAL_KEY_RE = re.compile(r"scatterplot(-(samecolor|largediff))?-\d+_(\d+)")
_VEGA_PATH_RE = re.compile(r"scatterplot_(\d+)\.json")
_ATTENTION_KEY_RE = re.compile(r"attention-check-(\d+)_(\d+)")

CONDITION_FILES = {
    "L": "colormap-makeup-L_all.json",
    "a": "colormap-makeup-a_all.json",
    "b": "colormap-makeup-b_all.json",
}


def _parse_browser_info(user_agent: str) -> str:
    if not user_agent:
        return "Unknown"

    browser = "Unknown Browser"
    if "Firefox" in user_agent:
        browser = "Firefox"
    elif "Edg" in user_agent:
        browser = "Edge"
    elif "Chrome" in user_agent:
        browser = "Chrome"
    elif "Safari" in user_agent:
        browser = "Safari"

    os_name = "Unknown OS"
    if "Windows" in user_agent:
        os_name = "Windows"
    elif "Mac OS" in user_agent or "Macintosh" in user_agent:
        os_name = "macOS"
    elif "Linux" in user_agent:
        os_name = "Linux"
    elif "Android" in user_agent:
        os_name = "Android"
    elif "iPhone" in user_agent or "iPad" in user_agent:
        os_name = "iOS"

    return f"{browser} on {os_name}"


def _load_json(path: Path):
    if not path.exists():
        raise FileNotFoundError(
            f"Missing data file: {path}\n"
            "Export the ReVISit participant JSON files and place them in "
            f"{path.parent} (see the README there)."
        )
    return orjson.loads(path.read_bytes())


def _extract_demographics(pid: str, answers: dict) -> dict:
    demo = {
        "participantId": pid,
        "gender": "Not specified",
        "age": "Not specified",
        "education": "Not specified",
        "gender_other": "",
        "education_other": "",
        "strategies": "Not specified",
        "color_hobby": "Not specified",
        "color_theory_class": "Not specified",
        "color_theory_knowledge": "Not specified",
        "color_theory_knowledge_2": "Not specified",
        "makeup_familiarity": "Not specified",
        "use_makeup": "Not specified",
        "foundation_shade": "Not specified",
        "makeup_products": "Not specified",
    }

    def _join(value):
        if isinstance(value, list):
            return ", ".join(value)
        return str(value) if value is not None else "Not specified"

    for key, value in answers.items():
        key_lower = key.lower()
        answer = (value or {}).get("answer") if isinstance(value, dict) else None

        if "demographic-questionnaire-color-theory" in key_lower:
            if answer:
                demo["strategies"] = answer.get("strategies") or "Not specified"
                demo["color_hobby"] = _join(answer.get("color-hobby"))
                demo["color_theory_class"] = answer.get("color-theory-class") or "Not specified"
                demo["color_theory_knowledge"] = (
                    answer.get("color-theory-knowledge") or "Not specified"
                )
                demo["color_theory_knowledge_2"] = (
                    answer.get("color-theory-knowledge-2") or "Not specified"
                )
        elif "demographic-questionnaire-makeup" in key_lower:
            if answer:
                demo["makeup_familiarity"] = answer.get("makeup-familiarity") or "Not specified"
                demo["use_makeup"] = answer.get("use-makeup") or "Not specified"
                demo["foundation_shade"] = answer.get("foundation-shade") or "Not specified"
                demo["makeup_products"] = _join(answer.get("makeup-products"))
        elif (
            "demographic" in key_lower
            and "color-theory" not in key_lower
            and "makeup" not in key_lower
        ):
            if answer:
                demo["gender"] = answer.get("gender") or "Not specified"
                demo["age"] = answer.get("age") or "Not specified"
                demo["education"] = answer.get("education") or "Not specified"
                demo["gender_other"] = answer.get("gender-other") or ""
                demo["education_other"] = answer.get("education-other") or ""

    return demo


def _extract_attention_checks(answers: dict) -> list[dict]:
    checks = []
    for key, value in answers.items():
        match = _ATTENTION_KEY_RE.search(key.lower())
        if not match or not isinstance(value, dict):
            continue

        ac_number = int(match.group(1))
        question_id = f"attention-check{ac_number}"
        answer = value.get("answer") or {}
        participant_answer = answer.get(question_id)

        correct_answer = None
        for ca in value.get("correctAnswer") or []:
            if ca.get("id") == question_id:
                correct_answer = ca.get("answer")
                break

        checks.append(
            {
                "number": ac_number,
                "question": ATTENTION_CHECK_QUESTIONS.get(ac_number, {}).get(
                    "question", f"Attention Check #{ac_number}"
                ),
                "participant_answer": participant_answer
                if participant_answer is not None
                else "No answer",
                "correct_answer": correct_answer,
                "is_correct": participant_answer is not None
                and participant_answer == correct_answer,
            }
        )

    checks.sort(key=lambda c: c["number"])
    return checks


def _extract_color_blindness(answers: dict) -> list[dict]:
    results = []
    for key, value in answers.items():
        if "color-blindness" not in key.lower() or not isinstance(value, dict):
            continue

        answer = value.get("answer")
        correct_answers = value.get("correctAnswer")
        if not answer:
            continue

        for response_key, response_val in answer.items():
            if "response" not in response_key or "dontKnow" in response_key:
                continue

            correct_val = None
            for ca in correct_answers or []:
                if ca.get("id") == response_key:
                    correct_val = ca.get("answer")
                    break

            results.append(
                {
                    "plate": response_key,
                    "answer": str(response_val),
                    "correct": correct_val,
                    "is_correct": response_val == correct_val,
                }
            )

    return results


def _extract_experiment_info(participant: dict, answers: dict) -> dict:
    metadata_info = participant.get("metadata") or {}
    resolution = metadata_info.get("resolution") or {}
    search_params = participant.get("searchParams") or {}

    start_times = []
    end_times = []
    for val in answers.values():
        if isinstance(val, dict):
            if val.get("startTime"):
                start_times.append(val["startTime"])
            if val.get("endTime"):
                end_times.append(val["endTime"])

    duration_minutes = None
    start_timestamp = None
    if start_times and end_times:
        first_start = min(start_times)
        last_end = max(end_times)
        duration_minutes = (last_end - first_start) / 1000 / 60
        start_timestamp = first_start

    cb_results = _extract_color_blindness(answers)

    return {
        "browser": _parse_browser_info(metadata_info.get("userAgent") or ""),
        "language": metadata_info.get("language") or "N/A",
        "screen_width": resolution.get("width"),
        "screen_height": resolution.get("height"),
        "color_depth": resolution.get("colorDepth"),
        "orientation": resolution.get("orientation") or "N/A",
        "duration_minutes": duration_minutes,
        "start_timestamp": start_timestamp,
        "stage": participant.get("stage") or "N/A",
        "rejected": participant.get("rejected") or False,
        "participant_tags": participant.get("participantTags") or [],
        "prolific_study_id": search_params.get("STUDY_ID") or "N/A",
        "prolific_session_id": search_params.get("SESSION_ID") or "N/A",
        "color_blindness_passed": sum(1 for r in cb_results if r["is_correct"]),
        "color_blindness_total": len(cb_results),
        "color_blindness_results": cb_results,
    }


def _extract_trial_responses(pid: str, condition: str, completed: bool, answers: dict) -> list[dict]:
    responses = []
    for key, value in answers.items():
        if "scatterplot" not in key.lower() or not isinstance(value, dict):
            continue

        id_match = _TRIAL_KEY_RE.search(key)
        if not id_match:
            continue

        trial_type = id_match.group(2) or "standard"
        trial_order = int(id_match.group(3))

        vega_path = (value.get("parameters") or {}).get("vegaSpecPath") or ""
        vega_match = _VEGA_PATH_RE.search(vega_path)
        if not vega_match:
            continue

        answer_dict = value.get("answer") or {}
        answer = answer_dict.get("scatterplot-response")
        if answer:
            answer = answer.strip()
            answer = answer[:1].upper() + answer[1:].lower()
        else:
            answer = None

        correct_answer_list = value.get("correctAnswer") or []
        correct_answer = correct_answer_list[0]["answer"] if correct_answer_list else None

        start_time = value.get("startTime") or 0
        end_time = value.get("endTime") if value.get("endTime") is not None else -1
        rt_ms = end_time - start_time if end_time > start_time else None

        responses.append(
            {
                "participantId": pid,
                "condition": condition,
                "completed": completed,
                "stimulus_id": key,
                "scatter_index": int(vega_match.group(1)),
                "trial_order": trial_order,
                "trial_type": trial_type,
                "answer": answer,
                "correct_answer": correct_answer,
                "start_time_ms": start_time,
                "end_time_ms": end_time,
                "rt_ms": rt_ms,
                "vega_spec_path": vega_path,
            }
        )

    return responses


def load_all_data(data_dir: Path = EXP1_DATA_DIR) -> dict:
    """Load metadata and all three condition files.

    Returns a dict with ``metadata`` (raw dict), ``responses`` (DataFrame),
    ``demographics`` (DataFrame), ``attention_checks`` (dict pid -> list),
    and ``experiment_info`` (dict pid -> dict).
    """
    metadata = _load_json(data_dir / "scatterplots_metadata.json")

    demographics_list: list[dict] = []
    attention_checks: dict[str, list[dict]] = {}
    experiment_info: dict[str, dict] = {}
    seen: set[str] = set()
    all_responses: list[dict] = []

    for condition, filename in CONDITION_FILES.items():
        for participant in _load_json(data_dir / filename):
            pid = participant["participantId"]
            if pid in EXCLUDED_PARTICIPANT_IDS:
                continue

            completed = participant.get("completed") or False
            answers = participant.get("answers") or {}

            if pid not in seen:
                demographics_list.append(_extract_demographics(pid, answers))
                attention_checks[pid] = _extract_attention_checks(answers)
                experiment_info[pid] = _extract_experiment_info(participant, answers)
                seen.add(pid)

            all_responses.extend(_extract_trial_responses(pid, condition, completed, answers))

    return {
        "metadata": metadata,
        "responses": pd.DataFrame(all_responses),
        "demographics": pd.DataFrame(demographics_list),
        "attention_checks": attention_checks,
        "experiment_info": experiment_info,
    }


def build_trial_dataframe(responses: pd.DataFrame, metadata: dict) -> pd.DataFrame:
    """Join trial responses with ground-truth scatterplot metadata."""
    metadata_map: dict[str, dict] = {}
    for item in metadata["scatterplots"]:
        metadata_map[f"{item['index']}-{item['axis']}"] = item
        metadata_map.setdefault(str(item["index"]), item)

    rows = []
    for response in responses.to_dict("records"):
        if response["trial_type"] == "standard":
            meta = metadata_map.get(f"{response['scatter_index']}-{response['condition']}")
        else:
            meta = metadata_map.get(str(response["scatter_index"]))

        delta_e = meta["delta_e"] if meta else 0
        reported_diff = response["answer"] == "Different"
        reported_same = response["answer"] == "Same"
        is_diff_trial = delta_e != 0
        is_same_trial = delta_e == 0

        rows.append(
            {
                **response,
                "axis": meta["axis"] if meta else None,
                "diff_type": meta["diff_type"] if meta else None,
                "delta_e": delta_e,
                "point_diameter_degrees": meta["point_diameter_degrees"] if meta else None,
                "reported_diff": reported_diff,
                "reported_same": reported_same,
                "is_diff_trial": is_diff_trial,
                "is_same_trial": is_same_trial,
                "correct": (is_diff_trial and reported_diff) or (is_same_trial and reported_same),
                "is_correct": response["answer"] == response["correct_answer"],
            }
        )

    return pd.DataFrame(rows)


def apply_exclusion(trials: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Annotate engagement metrics and filter to standard trials.

    Mirrors the website: engagement metrics come from the special samecolor +
    largediff trials, mean RT from all trials; no participants are actually
    excluded. Returns ``(analysis_trials, participant_summary)``.
    """
    trials = trials.copy()

    special = trials[trials["trial_type"].isin(["samecolor", "largediff"])]
    wrong_special = (
        special[~special["correct"]].groupby("participantId").size()
        if len(special)
        else pd.Series(dtype=int)
    )
    mean_rt = trials.dropna(subset=["rt_ms"]).groupby("participantId")["rt_ms"].mean()

    trials["n_wrong_same"] = (
        trials["participantId"].map(wrong_special).fillna(0).astype(int)
    )
    trials["mean_rt_ms"] = trials["participantId"].map(mean_rt)
    trials["excluded"] = False

    summary = (
        trials.groupby(["participantId", "condition"])
        .agg(
            n_trials=("participantId", "size"),
            n_diff_trials=("is_diff_trial", "sum"),
            n_same_trials=("is_same_trial", "sum"),
            n_wrong_same=("n_wrong_same", "first"),
            mean_rt_ms=("mean_rt_ms", "first"),
            excluded=("excluded", "first"),
        )
        .reset_index()
    )

    filtered = trials[trials["trial_type"] == "standard"].reset_index(drop=True)
    return filtered, summary
