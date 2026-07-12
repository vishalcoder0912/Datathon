from __future__ import annotations

import hashlib
import math
from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    import polars as pl
except Exception:  # pragma: no cover - optional acceleration
    pl = None

from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.cluster import KMeans

try:
    import duckdb
except Exception:  # pragma: no cover - optional health visibility
    duckdb = None

from fast_dashboard_engine import prepare_dataset_file, run_fast_dashboard
from pdf_intelligence.pdf_detector import detect_pdf_page_modes
from pdf_intelligence.pdf_intelligence_engine import analyze_pdf
from pdf_intelligence.pdf_ocr_engine import run_ocr_for_pdf
from pdf_intelligence.pdf_table_extractor import extract_tables_hybrid
from pdf_intelligence.messy_table_cleaner import clean_extracted_table

MAX_ANALYTICS_ROWS = 50_000
MAX_RESPONSE_ROWS = 500
analytics_cache: dict[str, Any] = {}
trained_models: dict[str, Any] = {}

app = FastAPI(title="InsightFlow Analytics ML Service", version="3.0.0")


class DatasetPayload(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    columns: list[Any] = Field(default_factory=list)
    datasetId: str | None = None
    target: str | None = None
    method: str | None = None
    nClusters: int = 3


class PredictPayload(BaseModel):
    modelId: str | None = None
    rows: list[dict[str, Any]] = Field(default_factory=list)


class ComparePayload(BaseModel):
    left: DatasetPayload
    right: DatasetPayload


class RagTrainingPayload(DatasetPayload):
    dataset_name: str = "dataset"
    goal: str = "agentic analytics"
    max_examples: int = 50


class FastDashboardRequest(BaseModel):
    file_path: str
    metric_priority: list[str] | None = None
    group_limit: int = 10


class PrepareDatasetRequest(BaseModel):
    file_path: str
    output_path: str | None = None


class PdfAnalyzeRequest(BaseModel):
    file_path: str
    document_id: str | None = None
    ocr_enabled: bool = True
    force_ocr: bool = False
    extract_tables: bool = True
    store_chunks: bool = False
    max_pages: int | None = None


class PdfAnalyzePageRequest(BaseModel):
    file_path: str
    document_id: str | None = None
    page_number: int
    ocr_enabled: bool = True


class PdfTableExtractRequest(BaseModel):
    file_path: str
    ocr_enabled: bool = True


class PdfOcrRequest(BaseModel):
    file_path: str
    pages: list[int] | None = None
    dpi: int | None = None


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(val) for key, val in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if math.isnan(float(value)) or math.isinf(float(value)):
            return None
        return float(value)
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    if pd.isna(value):
        return None
    return value


def _dataframe(rows: list[dict[str, Any]]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    if pl is not None and len(rows) > 10_000:
        return pl.DataFrame(rows).to_pandas()
    return pd.DataFrame(rows)


def _sample(df: pd.DataFrame, limit: int = MAX_ANALYTICS_ROWS) -> pd.DataFrame:
    if len(df) <= limit:
        return df
    return df.sample(n=limit, random_state=42)


def _column_names(payload: DatasetPayload, df: pd.DataFrame) -> list[str]:
    if payload.columns:
        names = []
        for column in payload.columns:
            if isinstance(column, dict):
                names.append(str(column.get("name", "")))
            else:
                names.append(str(column))
        return [name for name in names if name]
    return [str(column) for column in df.columns]


def _schema(df: pd.DataFrame) -> dict[str, str]:
    return {str(column): str(dtype) for column, dtype in df.dtypes.items()}


def _fingerprint(df: pd.DataFrame, columns: list[str]) -> str:
    sample = df.head(100).to_json(orient="records", date_format="iso")
    payload = {
        "columns": columns,
        "rowCount": int(len(df)),
        "schema": _schema(df),
        "sampleHash": hashlib.sha256(sample.encode("utf-8")).hexdigest(),
    }
    return hashlib.sha256(str(payload).encode("utf-8")).hexdigest()


def _cached(endpoint: str, payload: DatasetPayload, builder):
    df = _dataframe(payload.rows)
    columns = _column_names(payload, df)
    cache_key = f"{endpoint}:{_fingerprint(df, columns)}:{payload.target}:{payload.method}:{payload.nClusters}"
    if cache_key in analytics_cache:
        cached = dict(analytics_cache[cache_key])
        cached["cacheHit"] = True
        return cached
    result = builder(_sample(df), columns)
    result["fingerprint"] = cache_key.split(":", 1)[1]
    result["cacheHit"] = False
    analytics_cache[cache_key] = result
    return result


def _numeric_columns(df: pd.DataFrame) -> list[str]:
    return [str(column) for column in df.select_dtypes(include=[np.number]).columns]


def _prepare_xy(df: pd.DataFrame, target: str):
    if target not in df.columns:
        raise HTTPException(status_code=400, detail=f'Target column "{target}" not found')
    clean = df.dropna(subset=[target])
    if clean.empty:
        raise HTTPException(status_code=400, detail="No rows with target values")
    x = clean.drop(columns=[target])
    y = clean[target]
    numeric_features = list(x.select_dtypes(include=[np.number]).columns)
    categorical_features = [column for column in x.columns if column not in numeric_features]
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), numeric_features),
            ("cat", make_pipeline(SimpleImputer(strategy="most_frequent"), OneHotEncoder(handle_unknown="ignore")), categorical_features),
        ],
        remainder="drop",
    )
    is_regression = pd.api.types.is_numeric_dtype(y) and y.nunique(dropna=True) > 10
    return x, y, preprocessor, is_regression


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy",
        "engine": "fastapi",
        "polarsAvailable": pl is not None,
        "duckdbAvailable": duckdb is not None,
        "fastDashboardEngine": duckdb is not None,
        "pdfIntelligenceAvailable": True,
        "cacheEntries": len(analytics_cache),
    }


