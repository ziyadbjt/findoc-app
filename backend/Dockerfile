FROM python:3.11-slim

WORKDIR /app

# Système requis pour chromadb / sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Dépendances RAG (optionnelles mais embarquées dans l'image)
RUN pip install --no-cache-dir chromadb sentence-transformers

COPY . .

# Dossier persistant pour SQLite + ChromaDB
RUN mkdir -p /data/chroma_db

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
