FROM python:3.13-slim AS base

RUN groupadd -r vector && useradd -r -g vector vector

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data/pdfs /app/debug && chown -R vector:vector /app

USER vector

# Persistent data: dashboard.db, blog.db, uploaded PDFs
VOLUME ["/app/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