@app.post("/fast-dashboard")
def fast_dashboard(payload: FastDashboardRequest):
    try:
        return run_fast_dashboard(
            file_path=payload.file_path,
            metric_priority=payload.metric_priority,
            group_limit=payload.group_limit,
        )
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/prepare-dataset")
def prepare_dataset(payload: PrepareDatasetRequest):
    try:
        return prepare_dataset_file(
            file_path=payload.file_path,
            output_path=payload.output_path,
        )
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/pdf-intelligence/health")
def pdf_intelligence_health():
    def available(module_name: str) -> bool:
        try:
            __import__(module_name)
            return True
        except Exception:
            return False

    tesseract_available = False
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        tesseract_available = True
    except Exception:
        tesseract_available = False

    return {
        "available": True,
        "engines": {
            "pymupdf": available("fitz"),
            "pdfplumber": available("pdfplumber"),
            "tesseract": tesseract_available,
            "opencv": available("cv2"),
        },
    }


@app.post("/pdf-intelligence/analyze")
def pdf_intelligence_analyze(payload: PdfAnalyzeRequest):
    try:
        return analyze_pdf(
            file_path=payload.file_path,
            document_id=payload.document_id,
            options={
                "ocr_enabled": payload.ocr_enabled,
                "force_ocr": payload.force_ocr,
                "extract_tables": payload.extract_tables,
                "store_chunks": payload.store_chunks,
                "max_pages": payload.max_pages,
            },
        )
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/pdf-intelligence/analyze-page")
def pdf_intelligence_analyze_page(payload: PdfAnalyzePageRequest):
    try:
        return analyze_pdf(
            file_path=payload.file_path,
            document_id=payload.document_id,
            options={
                "ocr_enabled": payload.ocr_enabled,
                "extract_tables": False,
                "max_pages": payload.page_number,
            },
        )
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/pdf-intelligence/ocr")
def pdf_intelligence_ocr(payload: PdfOcrRequest):
    try:
        return run_ocr_for_pdf(file_path=payload.file_path, pages=payload.pages, dpi=payload.dpi or 250)
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/pdf-intelligence/extract-tables")
def pdf_intelligence_extract_tables(payload: PdfTableExtractRequest):
    try:
        detection = detect_pdf_page_modes(payload.file_path)
        pages = []
        for page in detection.get("pages", []):
            if page.get("needsOCR") and payload.ocr_enabled:
                ocr = run_ocr_for_pdf(payload.file_path, pages=[page["pageNumber"]])
                pages.extend(ocr.get("pages", []))
            else:
                pages.append({"pageNumber": page["pageNumber"], "method": "digital_text", "text": ""})
        tables = [clean_extracted_table(table) for table in extract_tables_hybrid(payload.file_path, pages) if table.get("rawRows")]
        return {"tables": tables, "tableCount": len(tables), "warnings": [warning for table in tables for warning in table.get("warnings", [])]}
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/profile")
def profile(payload: DatasetPayload):
    def build(df: pd.DataFrame, columns: list[str]):
        missing = {column: int(df[column].isna().sum()) if column in df else 0 for column in columns}
        numeric = df.select_dtypes(include=[np.number])
        categorical = df.select_dtypes(exclude=[np.number, "datetime64[ns]"])
        measures = [str(column) for column in numeric.columns]
        dimensions = [str(column) for column in categorical.columns]
        dates = {
            column: {
                "min": _json_safe(pd.to_datetime(df[column], errors="coerce").min()),
                "max": _json_safe(pd.to_datetime(df[column], errors="coerce").max()),
            }
            for column in columns
            if column in df and pd.to_datetime(df[column], errors="coerce").notna().mean() > 0.7
        }
        total_cells = max(len(df) * max(len(columns), 1), 1)
        missing_cells = sum(missing.values())
        return _json_safe({
            "rowCount": int(len(df)),
            "columnCount": int(len(columns)),
            "columns": [{"name": column, "type": str(df[column].dtype) if column in df else "unknown"} for column in columns],
            "measures": measures,
            "dimensions": dimensions,
            "missingValues": missing,
            "numericSummary": numeric.describe().to_dict() if not numeric.empty else {},
            "categoricalSummary": {
                column: {
                    "unique": int(categorical[column].nunique(dropna=True)),
                    "top": categorical[column].mode(dropna=True).iloc[0] if not categorical[column].mode(dropna=True).empty else None,
                }
                for column in categorical.columns
            },
            "dateSummary": dates,
            "qualityScore": round(100 * (1 - missing_cells / total_cells), 2),
        })

    return _cached("profile", payload, build)


