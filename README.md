<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c29,50:302b63,100:24243e&height=220&section=header&text=AIQuant&fontSize=90&fontColor=ffffff&fontAlignY=38&desc=AI-Powered%20Full-Stack%20Market%20Intelligence%20Platform&descAlignY=58&descSize=20&animation=fadeIn" width="100%"/>

<p>
  <img src="https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=white"/>
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Python-ML%20Runner-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white"/>
  <img src="https://img.shields.io/badge/Socket.io-Live%20Prices-010101?style=for-the-badge&logo=socket.io&logoColor=white"/>
</p>

<p>
  <img src="https://img.shields.io/badge/R²%20Accuracy-96.06%25-00C853?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Best%20Model-Gradient%20Boosting-FF6F00?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Frontend-Live%20on%20Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white"/>
  <img src="https://img.shields.io/badge/Backend-Live%20on%20Render-46E3B7?style=for-the-badge&logo=render&logoColor=white"/>
</p>

<h2>🌐 Live Application</h2>

<a href="https://ai-quant-w9fw.vercel.app/">
  <img src="https://img.shields.io/badge/🚀%20Launch%20App-ai--quant--w9fw.vercel.app-blueviolet?style=for-the-badge"/>
</a>
&nbsp;&nbsp;


</div>

---

## 📌 Overview

**AIQuant (Trade Insights)** is a production-grade, full-stack market intelligence platform that combines real-time market data with machine learning–powered price predictions. It benchmarks 6 ML models, selects the best performer, and serves predictions live through a React frontend and a Node/Express backend with a Python ML runner.

| Layer | Technology |
|-------|-----------|
| 🎨 Frontend | React + Vite (deployed on Vercel) |
| ⚙️ Backend | Node.js + Express (deployed on Render) |
| 🤖 ML Runner | Python + scikit-learn + joblib |
| 📡 Live Data | Socket.io (real-time market prices) |
| 🗄️ Database | MongoDB Atlas |
| 📦 ML Artifacts | Gradient Boosting `.pkl` via download script |

---

## 🏆 Model Performance — Accuracy Leaderboard

Six regression models were trained and rigorously evaluated. **Gradient Boosting was selected as the best model** and powers all live predictions.

| Rank | Model | RMSE ↓ | MAE ↓ | R² ↑ | MAPE ↓ |
|:----:|-------|:------:|:-----:|:----:|:------:|
| 🥇 | **Gradient Boosting** | **53.44** | **28.85** | **0.9606** | 241.56 |
| 🥈 | XGBoost | 55.19 | 28.93 | 0.9579 | 148.66 |
| 🥉 | Random Forest | 98.07 | 41.87 | 0.8672 | 214.64 |
| 4th | LightGBM | 152.65 | 84.93 | 0.6783 | 772.45 |
| 5th | Lasso | 184.65 | 133.43 | 0.5292 | 4773.06 |
| 6th | Ridge | 184.77 | 133.14 | 0.5286 | 4740.54 |

> ↓ Lower is better &nbsp;|&nbsp; ↑ Higher is better

### R² Score Visualization

```
Gradient Boosting  ████████████████████████████████████████████████  96.06%  🏆
XGBoost            ███████████████████████████████████████████████░  95.79%
Random Forest      ███████████████████████████████████████████░░░░░  86.72%
LightGBM           █████████████████████████████████░░░░░░░░░░░░░░░  67.83%
Lasso              ██████████████████████████░░░░░░░░░░░░░░░░░░░░░░  52.92%
Ridge              ██████████████████████████░░░░░░░░░░░░░░░░░░░░░░  52.86%
```

> **Deployed ML stack:** `scikit-learn==1.8.0` · `numpy==2.1.1` · `pandas==2.2.2` · `joblib==1.4.2`

---

## ✨ Platform Features

- 📈 **Live Market Prices** — Real-time price streaming via Socket.io
- 🤖 **AI Price Predictions** — Gradient Boosting model served via Python subprocess
- 🌡️ **Sector Heatmap** — Visual breakdown of sector-level market performance
- 💼 **Paper Trading** — Simulate trades without real money
- 📊 **Portfolio View** — Track your holdings and P&L
- 🔍 **Market Insights** — ML-driven analysis and price drivers

---

## 🗂️ Repository Structure

```
AIQuant/
│
├── 📓 Main (2).ipynb                    # ML training pipeline: EDA → Model → Evaluation
│
├── 🌐 Website/                          # Full-stack application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Overview.jsx             # Market overview with live socket data
│   │   │   ├── Markets.jsx              # Live market prices
│   │   │   ├── Portfolio.jsx            # Portfolio tracker
│   │   │   └── Insights.jsx            # ML-powered insights
│   │   ├── hooks/
│   │   │   └── useMarketSocket.js       # Socket.io hook (reads VITE_API_URL)
│   │   └── ml/
│   │       └── real_model_runner.py     # Python ML runner (invoked by backend)
│   │
│   ├── server.js                        # Express API + ML subprocess runner
│   ├── scripts/
│   │   └── download-ml-assets.sh        # Downloads .pkl model files
│   └── requirements.txt                 # Pinned Python deps for ML serving
│
├── render.yaml                          # Render deployment blueprint
└── .gitignore
```

