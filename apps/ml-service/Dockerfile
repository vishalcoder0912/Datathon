FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the KAVACH FastAPI package. The legacy app.py remains available only
# when KAVACH_INCLUDE_LEGACY_ML_ROUTES=true is explicitly configured.
COPY app ./app
COPY app.py ./app.py
COPY fast_dashboard_engine.py ./fast_dashboard_engine.py
COPY pdf_intelligence ./pdf_intelligence

# Set environment
ENV PORT=5000
ENV PYTHONUNBUFFERED=1
ENV KAVACH_INCLUDE_LEGACY_ML_ROUTES=false

# Expose port
EXPOSE 5000

# Run app
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
