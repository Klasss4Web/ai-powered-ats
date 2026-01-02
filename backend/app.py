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

def generate_optimized_resume_pdf(original_text, missing_skills):
    """
    Creates a new PDF document using an HTML template, inserting the original 
    resume text and the AI-generated optimization section.
    """
    
    # 1. Prepare HTML Content for the Recommended Skills Section
    skills_list_html = "".join([
        f'<li class="missing-skill">• {skill} (Targeted Keyword)</li>'
        for skill in missing_skills
    ])

    # 2. Define the HTML Template and CSS for Professional CV Format
    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Optimized CV</title>
        <style>
            body {{ font-family: 'Helvetica', sans-serif; margin: 0; padding: 0; font-size: 11pt; }}
            .container {{ width: 800px; margin: 30px auto; padding: 30px; border: 1px solid #ccc; }}
            h1 {{ color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 5px; font-size: 18pt; }}
            h2 {{ color: #3c4043; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 3px; font-size: 14pt; }}
            .section-ai {{ background-color: #e6f0fe; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
            .missing-skill {{ color: #d93025; font-weight: bold; margin-left: -20px; }}
            pre {{ white-space: pre-wrap; word-wrap: break-word; font-family: 'Helvetica', monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border-radius: 4px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Optimized Resume Draft (AI Suggestions)</h1>

            <div class="section-ai">
                <h2>🌟 AI Recommended Skill Enhancement Section</h2>
                <p>Based on the job requirements, consider integrating the following keywords into your experience or skill sections to maximize your ATS score:</p>
                <ul>
                    {skills_list_html}
                </ul>
            </div>

            <h2>Extracted Original Resume Content</h2>
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


def generate_optimized_resume_docx(original_text, missing_skills):
    """Create a simple .docx document as a fallback when WeasyPrint isn't available."""
    doc = Document()
    doc.add_heading('Optimized Resume Draft (AI Suggestions)', level=1)

    doc.add_heading('AI Recommended Skill Enhancement Section', level=2)
    for skill in missing_skills:
        doc.add_paragraph(f'• {skill} (Targeted Keyword)')

    doc.add_heading('Extracted Original Resume Content', level=2)
    # Add the original resume text as a single paragraph (preserve basic newlines)
    for line in original_text.splitlines():
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
    You are an expert Applicant Tracking System (ATS) Analyst. Your job is to compare a RESUME against a JOB DESCRIPTION.
    
    --- RESUME TEXT ---
    {resume_text}
    
    --- JOB DESCRIPTION TEXT ---
    {job_description}
    
    Analyze the two texts and perform the following steps:
    1. **Calculate Match Score (0-100%):** Determine the similarity based on skills, experience, and keywords, where 100% means a perfect match.
    2. **Identify Matched Skills:** List 5 to 10 key professional skills or technologies present in BOTH documents.
    3. **Identify Missing Skills:** List 5 to 10 key professional skills or technologies required by the JOB DESCRIPTION but NOT found in the RESUME.
    4. **Generate Recommendation:** Write a brief (max 3 sentences), actionable recommendation for the user to improve their resume specifically for this job description.
    
    Return the results STRICTLY as a single JSON object. Do not add any introductory or concluding text.
    The keys MUST be: "score" (integer), "matched_skills" (list of strings), "missing_skills" (list of strings), and "recommendation_text" (string).
    """

    try:
        # 3. Call the Gemini API
        print("Sending prompt to Gemini API via GenerativeModel...")
        response = model.generate_content(prompt)

        # 4. Parse the JSON response
        # We use a robust method to extract the JSON from the model's text output
        json_string = getattr(response, 'text', str(response)).strip().replace("```json", "").replace("```", "")
        result_json = json.loads(json_string)

        print(f"Analysis successful. Score: {result_json.get('score', 'N/A')}")
        
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
    """Endpoint to generate and return the optimized PDF file."""
    
    data = request.json
    original_resume_text = data.get('original_resume_text')
    missing_skills = data.get('missing_skills', [])
    
    if not original_resume_text or not missing_skills:
        return jsonify({"error": "Missing original resume text or missing skills data."}), 400
        
    # Generate the PDF stream (handle missing WeasyPrint gracefully)
    # Try PDF first, but fallback to DOCX if WeasyPrint or system deps are missing
    try:
        pdf_stream = generate_optimized_resume_pdf(original_resume_text, missing_skills)
        return send_file(
            pdf_stream,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='optimized_cv.pdf'
        )
    except RuntimeError as e:
        # RuntimeError from the PDF generator indicates WeasyPrint or its deps missing.
        try:
            docx_stream = generate_optimized_resume_docx(original_resume_text, missing_skills)
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