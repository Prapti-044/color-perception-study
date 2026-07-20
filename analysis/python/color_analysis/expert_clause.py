"""Expert/non-expert clause logic shared by exp1 and exp2.

Port of ``analysis/exp1/src/lib/utils.ts`` and
``analysis/exp2/src/lib/expertClause.ts`` (the clause logic is identical in
both apps).

A clause is a nested structure of group nodes (``AND``/``OR``) and predicate
nodes. Demographics are plain dicts with string values, using the same field
names as the websites: ``makeup_familiarity``, ``use_makeup``,
``makeup_products``, ``color_hobby``, ``color_theory_class``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

EMPTY_EXPERT_RESPONSES = {"", "Not specified"}
MAKEUP_PRODUCTS_NONE_VALUE = "None"
COLOR_HOBBY_NONE_VALUE = "I don't participate in any of the above"

_CHECKBOX_NONE_VALUES = {
    "makeup_products": MAKEUP_PRODUCTS_NONE_VALUE,
    "color_hobby": COLOR_HOBBY_NONE_VALUE,
}


@dataclass(frozen=True)
class Predicate:
    """A single condition: ``equals``, ``contains``, or ``contains_any_non_none``."""

    field: str
    operator: str
    value: str | None = None


@dataclass(frozen=True)
class Group:
    """A boolean combination (``AND``/``OR``) of predicates and sub-groups."""

    operator: str = "OR"
    children: tuple = field(default_factory=tuple)


ClauseNode = Predicate | Group


def get_default_expert_clause() -> Group:
    """Same default clause as both websites.

    Expert if: uses makeup regularly or professionally, OR took a color
    theory class, OR has any color-related hobby.
    """
    return Group(
        "OR",
        (
            Group(
                "OR",
                (
                    Predicate("use_makeup", "equals", "I use it regularly"),
                    Predicate("use_makeup", "equals", "I use it professionally"),
                ),
            ),
            Predicate("color_theory_class", "equals", "Yes"),
            Predicate("color_hobby", "contains_any_non_none"),
        ),
    )


def get_expert_clause_summary(node: ClauseNode, is_root: bool = True) -> str:
    """Human-readable summary of a clause (mirrors the website header text)."""
    if isinstance(node, Predicate):
        label = node.field.replace("_", " ")
        if node.operator == "contains_any_non_none":
            return f"{label} contains any non-none option"
        if node.operator == "contains":
            return f"{label} contains {node.value}"
        return f"{label} = {node.value}"

    if not node.children:
        return "(empty expert clause)" if is_root else "(empty group)"

    summary = f" {node.operator} ".join(
        get_expert_clause_summary(child, is_root=False) for child in node.children
    )
    return summary if is_root else f"({summary})"


def _parse_checkbox_selections(value: str) -> list[str]:
    if not value:
        return []
    return [
        entry.strip()
        for entry in value.split(",")
        if entry.strip() and entry.strip() != "Not specified"
    ]


def _matches_predicate(predicate: Predicate, demographics: dict) -> bool:
    raw_value = str(demographics.get(predicate.field, "") or "").strip()
    if raw_value in EMPTY_EXPERT_RESPONSES:
        return False

    if predicate.operator == "equals":
        return raw_value == predicate.value

    selections = _parse_checkbox_selections(raw_value)
    if not selections:
        return False

    if predicate.operator == "contains":
        return predicate.value is not None and predicate.value in selections

    none_value = _CHECKBOX_NONE_VALUES.get(predicate.field)
    return none_value is not None and any(s != none_value for s in selections)


def evaluate_expert_clause(node: ClauseNode, demographics: dict) -> bool:
    """Evaluate a clause against one participant's demographics dict."""
    if isinstance(node, Predicate):
        return _matches_predicate(node, demographics)

    if not node.children:
        return False

    if node.operator == "AND":
        return all(evaluate_expert_clause(child, demographics) for child in node.children)
    return any(evaluate_expert_clause(child, demographics) for child in node.children)


def get_participants_by_expert_clause(
    demographics_list: list[dict], clause: ClauseNode
) -> tuple[set[str], set[str]]:
    """Split participant IDs into ``(expert, non_expert)`` sets."""
    expert: set[str] = set()
    non_expert: set[str] = set()

    for demo in demographics_list:
        pid = demo["participantId"]
        if evaluate_expert_clause(clause, demo):
            expert.add(pid)
        else:
            non_expert.add(pid)

    return expert, non_expert
