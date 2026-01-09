import os
import json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import PyPDF2 
from dotenv import load_dotenv
# Install required library: pip install python-docx
from docx import Document
from io import BytesIO 

load_dotenv()
# 1. Gemini API Setup
# Requires: pip install google-genai
try:
    import google.generativeai as genai
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
    else:
        print("WARNING: GEMINI_API_KEY not set in environment.")
    try:
        model = genai.GenerativeModel('gemini-robotics-er-1.5-preview')
        print("Gemini GenerativeModel initialized successfully.")
    except Exception:
        model = None
except Exception as e:
    # If API key is missing or invalid or import fails
    print(f"ERROR: Could not initialize Gemini Client. Check if GEMINI_API_KEY is set. Details: {e}")
    model = None

# 2. Flask App Setup
# Requires: pip install flask flask-cors PyPDF2
app = Flask(__name__)
CORS(app) # Allow all origins for development purposes


@app.route('/', methods=['GET'])
def index():
    """Basic landing page so visiting root doesn't return 404."""
    return (
        '<h2>ATS Matcher Backend</h2>'
        '<p>Available endpoints:</p>'
        '<ul>'
        '<li>POST <code>/api/match</code> - Upload resume (file) and job_description (form field)</li>'
        '<li>GET <code>/health</code> - Health check</li>'
        '</ul>'
    )


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

