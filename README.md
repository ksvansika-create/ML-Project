# Mall Customer Segmentation — K-Means & Hierarchical Clustering

An end-to-end Machine Learning and interactive web application that segments retail shopping mall customers using unsupervised learning algorithms (**K-Means** and **Agglomerative Hierarchical Clustering with Ward linkage**).

Built as a B.Tech Machine Learning project (Department of CSIT, A.Y. 2026–27).

---

## 📌 Project Overview

Customer segmentation divides a retail customer base into distinct, meaningful groups sharing similar purchasing habits, spending patterns, and income levels. Rather than treating all shoppers as a homogeneous crowd, businesses can tailor marketing campaigns, launch loyalty tiers, and optimize promotions for each group.

This project delivers:
1. **Data Preprocessing & Normalization**: Standardizes features using `StandardScaler` so that high dollar values (income) don't disproportionately distort distance metrics.
2. **Dual Unsupervised Clustering**:
   - **K-Means Clustering** (`sklearn.cluster.KMeans`): Partitions customers into $K$ spherical clusters minimizing intra-cluster variance (WCSS).
   - **Hierarchical Clustering** (`scipy.cluster.hierarchy`): Agglomerative clustering using Ward's minimum variance linkage, visualized with a SciPy dendrogram.
3. **Cluster Validation & Evaluation**:
   - **Elbow Method (WCSS / Inertia curve)** to detect optimal $K$.
   - **Silhouette Score Analysis** to measure cluster separation and cohesion.
   - **PCA (Principal Component Analysis)** for 2D dimensionality reduction across all numeric features.
4. **Interactive Web Dashboard**:
   - Real-time parameter tuning ($K$ slider, algorithm toggle).
   - Dynamic canvas scatter plots with centroid tracking.
   - Live customer segment classification tool.

---

## 📊 Dataset

* **Source**: `Mall_Customers.csv`
* **Size**: 200 customer records
* **Attributes**:
  * `CustomerID`: Unique numerical ID (1 – 200)
  * `Gender`: Male / Female
  * `Age`: Customer age (18 – 70)
  * `Annual Income (k$)`: Annual income in thousands of dollars (15 – 137 k$)
  * `Spending Score (1-100)`: Behavioral score assigned based on spending frequency and amounts

---

## 🎯 Target Customer Personas ($K = 5$)

| Cluster | Persona Name | Characteristics | Marketing Strategy |
|---|---|---|---|
| 1 | **VIP Champions** | High Income, High Spending | Exclusive VIP drops, private previews, concierge styling. |
| 2 | **Careful Affluent** | High Income, Low Spending | Quality stories, premium guarantees, exclusive trials. |
| 3 | **Enthusiastic Spenders** | Low Income, High Spending | Trend-led items, student perks, bundle deals. |
| 4 | **Budget Conscious** | Low Income, Low Spending | Value promotions, clear clearance markdowns, essentials. |
| 5 | **Core Regulars** | Average Income, Average Spending | Seasonal reminders, points-based loyalty programs. |

---

## 🛠️ Technology Stack

* **Backend**:
  * Python 3.9+
  * Flask (Lightweight REST API & static file server)
  * scikit-learn (`KMeans`, `StandardScaler`, `PCA`, `silhouette_score`)
  * SciPy (`linkage`, `dendrogram`, `fcluster`)
  * pandas & NumPy (Data manipulation & numerical computation)
  * matplotlib (Headless server-side dendrogram rendering)
* **Frontend**:
  * HTML5 & Vanilla CSS (Custom design system, typography via Google Fonts)
  * Vanilla JavaScript (ES6+ fetch API, HTML5 Canvas charting)

---

## 📁 Repository Structure

```
├── Mall_Customers.csv                      # Dataset
├── server.py                               # Flask API & ML clustering pipeline
├── index.html                              # Web application UI
├── app.js                                  # Interactive UI & Canvas visualization logic
├── styles.css                              # Design system styling & responsive layout
├── requirements.txt                        # Python dependencies
├── Customer_Segmentation_Presentation.pptx # Project presentation slide deck
├── ML PROJECT ABSTRACT.docx                # Academic project abstract and documentation
└── README.md                               # Project documentation
```

---

## 🚀 Getting Started & Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/mall-customer-segmentation.git
cd mall-customer-segmentation
```

### 2. Set up a Python Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate       # macOS / Linux
# or
.venv\Scripts\activate          # Windows
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
```bash
python3 server.py
```

### 5. Access the Web Dashboard
Open your browser and navigate to:
```
http://127.0.0.1:8765
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/customers` | Returns all 200 customer records and summary statistics. |
| `GET` | `/api/cluster?algo={kmeans\|ward}&k={2..8}` | Computes clustering labels, inertia, silhouette scores, PCA coordinates, and dendrogram. |
| `POST` | `/api/predict` | Accepts `{age, income, score, gender, algo, k}` and classifies the customer into the nearest segment. |

---

## 👥 Authors & Academic Credits

* **K Neha Sreekari** — Roll No: `2520090240`
* **K Sayee Vansika** — Roll No: `2520090239`
* **Project Guide**: Mrs. Dyuti Banerjee, Assistant Professor, Department of AI & DS
* **Department**: CSIT, Bachelor of Technology (B.Tech)
* **Academic Year**: 2026–27
