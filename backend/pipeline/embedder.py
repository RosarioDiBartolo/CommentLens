MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
# Pin the weights so saved vectors have an unambiguous model identity.
MODEL_REVISION = '1110a243fdf4706b3f48f1d95db1a4f5529b4d41'
MODEL_VERSION = f'{MODEL_NAME}@{MODEL_REVISION}'

_model = None

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(MODEL_NAME, revision=MODEL_REVISION)
    return _model

def get_embeddings(cleaned_comments):
    # CRITICAL: Extract the pure semantic text fingerprint, not the raw text block
    texts = [c["search_text"] for c in cleaned_comments]
    return get_model().encode(texts)
