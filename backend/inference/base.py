from typing import Protocol


class DecisionError(Exception):
    """Safe, public inference failure; never includes server bodies or credentials."""


class DecisionModel(Protocol):
    def analyze(self, state, questions, timeout):
        """Return normalized answers keyed by question ID."""
        ...