---

## ⚙️ Local Development

### 1. Frontend

```bash
# Clone and install
git clone https://github.com/rudraXWork/AIQuant.git
cd AIQuant/Website
npm install

# Start frontend dev server
npm run dev
```

### 2. Backend + ML Runner

```bash
# Create Python virtual environment (Python 3.11 recommended)
python3 -m venv venv
source venv/bin/activate

# Install Python ML dependencies
pip install -r Website/requirements.txt

# Download ML model artifacts
MODEL_ROOT=$(pwd) bash Website/scripts/download-ml-assets.sh

# Start Express backend (default port 10000)
cd Website
npm run server
```

### 3. Environment Variables

Create a `.env` file in `Website/`:

```env
# Database
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/<db>
MONGODB_DB=your_db_name

# Auth
JWT_SECRET=your_jwt_secret

# AngelOne Market Data
API_KEY=...
CLIENT_CODE=...
PASSWORD=...
TOTP_SECRET=...

# EmailJS
EMAILJS_SERVICE_ID=...
EMAILJS_TEMPLATE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
EMAILJS_API_URL=...

# ML Asset Downloads
MODEL_URL=<direct link to best_model_gradient_boosting.pkl>
TRANSFORMER_URL=<direct link to column_transformer.pkl>
MODEL_ROOT=/opt/render/project/src

# Frontend — set in Vercel dashboard
VITE_API_URL=https://trade-insights-backend.onrender.com
```

---

## 🚀 Deployment

### Backend — Render

| Setting | Value |
|---------|-------|
| Root directory | `Website` |
| Build command | `python3 -m pip install -r requirements.txt && npm install && MODEL_ROOT=/opt/render/project/src bash scripts/download-ml-assets.sh` |
| Start command | `npm run server` |
| Python version | `3.11.9` (set via `PYTHON_VERSION` or `runtime.txt`) |

> ⚠️ Set `MONGODB_URI` in Render env without surrounding quotes. Allow `0.0.0.0/0` in MongoDB Atlas Network Access if you hit TLS errors.

### Frontend — Vercel

Set `VITE_API_URL` to your Render backend URL, then redeploy. The Socket.io client reads this variable to stream live market prices.

---

## 🧠 ML Architecture

```
Training (Jupyter Notebook)
        │
        ▼
  Feature Engineering
        │
        ▼
  6 Models Trained ──────────────────────────────────┐
  (GB, XGBoost, RF, LightGBM, Lasso, Ridge)          │
        │                                             │
        ▼                                             ▼
  Best Model Selected                        Artifacts Exported
  Gradient Boosting (R²=0.9606)      best_model_gradient_boosting.pkl
        │                                  column_transformer.pkl
        ▼
  Hosted via MODEL_URL / TRANSFORMER_URL
        │
        ▼
  Backend (server.js) spawns Python subprocess
        │
        ▼
  real_model_runner.py loads .pkl → returns prediction
        │
        ▼
  REST API → React Frontend (Live on Vercel)
```

---

## 🔧 Troubleshooting

| Problem | Fix |
|---------|-----|
| ML unpickle errors | Version mismatch — match `requirements.txt` to training env or re-export `.pkl` |
| MongoDB TLS errors | Verify `MONGODB_URI` format; allow `0.0.0.0/0` in Atlas Network Access |
| `npm: command not found` on Render | Ensure service type is **Node** in Render blueprint |
| `ws://localhost:3000` in browser | Set `VITE_API_URL` in Vercel env and redeploy |
| Live prices not updating | Check `useMarketSocket.js` — verify `VITE_API_URL` is correct |

---

## 🔄 Updating the ML Model

```bash
# 1. Retrain locally with updated data
jupyter notebook "Main (2).ipynb"

# 2. New artifacts are exported automatically:
#    best_model_gradient_boosting.pkl
#    column_transformer.pkl

# 3. Upload to your file host and update Render env vars
MODEL_URL=<new pkl url>
TRANSFORMER_URL=<new transformer url>

# 4. Redeploy backend on Render
```

> ⚠️ Ensure the Python environment on Render matches the version used during training to avoid pickle compatibility errors.

---

## 🤝 Contributing

1. Fork the project
2. Create your feature branch: `git checkout -b feature/YourFeature`
3. Commit your changes: `git commit -m 'Add YourFeature'`
4. Push to the branch: `git push origin feature/YourFeature`
5. Open a Pull Request

---

<div align="center">

**👨‍💻 Built by [rudraXWork](https://github.com/rudraXWork)**

[![GitHub](https://img.shields.io/badge/GitHub-rudraXWork-181717?style=for-the-badge&logo=github)](https://github.com/rudraXWork)
&nbsp;
[![Live App](https://img.shields.io/badge/🚀%20Live%20App-ai--quant--w9fw.vercel.app-blueviolet?style=for-the-badge)](https://ai-quant-w9fw.vercel.app/)

<br/>

⭐ **If AIQuant helped you, please star the repo!** ⭐

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c29,50:302b63,100:24243e&height=100&section=footer" width="100%"/>

</div>
