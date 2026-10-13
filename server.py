"""Customer segmentation API — K-Means and Ward hierarchical clustering via scikit-learn / SciPy."""

from __future__ import annotations

import base64
import io
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from scipy.cluster.hierarchy import dendrogram, fcluster, linkage  # Hierarchical clustering
from sklearn.cluster import KMeans  # K-Means clustering
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
FEATURES = ["Age", "Annual Income (k$)", "Spending Score (1-100)"]

app = Flask(__name__, static_folder=str(ROOT), static_url_path="")

df = pd.read_csv(ROOT / "Mall_Customers.csv")
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df[FEATURES])
# Hierarchical clustering: Compute Ward linkage matrix on scaled features
ward_linkage = linkage(X_scaled, method="ward")
pca_model = PCA(n_components=2, random_state=42)
pca_coords = pca_model.fit_transform(X_scaled)

CUSTOMERS = [
    {
        "id": int(row["CustomerID"]),
        "gender": row["Gender"],
        "age": int(row["Age"]),
        "income": int(row["Annual Income (k$)"]),
        "score": int(row["Spending Score (1-100)"]),
    }
    for _, row in df.iterrows()
]


def persona(centroid: dict) -> dict:
    income, score = centroid["income"], centroid["score"]
    if income >= 70 and score >= 60:
        return {
            "name": "VIP champions",
            "play": "Invite-only drops, premium loyalty, personal styling.",
        }
    if income >= 70 and score <= 40:
        return {
            "name": "Careful affluent",
            "play": "Quality stories and exclusive trials — they can spend, they just haven’t yet.",
        }
    if income <= 40 and score >= 60:
        return {
            "name": "Enthusiastic spenders",
            "play": "Value bundles, student-style perks, and trend-led merch.",
        }
    if income <= 40 and score <= 40:
        return {
            "name": "Budget conscious",
            "play": "Clear markdowns and essentials. Don’t over-message.",
        }
    return {
        "name": "Core regulars",
        "play": "Steady loyalty points and seasonal reminders.",
    }


def wcss(X: np.ndarray, labels: np.ndarray) -> float:
    total = 0.0
    for c in np.unique(labels):
        pts = X[labels == c]
        mu = pts.mean(axis=0)
        total += float(((pts - mu) ** 2).sum())
    return total


# --- K-Means Clustering ---
def fit_kmeans(k: int) -> tuple[np.ndarray, np.ndarray]:
    model = KMeans(n_clusters=k, n_init=10, random_state=42)  # K-Means model initialization
    labels = model.fit_predict(X_scaled)  # K-Means fitting and label prediction
    return labels, model.cluster_centers_


# --- Hierarchical Clustering (Ward Linkage) ---
def fit_ward(k: int) -> tuple[np.ndarray, np.ndarray]:
    # Hierarchical clustering: Cut the dendrogram to form k clusters
    labels = fcluster(ward_linkage, t=k, criterion="maxclust") - 1
    cents = np.vstack(
        [
            X_scaled[labels == c].mean(axis=0) if np.any(labels == c) else np.zeros(X_scaled.shape[1])
            for c in range(k)
        ]
    )
    return labels, cents


def curves(algo: str) -> tuple[list[dict], list[dict]]:
    elbow, sil = [], []
    for kk in range(2, 9):
        # Choose between K-Means or Hierarchical clustering
        labels, _ = fit_kmeans(kk) if algo == "kmeans" else fit_ward(kk)
        elbow.append({"x": kk, "y": wcss(X_scaled, labels)})
        sil.append({"x": kk, "y": float(silhouette_score(X_scaled, labels))})
    return elbow, sil


# Hierarchical clustering: Generate dendrogram tree plot
def dendrogram_png() -> str:
    fig, ax = plt.subplots(figsize=(8.2, 2.6), dpi=130)
    fig.patch.set_facecolor("#fbf7f0")
    ax.set_facecolor("#fbf7f0")
    # Hierarchical clustering: Render dendrogram
    dendrogram(ward_linkage, no_labels=True, ax=ax, color_threshold=None, above_threshold_color="#1c1915")
    ax.spines[["top", "right", "bottom"]].set_visible(False)
    ax.tick_params(bottom=False, labelbottom=False)
    ax.set_ylabel("Distance", color="#6f675c", fontsize=8)
    ax.tick_params(colors="#6f675c", labelsize=7)
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", facecolor=fig.get_facecolor())
    plt.close(fig)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


