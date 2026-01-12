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

def generate_standard_resume_pdf(resume_text):
    """
    Creates a clean, professional PDF resume by parsing the raw text and formatting it into standard CV sections.
    """
    
    # Use Gemini to parse the resume into structured sections
    parse_prompt = f"""
    Parse the following resume text into structured JSON format for a professional CV.
    
    Resume Text:
    {resume_text}
    
    Extract and structure the information into the following sections:
    - name: Full name of the person (string)
    - contact: Object with email, phone, location, linkedin (strings, use empty string if not found)
    - summary: Professional summary or objective (string, use empty string if not present)
    - experience: Array of work experience objects, each with: title (string), company (string), duration (string), location (string), description (array of strings)
    - education: Array of education objects, each with: degree (string), institution (string), year (string), gpa (string)
    - skills: Array of technical/professional skills (strings only)
    - certifications: Array of certification names (strings only, no JSON formatting)
    - projects: Array of project objects, each with: name (string), description (string or array of strings), technologies (array of strings)
    
    IMPORTANT: 
    - Return ONLY valid JSON. Do not add any other text.
    - All string values should be plain text without quotes, brackets, or JSON formatting.
    - Arrays should contain only the actual content strings.
    - If a section is not present, use empty array [] or empty string "".
    - Do not include any JSON-like formatting in the string values themselves.
    """
    
    try:
        response = model.generate_content(parse_prompt)
        response_text = getattr(response, 'text', None) or str(response)
        if not response_text:
            raise ValueError("Empty response from Gemini API")
        json_string = response_text.strip().replace("```json", "").replace("```", "").replace("```JSON", "")
        # Clean up any trailing/leading non-JSON text
        start_idx = json_string.find('{')
        end_idx = json_string.rfind('}') + 1
        if start_idx != -1 and end_idx > start_idx:
            json_string = json_string[start_idx:end_idx]
        if not json_string:
            raise ValueError("Empty JSON string after processing")
        parsed_data = json.loads(json_string)
        
        # Validate and clean the parsed data
        def clean_string(value):
            if isinstance(value, str):
                return value.strip().replace('{', '').replace('}', '').replace('"', '').replace("'", '')
            return str(value).strip()
        
        def clean_array(arr):
            if isinstance(arr, list):
                return [clean_string(item) for item in arr if clean_string(item)]
            elif isinstance(arr, str):
                # Handle case where array is returned as string
                return [item.strip() for item in arr.split(',') if item.strip()]
            return []
        
        # Clean each section
        parsed_data['name'] = clean_string(parsed_data.get('name', 'Professional Name'))
        parsed_data['summary'] = clean_string(parsed_data.get('summary', ''))
        parsed_data['skills'] = clean_array(parsed_data.get('skills', []))
        parsed_data['certifications'] = clean_array(parsed_data.get('certifications', []))
        
        # Clean contact info
        contact = parsed_data.get('contact', {})
        if isinstance(contact, dict):
            for key in contact:
                contact[key] = clean_string(contact[key])
        else:
            parsed_data['contact'] = {"email": "", "phone": "", "location": "", "linkedin": ""}
            
        # Clean experience
        if isinstance(parsed_data.get('experience'), list):
            for exp in parsed_data['experience']:
                if isinstance(exp, dict):
                    for key in exp:
                        if key == 'description' and isinstance(exp[key], list):
                            exp[key] = [clean_string(desc) for desc in exp[key]]
                        else:
                            exp[key] = clean_string(exp[key])
        
        # Clean projects
        if isinstance(parsed_data.get('projects'), list):
            for proj in parsed_data['projects']:
                if isinstance(proj, dict):
                    for key in proj:
                        if key == 'description':
                            if isinstance(proj[key], list):
                                proj[key] = [clean_string(desc) for desc in proj[key]]
                            else:
                                proj[key] = clean_string(proj[key])
                        elif key == 'technologies' and isinstance(proj[key], list):
                            proj[key] = [clean_string(tech) for tech in proj[key]]
                        else:
                            proj[key] = clean_string(proj[key])
        
    except Exception as e:
        print(f"Gemini API error: {e}")
        # Fallback: create basic structure
        parsed_data = {
            "name": "Professional Name",
            "contact": {"email": "", "phone": "", "location": "", "linkedin": ""},
            "summary": "",
            "experience": [],
            "education": [],
            "skills": [],
            "certifications": [],
            "projects": []
        }
    
    # Generate PDF using ReportLab
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
        from reportlab.lib.units import inch
        from reportlab.lib import colors
    except Exception as e:
        raise RuntimeError(f"ReportLab not available: {e}")
    
    pdf_stream = BytesIO()
    doc = SimpleDocTemplate(pdf_stream, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    
    # Custom styles
    styles.add(ParagraphStyle(name='Name', fontSize=24, fontName='Helvetica-Bold', spaceAfter=20, alignment=1))
    styles.add(ParagraphStyle(name='Contact', fontSize=10, textColor=colors.gray, alignment=1, spaceAfter=20))
    styles.add(ParagraphStyle(name='SectionHeader', fontSize=14, fontName='Helvetica-Bold', textColor=colors.darkblue, spaceAfter=10, borderWidth=1, borderColor=colors.lightgrey, borderPadding=5))
    styles.add(ParagraphStyle(name='JobTitle', fontSize=12, fontName='Helvetica-Bold', textColor=colors.darkblue))
    styles.add(ParagraphStyle(name='JobCompany', fontSize=11, fontName='Helvetica-Oblique', textColor=colors.grey))
    styles.add(ParagraphStyle(name='JobDuration', fontSize=10, textColor=colors.grey, spaceAfter=10))
    styles.add(ParagraphStyle(name='NormalIndented', fontSize=10, leftIndent=20))
    
    story = []
    
    # Header
    name = parsed_data.get('name') or 'Professional Name'
    story.append(Paragraph(str(name), styles['Name']))
    
    contact_parts = []
    contact = parsed_data.get('contact', {}) or {}
    if contact.get('email'): contact_parts.append(str(contact['email']))
    if contact.get('phone'): contact_parts.append(str(contact['phone']))
    if contact.get('location'): contact_parts.append(str(contact['location']))
    if contact.get('linkedin'): contact_parts.append(str(contact['linkedin']))
    
    story.append(Paragraph(' | '.join(contact_parts), styles['Contact']))
    
    # Summary
    summary = parsed_data.get('summary')
    if summary:
        story.append(Paragraph('PROFESSIONAL SUMMARY', styles['SectionHeader']))
        story.append(Paragraph(str(summary), styles['Normal']))
        story.append(Spacer(1, 12))
    
    # Experience
    if parsed_data.get('experience'):
        story.append(Paragraph('PROFESSIONAL EXPERIENCE', styles['SectionHeader']))
        for exp in parsed_data['experience']:
            title = exp.get('title') or ''
            story.append(Paragraph(str(title), styles['JobTitle']))
            company_info = str(exp.get('company', ''))
            if exp.get('location'):
                company_info += f" - {str(exp.get('location', ''))}"
            story.append(Paragraph(company_info, styles['JobCompany']))
            if exp.get('duration'):
                story.append(Paragraph(str(exp.get('duration', '')), styles['JobDuration']))
            
            if exp.get('description'):
                for desc in exp['description']:
                    story.append(Paragraph(f"• {str(desc)}", styles['NormalIndented']))
            story.append(Spacer(1, 12))
    
    # Education
    if parsed_data.get('education'):
        story.append(Paragraph('EDUCATION', styles['SectionHeader']))
        for edu in parsed_data['education']:
            degree = str(edu.get('degree', ''))
            institution = str(edu.get('institution', ''))
            year = str(edu.get('year', ''))
            gpa = str(edu.get('gpa', ''))
            
            edu_text = f"<b>{degree}</b><br/>{institution}"
            if year:
                edu_text += f", {year}"
            if gpa:
                edu_text += f" (GPA: {gpa})"
            
            story.append(Paragraph(edu_text, styles['Normal']))
            story.append(Spacer(1, 6))
    
    # Skills
    if parsed_data.get('skills'):
        story.append(Paragraph('SKILLS', styles['SectionHeader']))
        skills_text = ', '.join(str(skill).strip() for skill in parsed_data['skills'] if str(skill).strip())
        story.append(Paragraph(skills_text, styles['Normal']))
        story.append(Spacer(1, 12))
    
    # Certifications
    if parsed_data.get('certifications'):
        story.append(Paragraph('CERTIFICATIONS', styles['SectionHeader']))
        for cert in parsed_data['certifications']:
            cert_text = str(cert).strip()
            # Clean up any JSON formatting artifacts
            cert_text = cert_text.replace('{', '').replace('}', '').replace('"', '').replace("'", '').strip()
            if cert_text:
                story.append(Paragraph(f"• {cert_text}", styles['Normal']))
        story.append(Spacer(1, 12))
    
    # Projects
    if parsed_data.get('projects'):
        story.append(Paragraph('PROJECTS', styles['SectionHeader']))
        for proj in parsed_data['projects']:
            name = str(proj.get('name', '')).strip()
            if name:
                story.append(Paragraph(name, styles['JobTitle']))
            
            description = proj.get('description')
            if description:
                if isinstance(description, list):
                    for desc_item in description:
                        desc_text = str(desc_item).strip()
                        if desc_text:
                            story.append(Paragraph(f"• {desc_text}", styles['NormalIndented']))
                else:
                    desc_text = str(description).strip()
                    if desc_text:
                        story.append(Paragraph(desc_text, styles['Normal']))
            
            technologies = proj.get('technologies')
            if technologies:
                if isinstance(technologies, list):
                    tech_text = f"Technologies: {', '.join(str(tech).strip() for tech in technologies if str(tech).strip())}"
                else:
                    tech_text = f"Technologies: {str(technologies).strip()}"
                story.append(Paragraph(tech_text, styles['NormalIndented']))
            story.append(Spacer(1, 12))
    
    doc.build(story)
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


@app.route('/api/generate-standard-resume', methods=['POST'])
def generate_standard_resume():
    """Endpoint to generate and return a clean, standard PDF resume."""
    
    try:
        data = request.get_json()
    except Exception as e:
        return jsonify({"error": "Invalid JSON in request."}), 400
    
    if not data:
        return jsonify({"error": "No JSON data in request."}), 400
        
    resume_text = data.get('resume_text')
    
    if not resume_text:
        return jsonify({"error": "Missing resume text."}), 400
    
    if not model:
        return jsonify({"error": "Gemini API model is not available. Check server logs."}), 500
    
    try:
        pdf_stream = generate_standard_resume_pdf(resume_text)
        return send_file(
            pdf_stream,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='standard_resume.pdf'
        )
    except RuntimeError as e:
        return jsonify({"error": f"PDF generation failed: {e}"}), 500
    except Exception as e:
        return jsonify({"error": f"Failed to generate standard resume: {e}"}), 500


if __name__ == '__main__':
    # Ensure you set GEMINI_API_KEY environment variable first!
    # To run: python app.py
    # This will run the backend server on port 5000
    app.run(debug=True, port=5000)