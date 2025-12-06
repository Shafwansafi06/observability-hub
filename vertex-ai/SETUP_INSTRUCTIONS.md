# Vertex AI - Setup Instructions

## 📦 Installing Dependencies

These files are **reference implementations** for Vertex AI integration. To use them in your project, you need to install the required dependencies.

---

## 🐍 Python Setup

### Option 1: Install in Current Project

```bash
cd vertex-ai/python
pip install -r requirements.txt
```

### Option 2: Create Virtual Environment (Recommended)

```bash
# Create virtual environment
python3 -m venv vertex-ai-env

# Activate it
source vertex-ai-env/bin/activate  # Linux/Mac
# OR
vertex-ai-env\Scripts\activate     # Windows

# Install dependencies
cd vertex-ai/python
pip install -r requirements.txt
```

### Verify Installation

```bash
python -c "from google.cloud import aiplatform; print('✅ Python packages installed')"
```

---

## 🌐 Next.js Setup

### Option 1: Copy Files to Your Next.js Project

```bash
# If you have an existing Next.js project
cp -r vertex-ai/nextjs/lib/* your-nextjs-project/lib/
cp -r vertex-ai/nextjs/app/api/* your-nextjs-project/app/api/

# Install dependencies
cd your-nextjs-project
npm install google-auth-library
```

### Option 2: Install in Vertex AI Directory (for testing)

```bash
cd vertex-ai/nextjs
npm install
```

### Verify Installation

```bash
cd vertex-ai/nextjs
npx tsc --noEmit  # Should compile without errors
```

---

## 🔧 Integration with Main Project

If you want to integrate these files into your main `observability-hub` project:

### Step 1: Install Node.js Dependencies

```bash
cd /home/shafwan-safi/Desktop/observability-hub
npm install google-auth-library
```

### Step 2: Update TypeScript Config

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/vertex-ai/*": ["./vertex-ai/nextjs/*"],
      "@/lib/*": ["./src/lib/*"]
    }
  }
}
```

### Step 3: Copy API Routes

```bash
# Copy to your Next.js app directory
mkdir -p src/app/api/vertex-ai
cp vertex-ai/nextjs/app/api/vertex-ai/predict/route.ts \
   src/app/api/vertex-ai/predict/
```

---

## 🚨 Why These Errors Appear

The errors you're seeing are **expected** because:

1. **Python files** (`vertex_ai_client.py`, `prediction_client.py`):
   - Need Google Cloud libraries (`google-cloud-aiplatform`, `google-auth`)
   - These are **optional** - only install if you want to use Python client

2. **TypeScript files** (`vertex-ai-client.ts`, `route.ts`):
   - Need `google-auth-library` and Next.js packages
   - These are **optional** - only install if integrating with Next.js

3. **These are reference implementations** - not meant to be compiled standalone
   - They're templates for you to copy into your actual projects
   - Install dependencies only where you need them

---

## ✅ Quick Fix for IDE Errors

### For Python (Pylance warnings)

Option A: Install in your Python environment:
```bash
pip install google-cloud-aiplatform google-auth tenacity opentelemetry-api
```

Option B: Ignore warnings in VS Code:
```json
// .vscode/settings.json
{
  "python.analysis.diagnosticSeverityOverrides": {
    "reportMissingImports": "none",
    "reportMissingModuleSource": "none"
  }
}
```

### For TypeScript

Option A: Install in your project:
```bash
npm install google-auth-library next
```

Option B: Exclude from TypeScript checking:
```json
// tsconfig.json
{
  "exclude": [
    "vertex-ai/**/*"
  ]
}
```

---

## 🎯 Recommended Approach

**Don't install everything!** Only install what you need:

### If using Python client only:
```bash
cd vertex-ai/python
pip install -r requirements.txt
```

### If using Next.js API only:
```bash
cd vertex-ai/nextjs
npm install
```

### If using bash scripts only:
```bash
# No dependencies needed - scripts use gcloud CLI
cd vertex-ai/scripts
./01-setup-iam.sh
```

---

## 🔍 Understanding the File Structure

```
vertex-ai/
├── python/          # Python client - use for backend/ML pipelines
├── nextjs/          # Next.js client - use for web applications  
└── scripts/         # Bash scripts - use for deployment (NO dependencies)
```

**Each directory is independent!** You can use one without the others.

---

## 💡 Best Practice

1. **For production deployment**: Use bash scripts (`scripts/`) - they only need `gcloud` CLI
2. **For Python integration**: Copy `python/vertex_ai_client.py` to your project and install requirements
3. **For Next.js integration**: Copy API routes to your Next.js app and install `google-auth-library`

---

## 🚀 Quick Start (No Dependencies)

You can deploy to Vertex AI **right now** using just the bash scripts:

```bash
cd vertex-ai/scripts
chmod +x *.sh
./01-setup-iam.sh
./02-deploy-model.sh
./03-create-endpoint.sh
```

**No npm or pip required!** Scripts only need `gcloud` CLI.

---

## 📞 Still Getting Errors?

The errors are **cosmetic** - the files work when dependencies are installed. Choose one:

1. **Ignore them** - they're just IDE warnings
2. **Install dependencies** - follow instructions above
3. **Exclude from compilation** - add to tsconfig.json exclude
4. **Use only bash scripts** - no dependencies needed!
