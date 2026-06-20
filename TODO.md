# ATS Matcher - Deployment & Scaling TODO

## Short Term (Immediate)

- [x] **Fix Render timeouts for AI analysis**
  - Increased Gunicorn worker timeout from 30s to 120s in `Dockerfile`
  - Added `load_dotenv()` to `backend/app.py` for robust local env loading
  - Push changes and redeploy to Render

- [x] **Fix cost estimation with actual OpenRouter pricing**
  - Updated `record_token_usage()` in `backend/routes/resume.py`
  - Rates: $0.15/1M prompt, $0.60/1M completion (was using fictional $1.00/$2.00)

- [x] **Add monthly billing aggregation endpoints**
  - `GET /api/admin/analytics/tokens/monthly` — monthly totals
  - `GET /api/admin/analytics/tokens/monthly-by-user` — per-user monthly breakdown
  - `GET /api/user/usage/monthly` — current user's monthly usage

- [x] **Add request duration to failed request logs**
  - `backend/app.py` `after_request` middleware now logs:
    - `ERROR` for status >= 400 (includes duration_ms)
    - `WARNING` for requests > 5s

- [x] **Refactor TokenUsage.jsx to external CSS**
  - Created `client/src/pages/admin/TokenUsage.css`
  - Removed inline `styles` object; all static styles now use CSS classes
  - Dynamic values (bar heights, percentages) remain as inline styles per AGENTS.md rules

- [x] **Add date range filters to admin UIs with grouped state**
  - **ErrorLog.jsx** — grouped `{filters, pagination}` state + `startDate`/`endDate` inputs
  - **ActivityLog.jsx** — grouped `{filters, pageCfg}` state + `startDate`/`endDate` inputs
  - **Subscriptions.jsx** — grouped `{filters, pageCfg, verify}` state + `startDate`/`endDate` inputs
  - **UsersManagement.jsx** — grouped `filters` state + `startDate`/`endDate` inputs
  - All use `updateFilter(key, value)` pattern to reduce individual setters

- [ ] **Verify Render environment variables**
  - Ensure `FRONTEND_URL=https://ai-powered-ats-liard.vercel.app` is set in Render dashboard
  - Confirm `OPENROUTER_API_KEY` and database credentials are correct

---

## CV Builder

This is the plan to add a proper professional CV builder powered by LLM analysis feedback.

### Phase 1: Foundation (In Progress)
- [ ] **Database: Add cv_profiles table**
  - `cv_profiles(id, user_id, title, profile_data JSONB, template_id, is_master, target_job_description, tailored_from_id, created_at, updated_at)`
  - Initialize in `backend/db/database.py`

- [ ] **Backend: Add CV profile CRUD endpoints**
  - `POST /api/cv/profiles` — create new CV profile
  - `GET /api/cv/profiles` — list user's profiles
  - `GET /api/cv/profiles/:id` — retrieve full profile
  - `PUT /api/cv/profiles/:id` — update profile sections (PATCH-style merge)
  - `DELETE /api/cv/profiles/:id` — delete profile
  - Register in `resume.py` or new `cv.py` route module

- [ ] **Backend: Parse uploaded resume into structured profile_data**
  - `POST /api/cv/parse`
  - Reuse LLM to extract Contact, Summary, Experience, Education, Skills, Certifications, Projects into structured JSONB

- [ ] **Frontend: /cv-builder route**
  - Register route in `App.jsx`
  - Add `CVBuilderDashboard.jsx` — grid/list of user's CVs + "Create New"
  - Add `CVBuilderEditor.jsx` — basic section editor (left nav, center form, right preview)

- [ ] **Frontend: CV Section Editor**
  - Reusable section component for Contact, Summary, Experience, Education, Skills, Certifications, Projects
  - Manage nested arrays (experience, education) with add/remove
  - Save draft to backend on change

- [ ] **Frontend: Live Preview**
  - One hardcoded template (Modern)
  - Pure React component receiving `profile_data`
  - External CSS file (`ModernTemplate.css`) per AGENTS.md

- [ ] **Import from Saved Resumes**
  - On dashboard, "Import from Saved Resume" option calls `/api/cv/parse` then creates a profile

### Phase 2: Templates & Export
- [ ] **Add 2 more React template components (Classic, Minimal)**
- [ ] **Template selector modal**
- [ ] **Client-side PDF via react-to-print** (quick win)
- [ ] **External CSS files per template**

### Phase 3: AI Suggestions Engine
- [ ] **Backend: `/api/cv/analyze`** — wrap existing matcher + map suggestions to sections
- [ ] **SuggestionPanel component** with "Apply" buttons per field
- [ ] **Section-level highlighting in editor**
- [ ] **Usage limit integration** (new usage types: `cv_analysis`, `cv_tailor`)

### Phase 4: Polish & Server PDF
- [ ] **Replace client PDF with Puppeteer/WeasyPrint server-side**
- [ ] **DOCX export endpoint**
- [ ] **`/api/cv/tailor` workflow** (clone master + auto-optimize)
- [ ] **Link cv_profile_id to Job Tracker applications**

---

## Medium Term (If Users Still Report Timeouts)

- [ ] **Implement async fallback for `/api/match`**
  - Add `_process_single_match()` handler in `backend/jobs/worker.py`
  - Create `POST /api/match-async` endpoint in `backend/routes/resume.py`
  - Update frontend (`ATSMatcher.jsx`) to fallback to async polling on timeout:
    1. Try synchronous `POST /api/match` first
    2. If `TypeError: Failed to fetch` / timeout occurs, retry via `POST /api/match-async`
    3. Poll `GET /api/jobs/{job_id}/status` every 2 seconds until `completed` or `failed`
    4. Display a "Processing..." progress UI during polling
  - Keep synchronous `/api/match` for localhost development

---

## Long Term (Scaling & Reliability)

- [ ] **Replace in-memory ThreadPoolExecutor with a persistent job queue**
  - Options: Redis + Celery, AWS SQS, or a dedicated worker service on Render
  - Benefits: Jobs survive container restarts, true horizontal scaling, reliable retries
  - This is required before high-traffic production use

- [ ] **Add job retention / cleanup policy**
  - Periodically purge completed `jobs` table rows older than 30 days
  - Prevents unbounded DB growth from polling-based async jobs

- [ ] **Optimize LLM latency**
  - Consider using a faster OpenRouter model for initial screening
  - Implement response caching for identical resume+job_description combinations
  - Add request-level timeouts with graceful degradation

---

## Notes

- **Current architecture**: Flask dev server (localhost) vs Gunicorn (Render) + OpenRouter LLM
- **Bottleneck**: Render free tier has ~100s request timeout; OpenRouter calls can take 60s+
- **Current fix**: Gunicorn timeout increased to 120s should resolve most cases
- **Trigger for medium-term work**: If user complaints about "Analysis Failed" persist after Gunicorn fix