@app.post("/correlations")
def correlations(payload: DatasetPayload):
    def build(df: pd.DataFrame, _columns: list[str]):
        numeric = df.select_dtypes(include=[np.number])
        matrix_df = numeric.corr(method=payload.method or "pearson").fillna(0) if len(numeric.columns) else pd.DataFrame()
        strong_pairs = []
        for i, left in enumerate(matrix_df.columns):
            for right in matrix_df.columns[i + 1:]:
                coefficient = float(matrix_df.loc[left, right])
                if abs(coefficient) >= 0.7:
                    strong_pairs.append({"columnA": left, "columnB": right, "coefficient": round(coefficient, 4)})
        return _json_safe({"method": payload.method or "pearson", "matrix": matrix_df.to_dict(), "strongPairs": strong_pairs})

    return _cached("correlations", payload, build)


@app.post("/anomalies")
def anomalies(payload: DatasetPayload):
    def build(df: pd.DataFrame, _columns: list[str]):
        numeric_cols = _numeric_columns(df)
        anomalies_found = []
        method = payload.method or ("isolation_forest" if len(df) >= 20 and numeric_cols else "zscore")
        if not numeric_cols:
            return {"method": method, "anomalies": [], "summary": {"count": 0}}
        numeric = df[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(df[numeric_cols].median(numeric_only=True))
        if method == "isolation_forest" and len(numeric) >= 20:
            model = IsolationForest(contamination="auto", random_state=42)
            labels = model.fit_predict(numeric)
            scores = model.decision_function(numeric)
            for index, label in enumerate(labels):
                if label == -1 and len(anomalies_found) < MAX_RESPONSE_ROWS:
                    anomalies_found.append({"row": int(index), "score": float(scores[index]), "method": "isolation_forest"})
        else:
            zscores = ((numeric - numeric.mean()) / numeric.std(ddof=0)).replace([np.inf, -np.inf], np.nan).fillna(0)
            for row_index, row in zscores.iterrows():
                for column, zscore in row.items():
                    if abs(float(zscore)) >= 3 and len(anomalies_found) < MAX_RESPONSE_ROWS:
                        anomalies_found.append({"row": int(row_index), "column": column, "zScore": round(float(zscore), 4)})
        return {"method": method, "anomalies": anomalies_found, "summary": {"count": len(anomalies_found), "numericColumns": numeric_cols}}

    return _cached("anomalies", payload, build)


@app.post("/feature-importance")
def feature_importance(payload: DatasetPayload):
    if not payload.target:
        raise HTTPException(status_code=400, detail="target is required")

    def build(df: pd.DataFrame, _columns: list[str]):
        x, y, preprocessor, is_regression = _prepare_xy(df, payload.target)
        model = RandomForestRegressor(n_estimators=80, random_state=42) if is_regression else RandomForestClassifier(n_estimators=80, random_state=42)
        pipeline = make_pipeline(preprocessor, model)
        pipeline.fit(x, y)
        importances = pipeline.named_steps[random_forest_step_name(pipeline)].feature_importances_
        features = [{"feature": f"feature_{index}", "importance": round(float(score), 6)} for index, score in enumerate(importances)]
        features.sort(key=lambda item: item["importance"], reverse=True)
        return {"target": payload.target, "features": features[:50]}

    return _cached("feature-importance", payload, build)


def random_forest_step_name(pipeline) -> str:
    return list(pipeline.named_steps.keys())[-1]


@app.post("/train-model")
def train_model(payload: DatasetPayload):
    if not payload.target:
        raise HTTPException(status_code=400, detail="target is required")
    df = _sample(_dataframe(payload.rows))
    x, y, preprocessor, is_regression = _prepare_xy(df, payload.target)
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.25, random_state=42)
    model = RandomForestRegressor(n_estimators=100, random_state=42) if is_regression else RandomForestClassifier(n_estimators=100, random_state=42)
    pipeline = make_pipeline(preprocessor, model)
    pipeline.fit(x_train, y_train)
    predictions = pipeline.predict(x_test)
    metrics = (
        {
            "r2": round(float(r2_score(y_test, predictions)), 4),
            "rmse": round(float(mean_squared_error(y_test, predictions) ** 0.5), 4),
            "mae": round(float(mean_absolute_error(y_test, predictions)), 4),
        }
        if is_regression
        else {"accuracy": round(float(accuracy_score(y_test, predictions)), 4)}
    )
    model_id = hashlib.sha256(f"{payload.datasetId}:{payload.target}:{len(trained_models)}".encode("utf-8")).hexdigest()[:16]
    trained_models[model_id] = {"model": pipeline, "target": payload.target, "modelType": "regression" if is_regression else "classification"}
    return {"modelType": trained_models[model_id]["modelType"], "target": payload.target, "metrics": metrics, "modelId": model_id, "warnings": []}


