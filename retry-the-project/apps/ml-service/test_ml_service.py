from fastapi.testclient import TestClient

from app import app


client = TestClient(app)


ROWS = [
    {"age": 21, "income": 40000, "score": 70, "segment": "a"},
    {"age": 25, "income": 50000, "score": 74, "segment": "a"},
    {"age": 32, "income": 64000, "score": 81, "segment": "b"},
    {"age": 44, "income": 90000, "score": 92, "segment": "b"},
    {"age": 52, "income": 120000, "score": 96, "segment": "c"},
]


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_profile_cache():
    payload = {"rows": ROWS, "columns": ["age", "income", "score", "segment"]}
    first = client.post("/profile", json=payload)
    second = client.post("/profile", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["rowCount"] == 5
    assert second.json()["cacheHit"] is True


def test_correlations():
    response = client.post("/correlations", json={"rows": ROWS})
    assert response.status_code == 200
    assert response.json()["method"] == "pearson"
    assert "matrix" in response.json()


def test_anomalies():
    rows = ROWS + [{"age": 99, "income": 999999, "score": 1, "segment": "z"}]
    response = client.post("/anomalies", json={"rows": rows, "method": "zscore"})
    assert response.status_code == 200
    assert response.json()["summary"]["numericColumns"]


def test_large_dataset_sampling():
    rows = [{"x": index, "y": index * 2} for index in range(60_000)]
    response = client.post("/profile", json={"rows": rows})
    assert response.status_code == 200
    assert response.json()["rowCount"] == 50_000


def test_compare_datasets():
    response = client.post(
        "/compare-datasets",
        json={
            "left": {"rows": [{"a": 1, "b": 2}]},
            "right": {"rows": [{"a": 1, "c": 3}]},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sameSchema"] is False
    assert body["missingColumns"] == ["b"]
    assert body["extraColumns"] == ["c"]


def test_bad_input():
    # Sending malformed input to profile endpoint should return unprocessable entity (422)
    response = client.post("/profile", json={"rows": "not an array"})
    assert response.status_code == 422