# Hierarchical clustering: Pre-rendered base64 dendrogram image
_DENDRO = dendrogram_png()
# Precomputed evaluation curves for both K-Means and Hierarchical clustering
_CURVE_CACHE = {name: curves(name) for name in ("kmeans", "ward")}


def groups_from_labels(labels: np.ndarray) -> list[dict]:
    out = []
    for ci in range(int(labels.max()) + 1):
        mask = labels == ci
        members = df.loc[mask]
        if members.empty:
            continue
        centroid = {
            "age": float(members["Age"].mean()),
            "income": float(members["Annual Income (k$)"].mean()),
            "score": float(members["Spending Score (1-100)"].mean()),
        }
        women = int((members["Gender"] == "Female").sum())
        out.append(
            {
                "ci": int(ci),
                "size": int(mask.sum()),
                "women": women,
                "centroid": centroid,
                "persona": persona(centroid),
                "member_ids": members["CustomerID"].astype(int).tolist(),
            }
        )
    out.sort(key=lambda g: g["size"], reverse=True)
    return out


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/api/customers")
def api_customers():
    ages = df["Age"]
    incomes = df["Annual Income (k$)"]
    women = int((df["Gender"] == "Female").sum())
    men = int((df["Gender"] == "Male").sum())
    return jsonify(
        {
            "customers": CUSTOMERS,
            "stats": {
                "n": int(len(df)),
                "women": women,
                "men": men,
                "age_min": int(ages.min()),
                "age_max": int(ages.max()),
                "income_mean": round(float(incomes.mean()), 1),
            },
        }
    )


@app.get("/api/cluster")
def api_cluster():
    algo = request.args.get("algo", "kmeans")
    k = int(request.args.get("k", 5))
    k = max(2, min(8, k))
    if algo not in ("kmeans", "ward"):
        algo = "kmeans"

    # Run either K-Means or Hierarchical clustering based on requested algorithm
    labels, cents = fit_kmeans(k) if algo == "kmeans" else fit_ward(k)
    elbow, sil_curve = _CURVE_CACHE[algo]
    payload = {
        "engine": "Python · scikit-learn" if algo == "kmeans" else "Python · SciPy Ward linkage",
        "library": "sklearn.cluster.KMeans" if algo == "kmeans" else "scipy.cluster.hierarchy",
        "algo": algo,
        "k": k,
        "silhouette": float(silhouette_score(X_scaled, labels)),
        "inertia": wcss(X_scaled, labels),
        "labels": labels.astype(int).tolist(),
        "pca": pca_coords.round(4).tolist(),
        "groups": groups_from_labels(labels),
        "elbow": elbow,
        "silhouette_curve": sil_curve,
        "dendrogram": _DENDRO if algo == "ward" else None,  # Hierarchical clustering dendrogram
        "explained_variance": pca_model.explained_variance_ratio_.round(4).tolist(),
    }
    return jsonify(payload)


@app.post("/api/predict")
def api_predict():
    body = request.get_json(force=True)
    algo = body.get("algo", "kmeans")
    k = max(2, min(8, int(body.get("k", 5))))
    age = float(body["age"])
    income = float(body["income"])
    score = float(body["score"])
    gender = body.get("gender", "")

    # Fit K-Means or Hierarchical clustering to get cluster centers for assigning new customer
    labels, cents = fit_kmeans(k) if algo == "kmeans" else fit_ward(k)
    x = scaler.transform([[age, income, score]])[0]
    ci = int(np.argmin(np.sum((cents - x) ** 2, axis=1)))
    groups = groups_from_labels(labels)
    group = next(g for g in groups if g["ci"] == ci)
    return jsonify(
        {
            "engine": "Python · scikit-learn / SciPy",
            "cluster": ci,
            "gender": gender,
            "age": age,
            "income": income,
            "score": score,
            "group": group,
            "algo": algo,
            "k": k,
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=False)