def generate_optimized_resume_pdf(original_text, missing_skills, analysis_data=None):
    """
    Creates a new PDF document using an HTML template, inserting the original 
    resume text and the AI-generated optimization section with comprehensive analysis.
    """
    
    # 1. Prepare HTML Content for the Recommended Skills Section
    skills_list_html = "".join([
        f'<li class="missing-skill">• {skill} (Targeted Keyword)</li>'
        for skill in missing_skills
    ])

    # 2. Build Gap Analysis HTML if available
    gap_analysis_html = ""
    if analysis_data and analysis_data.get("keyword_gap_analysis"):
        gap_analysis_html = "<h3>Keyword Gap Analyzer</h3><div class='gap-analysis'>"
        for skill, section in analysis_data["keyword_gap_analysis"].items():
            gap_analysis_html += f'<div class="gap-item"><strong>{skill}</strong> → Add to: <em>{section}</em></div>'
        gap_analysis_html += "</div>"

    # 3. Build Weakly Represented Skills HTML if available
    weakly_html = ""
    if analysis_data and analysis_data.get("weakly_represented_skills"):
        weakly_html = "<h3>Weakly Represented Skills (Needs More Emphasis)</h3><ul>"
        for skill in analysis_data["weakly_represented_skills"]:
            weakly_html += f'<li>{skill}</li>'
        weakly_html += "</ul>"

    # 4. Build Overused Terms HTML if available
    overused_html = ""
    if analysis_data and analysis_data.get("overused_terms"):
        overused_html = "<h3>Overused Terms (Consider Varying)</h3><ul>"
        for term in analysis_data["overused_terms"]:
            overused_html += f'<li>{term}</li>'
        overused_html += "</ul>"

    # 5. Build Add to Resume Suggestions HTML if available
    suggestions_html = ""
    if analysis_data and analysis_data.get("add_to_resume_suggestions"):
        suggestions_html = "<h3>Add to Resume Suggestions</h3><ul class='suggestions'>"
        for suggestion in analysis_data["add_to_resume_suggestions"]:
            suggestions_html += f'<li class="suggestion-item">{suggestion}</li>'
        suggestions_html += "</ul>"

    # 6. Define the HTML Template and CSS for Professional CV Format
    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Optimized CV</title>
        <style>
            body {{ font-family: 'Helvetica', sans-serif; margin: 0; padding: 0; font-size: 11pt; line-height: 1.6; }}
            .container {{ width: 800px; margin: 30px auto; padding: 30px; border: 1px solid #ccc; }}
            h1 {{ color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 5px; font-size: 18pt; margin-bottom: 5px; }}
            h2 {{ color: #1a73e8; border-bottom: 1px solid #1a73e8; padding-bottom: 3px; font-size: 14pt; margin-top: 25px; margin-bottom: 10px; }}
            h3 {{ color: #34a853; margin-top: 15px; margin-bottom: 8px; font-size: 12pt; }}
            .section-ai {{ background-color: #e6f0fe; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #1a73e8; }}
            .missing-skill {{ color: #d93025; font-weight: bold; margin-left: -20px; }}
            .gap-analysis {{ background-color: #f9f9f9; padding: 10px; border-radius: 4px; margin-top: 10px; }}
            .gap-item {{ padding: 8px; background-color: #fff; margin: 5px 0; border-left: 3px solid #d93025; }}
            .suggestions {{ color: #1e8e3e; }}
            .suggestion-item {{ background-color: #e8f5e9; padding: 8px; margin: 5px 0; border-radius: 3px; }}
            pre {{ white-space: pre-wrap; word-wrap: break-word; font-family: 'Helvetica', monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border-radius: 4px; }}
            ul {{ margin: 10px 0; padding-left: 20px; }}
            li {{ margin: 5px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📊 Optimized Resume Draft (AI Suggestions)</h1>

            <div class="section-ai">
                <h2>🌟 AI Recommended Skill Enhancement Section</h2>
                <p>Based on the job requirements, consider integrating the following keywords into your experience or skill sections to maximize your ATS score:</p>
                <ul>
                    {skills_list_html}
                </ul>
            </div>

            {gap_analysis_html}
            {weakly_html}
            {overused_html}
            {suggestions_html}

            <h2>📄 Extracted Original Resume Content</h2>
            <p>Review the text below and integrate the recommended keywords where appropriate. Note: This is raw extracted text from your PDF.</p>
            <pre>{original_text}</pre>
        </div>
    </body>
    </html>
    """
    
    # 3. Render HTML to PDF using WeasyPrint (import lazily to avoid startup failures)
    try:
        from weasyprint import HTML
    except Exception as e:
        raise RuntimeError(
            "WeasyPrint is not available or missing system dependencies. "
            "Install WeasyPrint and its platform libraries following: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html. "
            f"Details: {e}"
        )

    pdf_stream = BytesIO()
    HTML(string=html_template).write_pdf(pdf_stream)
    pdf_stream.seek(0)
    return pdf_stream


def generate_optimized_resume_docx(original_text, missing_skills, analysis_data=None):
    """Create a comprehensive .docx document with full analysis data."""
    doc = Document()
    doc.add_heading('Optimized Resume Draft (AI Suggestions)', level=1)

    doc.add_heading('AI Recommended Skill Enhancement Section', level=2)
    doc.add_paragraph('Based on the job requirements, consider integrating these keywords into your experience or skill sections:')
    for skill in missing_skills:
        doc.add_paragraph(f'• {skill} (Targeted Keyword)', style='List Bullet')

    # Add Gap Analysis if available
    if analysis_data and analysis_data.get("keyword_gap_analysis"):
        doc.add_heading('Keyword Gap Analyzer', level=2)
        for skill, section in analysis_data["keyword_gap_analysis"].items():
            doc.add_paragraph(f'{skill} → Add to: {section}', style='List Bullet')

    # Add Weakly Represented Skills if available
    if analysis_data and analysis_data.get("weakly_represented_skills"):
        doc.add_heading('Weakly Represented Skills (Needs More Emphasis)', level=2)
        for skill in analysis_data["weakly_represented_skills"]:
            doc.add_paragraph(f'• {skill}', style='List Bullet')

    # Add Overused Terms if available
    if analysis_data and analysis_data.get("overused_terms"):
        doc.add_heading('Overused Terms (Consider Varying)', level=2)
        for term in analysis_data["overused_terms"]:
            doc.add_paragraph(f'• {term}', style='List Bullet')

    # Add Add to Resume Suggestions if available
    if analysis_data and analysis_data.get("add_to_resume_suggestions"):
        doc.add_heading('Add to Resume Suggestions', level=2)
        for suggestion in analysis_data["add_to_resume_suggestions"]:
            doc.add_paragraph(f'• {suggestion}', style='List Bullet')

    doc.add_heading('Extracted Original Resume Content', level=2)
    # Add the original resume text as a single paragraph (preserve basic newlines)
    for line in original_text.splitlines():
        if line.strip():
            doc.add_paragraph(line)

    stream = BytesIO()
    doc.save(stream)
    stream.seek(0)
    return stream


# Helper function to extract text from PDF
def extract_text_from_pdf(pdf_stream):
    """Reads PDF file stream and extracts all text content."""
    try:
        # PyPDF2 requires the stream object
        reader = PyPDF2.PdfReader(pdf_stream)
        text = ""
        for page in reader.pages:
            # We use .extract_text() to get the text content
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
        return text
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return None

@app.route('/api/match', methods=['POST'])
def process_match():
    """API endpoint to receive resume and JD, process with Gemini, and return structured JSON plus extracted text.."""
    
    if not model:
        return jsonify({"error": "Gemini API model is not available. Check server logs."}), 500

    # Ensure all required data is present
    if 'resume' not in request.files or 'job_description' not in request.form:
        return jsonify({"error": "Missing resume file or job description in the request."}), 400

    # Extract data from the POST request
    resume_file = request.files['resume']
    job_description = request.form['job_description']
    
    # 1. Convert PDF to Text
    # We pass the stream object from the request file to our helper function
    resume_text = extract_text_from_pdf(resume_file.stream)
    
    if not resume_text or len(resume_text.strip()) < 50:
        return jsonify({"error": "Could not extract sufficient text from the PDF file. Is the PDF text-searchable?"}), 400

    # 2. Construct the Prompt for Gemini
    prompt = f"""
    You are an expert Applicant Tracking System (ATS) Analyst and Resume Optimization Specialist. Your job is to compare a RESUME against a JOB DESCRIPTION with comprehensive scoring and recommendations.
    
    --- RESUME TEXT ---
    {resume_text}
    
    --- JOB DESCRIPTION TEXT ---
    {job_description}
    
    Analyze the two texts and provide a comprehensive evaluation:
    
    1. **Calculate Detailed Scores (0-100%):**
       - "keyword_match_score": Percentage of critical job keywords present in resume
       - "skills_alignment_score": How well candidate's skills align with job requirements
       - "experience_relevance_score": How relevant work experience is to the position
       - "formatting_structure_score": How well-structured resume matches ATS expectations
       - "seniority_fit_score": Whether experience level matches position seniority
       - "overall_match_score": Weighted average of all scores
    
    2. **Identify Matched Skills:** List 5-10 key professional skills/technologies present in BOTH documents.
    
    3. **Identify Missing Skills:** List 5-10 key professional skills/technologies required by JOB DESCRIPTION but NOT found in RESUME.
    
    4. **Identify Weakly Represented Skills:** List 3-5 skills that appear in both documents but with weak representation in the resume (mentioned once or briefly).
    
    5. **Identify Overused Terms:** List any keywords/phrases that appear excessively in the resume (3+ times) that should be varied.
    
    6. **Keyword Gap Analysis:** For missing skills, suggest specific resume sections where each could be naturally integrated.
    
    7. **Generate Recommendation:** Write brief (max 3 sentences), actionable advice to improve resume for this specific job.
    
    8. **Add to Resume Suggestions:** Provide 3-5 specific bullet points or phrases the candidate could add to their resume to improve match.
    
    Return results STRICTLY as a single JSON object. Do not add any other text.
    Required keys: "keyword_match_score", "skills_alignment_score", "experience_relevance_score", "formatting_structure_score", "seniority_fit_score", "overall_match_score", "matched_skills", "missing_skills", "weakly_represented_skills", "overused_terms", "keyword_gap_analysis", "recommendation_text", "add_to_resume_suggestions"
    
    All scores must be integers 0-100.
    All list fields must be arrays of strings.
    keyword_gap_analysis must be an object mapping missing skill to suggested resume section (e.g., {{"Python": "Technical Skills section", "Docker": "Projects section"}}).
    """

    try:
        # 3. Call the Gemini API
        print("Sending prompt to Gemini API via GenerativeModel...")
        response = model.generate_content(prompt)

        # 4. Parse the JSON response
        # We use a robust method to extract the JSON from the model's text output
        json_string = getattr(response, 'text', str(response)).strip().replace("```json", "").replace("```", "")
        result_json = json.loads(json_string)

        # Add backward compatibility: if 'overall_match_score' exists, also set 'score'
        if 'overall_match_score' in result_json and 'score' not in result_json:
            result_json['score'] = result_json['overall_match_score']
        
        print(f"Analysis successful. Overall Score: {result_json.get('overall_match_score', result_json.get('score', 'N/A'))}")
        
        result_json['original_resume_text'] = resume_text  # Include original text for later use
        return jsonify(result_json)

    except json.JSONDecodeError:
        print(f"ERROR: Failed to parse JSON from Gemini response: {response.text}")
        return jsonify({"error": "Analysis failed to produce valid JSON output."}), 500
    except Exception as e:
        print(f"Gemini API error: {e}")
        return jsonify({"error": f"Internal analysis failed due to API error: {e}"}), 500




@app.route('/api/generate-cv', methods=['POST'])
def generate_cv():
    """Endpoint to generate and return the optimized PDF file with full analysis."""
    
    data = request.json
    original_resume_text = data.get('original_resume_text')
    missing_skills = data.get('missing_skills', [])
    
    # Extract full analysis data if provided
    analysis_data = {
        'keyword_gap_analysis': data.get('keyword_gap_analysis'),
        'weakly_represented_skills': data.get('weakly_represented_skills'),
        'overused_terms': data.get('overused_terms'),
        'add_to_resume_suggestions': data.get('add_to_resume_suggestions')
    }
    
    if not original_resume_text or not missing_skills:
        return jsonify({"error": "Missing original resume text or missing skills data."}), 400
        
    # Generate the PDF stream (handle missing WeasyPrint gracefully)
    # Try PDF first, but fallback to DOCX if WeasyPrint or system deps are missing
    try:
        pdf_stream = generate_optimized_resume_pdf(original_resume_text, missing_skills, analysis_data)
        return send_file(
            pdf_stream,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='optimized_cv.pdf'
        )
    except RuntimeError as e:
        # RuntimeError from the PDF generator indicates WeasyPrint or its deps missing.
        try:
            docx_stream = generate_optimized_resume_docx(original_resume_text, missing_skills, analysis_data)
            return send_file(
                docx_stream,
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                as_attachment=True,
                download_name='optimized_cv.docx'
            )
        except Exception as ex:
            return jsonify({"error": f"Failed to generate fallback DOCX: {ex}"}), 500
    except Exception as e:
        return jsonify({"error": f"Failed to generate PDF: {e}"}), 500

if __name__ == '__main__':
    # Ensure you set GEMINI_API_KEY environment variable first!
    # To run: python app.py
    # This will run the backend server on port 5000
    app.run(debug=True, port=5000)