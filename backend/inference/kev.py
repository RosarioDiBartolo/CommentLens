import math

import requests

from .base import DecisionError


def probability(value):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or not 0 <= value <= 1):
        raise ValueError('Invalid probability')
    return float(value)


def normalize_answers(answers, questions):
    """Validate the wire contract and preserve distributions, not just winners."""
    normalized = {}
    try:
        for key, question in questions.items():
            answer = answers[key]
            kind = question['type']
            if answer['type'] != kind:
                raise ValueError('Wrong answer type')
            if kind == 'noul':
                yes = probability(answer['noul'])
                probs = {'yes': yes, 'no': 1 - yes}
            else:
                labels = (list(question['criteria']) if kind == 'choice'
                          else [str(i) for i in range(len(question['criteria']))])
                wire = answer['probabilities']
                if set(wire) != set(labels):
                    raise ValueError('Wrong labels')
                probs = {label: probability(wire[label]) for label in labels}
                if not math.isclose(sum(probs.values()), 1, abs_tol=0.01):
                    raise ValueError('Invalid distribution')
                total = sum(probs.values())
                probs = {label: p / total for label, p in probs.items()}
                if kind == 'score':
                    probs = {label: probs[str(i)] for i, label in enumerate(question['criteria'])}
            result = {'label': max(probs, key=probs.get), 'probabilities': probs}
            if kind == 'score':
                result['score'] = sum(i * p for i, p in enumerate(probs.values()))
            normalized[key] = result
    except (KeyError, TypeError, ValueError, AttributeError) as error:
        raise DecisionError('The decision server returned an invalid response.') from error
    return normalized


class KevDecisionModel:
    def __init__(self, base_url, model='kev-latest', api_key=''):
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.headers = {'Authorization': f'Bearer {api_key}'} if api_key else {}

    def analyze(self, state, questions, timeout=60):
        try:
            response = requests.post(
                f'{self.base_url}/v1/systemone',
                json={'state': state, 'questions': questions, 'model': self.model},
                headers=self.headers, timeout=timeout, allow_redirects=False)
            if response.status_code != 200:
                raise DecisionError('The decision server is unavailable or rejected the request.')
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError('Invalid response')
            return normalize_answers(payload.get('answers'), questions)
        except (requests.RequestException, ValueError) as error:
            raise DecisionError('Could not reach the decision server or read its response.') from error