@app.post("/predict")
def predict(payload: PredictPayload):
    if not payload.modelId or payload.modelId not in trained_models:
        raise HTTPException(status_code=404, detail="model not found")
    model_info = trained_models[payload.modelId]
    predictions = model_info["model"].predict(_dataframe(payload.rows)).tolist()
    return {"modelId": payload.modelId, "predictions": _json_safe(predictions), "count": len(predictions)}


@app.post("/compare-datasets")
def compare_datasets(payload: ComparePayload):
    left_df = _dataframe(payload.left.rows)
    right_df = _dataframe(payload.right.rows)
    left_cols = set(_column_names(payload.left, left_df))
    right_cols = set(_column_names(payload.right, right_df))
    common = sorted(left_cols & right_cols)
    schema_drift = [
        {"column": column, "leftType": str(left_df[column].dtype), "rightType": str(right_df[column].dtype)}
        for column in common
        if column in left_df and column in right_df and str(left_df[column].dtype) != str(right_df[column].dtype)
    ]
    return {
        "sameSchema": left_cols == right_cols and not schema_drift,
        "commonColumns": common,
        "missingColumns": sorted(left_cols - right_cols),
        "extraColumns": sorted(right_cols - left_cols),
        "rowDifference": int(len(right_df) - len(left_df)),
        "schemaDrift": schema_drift,
    }


