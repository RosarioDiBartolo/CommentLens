from .kev import normalize_answers


class MockDecisionModel:
    """Fixed fixtures for offline UI development, never presented as inference."""
    def analyze(self, state, questions, timeout=60):
        return normalize_answers({
            'sentiment': {'type': 'choice', 'probabilities': {
                'positive': 0.7, 'neutral': 0.2, 'negative': 0.1}},
            'stance': {'type': 'choice', 'probabilities': {
                'agrees': 0.5, 'mixed': 0.1, 'disagrees': 0.1, 'unclear': 0.3}},
            'question': {'type': 'noul', 'noul': 0.2},
            'toxicity': {'type': 'score', 'probabilities': {'0': 0.9, '1': 0.08, '2': 0.02}},
        }, questions)