@app.post("/clustering")
def clustering(payload: DatasetPayload):
    def build(df: pd.DataFrame, _columns: list[str]):
        numeric_cols = _numeric_columns(df)
        if not numeric_cols:
            return {"method": "kmeans", "clusters": [], "summary": {"count": 0}}
        numeric = df[numeric_cols].apply(pd.to_numeric, errors="coerce").fillna(df[numeric_cols].median(numeric_only=True))
        n_clusters = min(max(int(payload.nClusters), 2), len(numeric))
        labels = KMeans(n_clusters=n_clusters, random_state=42, n_init=10).fit_predict(numeric)
        return {
            "method": "kmeans",
            "clusters": [{"row": int(index), "cluster": int(label)} for index, label in enumerate(labels[:MAX_RESPONSE_ROWS])],
            "summary": {"count": int(n_clusters), "numericColumns": numeric_cols},
        }

    return _cached("clustering", payload, build)


@app.post("/cluster")
def cluster(payload: DatasetPayload):
    return clustering(payload)


@app.post("/rag-training-records")
def rag_training_records(payload: RagTrainingPayload):
    profile_result = profile(DatasetPayload(rows=payload.rows, columns=payload.columns, datasetId=payload.datasetId))
    correlation_result = correlations(DatasetPayload(rows=payload.rows, columns=payload.columns, method="pearson"))

    schema = {
        "datasetName": payload.dataset_name,
        "rowCount": profile_result.get("rowCount", 0),
        "columnCount": profile_result.get("columnCount", 0),
        "measures": profile_result.get("measures", []),
        "dimensions": profile_result.get("dimensions", []),
        "qualityScore": profile_result.get("qualityScore"),
    }

    templates = [
        ("Profile this dataset", "Return schema, quality score, measures, dimensions, and missing values."),
        ("Find data quality issues", "Return missing values, duplicates, constant columns, and recommendations."),
        ("Recommend dashboard KPIs", "Return KPIs based only on numeric measures and valid dimensions."),
        ("Find correlations", "Return strong correlation pairs and explain possible business meaning."),
        ("Create chart plan", "Return chart types using existing columns only."),
    ]

    max_examples = max(1, min(int(payload.max_examples or 50), 200))
    examples = []
    for index in range(max_examples):
        instruction, expected = templates[index % len(templates)]
        examples.append({
            "instruction": f"{instruction} for {payload.dataset_name}. Goal: {payload.goal}.",
            "schema": schema,
            "expectedOutput": expected,
            "guardrail": "Do not hallucinate KPI values. Use deterministic analytics outputs only.",
        })

    column_names = ",".join(str(column.get("name")) for column in profile_result.get("columns", []))
    fingerprint_src = f"{payload.dataset_name}|{schema['rowCount']}|{schema['columnCount']}|{column_names}"
    fingerprint = hashlib.sha256(fingerprint_src.encode("utf-8")).hexdigest()
    chunks = [
        {
            "id": f"{fingerprint}:schema",
            "type": "schema_memory",
            "text": (
                f"Dataset {payload.dataset_name} has {schema['rowCount']} rows, "
                f"{schema['columnCount']} columns, measures {schema['measures']}, "
                f"dimensions {schema['dimensions']}, quality score {schema['qualityScore']}."
            ),
            "metadata": schema,
        },
        {
            "id": f"{fingerprint}:correlations",
            "type": "analytics_memory",
            "text": f"Strong correlation pairs: {correlation_result.get('strongPairs', [])}",
            "metadata": {"strongPairs": correlation_result.get("strongPairs", [])},
        },
    ]

    return _json_safe({
        "datasetFingerprint": fingerprint,
        "ragChunks": chunks,
        "fineTuneExamples": examples,
    })
