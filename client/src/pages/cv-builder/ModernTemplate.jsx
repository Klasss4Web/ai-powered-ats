import "./ModernTemplate.css";

const ModernTemplate = ({ profileData }) => {
  const {
    contact = {},
    job_title = "",
    summary = "",
    experience = [],
    education = [],
    skills = {},
    certifications = [],
    projects = [],
    awards = [],
    publications = [],
  } = profileData || {};

  const isValidUrl = (str) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="modern-template">
      <div className="modern-template__header">
        <h1 className="modern-template__name">{contact.full_name || "Your Name"}</h1>
        {job_title && <div className="modern-template__job-title">{job_title}</div>}
        {(contact.email || contact.phone || contact.location || contact.linkedin || contact.portfolio) && (
          <div className="modern-template__contact">
            {contact.email && (
              <span className="modern-template__contact-item">
                <a href={`mailto:${contact.email}`} className="modern-template__link">
                  {contact.email}
                </a>
              </span>
            )}
            {contact.phone && (
              <span className="modern-template__contact-item">{contact.phone}</span>
            )}
            {contact.location && (
              <span className="modern-template__contact-item">{contact.location}</span>
            )}
            {contact.linkedin && (
              <span className="modern-template__contact-item">
                <a
                  href={isValidUrl(contact.linkedin) ? contact.linkedin : `https://${contact.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modern-template__link"
                >
                  LinkedIn
                </a>
              </span>
            )}
            {contact.portfolio && (
              <span className="modern-template__contact-item">
                <a
                  href={isValidUrl(contact.portfolio) ? contact.portfolio : `https://${contact.portfolio}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modern-template__link"
                >
                  Portfolio
                </a>
              </span>
            )}
          </div>
        )}
      </div>

      {summary && (
        <div className="modern-template__section">
          <h2 className="modern-template__section-title">Professional Summary</h2>
          <p className="modern-template__summary">{summary}</p>
        </div>
      )}

      {experience.length > 0 && (
        <div className="modern-template__section">
          <h2 className="modern-template__section-title">Experience</h2>
          {experience.map((job, i) => (
            <div key={i} className="modern-template__experience-item">
              <div className="modern-template__job-header">
                <span className="modern-template__job-title">{job.title}</span>
                <span className="modern-template__job-meta">{job.duration}</span>
              </div>
              <div>
                <span className="modern-template__job-company">{job.company}</span>
                {job.location && (
                  <span className="modern-template__job-meta"> — {job.location}</span>
                )}
              </div>
              {job.achievements && job.achievements.some((a) => a && a.trim()) && (
                <ul className="modern-template__achievements">
                  {job.achievements.filter((a) => a && a.trim()).map((ach, j) => (
                    <li key={j}>{ach.trim()}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {education.length > 0 && (
        <div className="modern-template__section">
          <h2 className="modern-template__section-title">Education</h2>
          {education.map((edu, i) => (
            <div key={i} className="modern-template__education-item">
              <div className="modern-template__degree">
                {edu.degree}
                {edu.year && <span className="modern-template__job-meta"> ({edu.year})</span>}
              </div>
              <div className="modern-template__school">{edu.institution}</div>
              {(edu.gpa || edu.details) && (
                <div className="modern-template__edu-details">
                  {edu.gpa && `GPA: ${edu.gpa}`}
                  {edu.gpa && edu.details && " | "}
                  {edu.details}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {Object.values(skills).some((arr) => arr && arr.length > 0) && (
        <div className="modern-template__section">
          <h2 className="modern-template__section-title">Skills</h2>
          <div className="modern-template__skills-layout">
            {/* Left column — Technical */}
            {skills.technical && skills.technical.length > 0 && (
              <div className="modern-template__skills-left">
                <div className="modern-template__skill-label">Technical</div>
                <div className="modern-template__chip-list">
                  {skills.technical.map((skill, i) => (
                    <span key={i} className="modern-template__chip">{skill}</span>
                  ))}
                </div>
              </div>
            )}
            {/* Right column — Tools (top) + Soft (bottom) */}
            <div className="modern-template__skills-right">
              {skills.tools && skills.tools.length > 0 && (
                <div className="modern-template__skill-category modern-template__skill-category--top">
                  <div className="modern-template__skill-label">Tools</div>
                  <div className="modern-template__chip-list">
                    {skills.tools.map((skill, i) => (
                      <span key={i} className="modern-template__chip">{skill}</span>
                    ))}
                  </div>
                </div>
              )}
              {skills.soft && skills.soft.length > 0 && (
                <div className="modern-template__skill-category modern-template__skill-category--bottom">
                  <div className="modern-template__skill-label">Soft Skills</div>
                  <div className="modern-template__chip-list">
                    {skills.soft.map((skill, i) => (
                      <span key={i} className="modern-template__chip">{skill}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {certifications.length > 0 && (
        <div className="modern-template__section">
          <h2 className="modern-template__section-title">Certifications</h2>
          <div className="modern-template__tag-list">
            {certifications.map((cert, i) => (
              <span key={i} className="modern-template__tag">{cert}</span>
            ))}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="modern-template__section">
          <h2 className="modern-template__section-title">Projects</h2>
          {projects.map((proj, i) => (
            <div key={i} className="modern-template__project-item">
              <div className="modern-template__project-name">{proj.name}</div>
              {proj.description && (
                <div className="modern-template__project-desc">{proj.description}</div>
              )}
              {proj.technologies && proj.technologies.length > 0 && (
                <div className="modern-template__project-tech">
                  Technologies: {proj.technologies.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {awards.length > 0 && (
        <div className="modern-template__section">
          <h2 className="modern-template__section-title">Awards</h2>
          <ul className="modern-template__achievements">
            {awards.map((award, i) => (
              <li key={i}>{award}</li>
            ))}
          </ul>
        </div>
      )}

      {publications.length > 0 && (
        <div className="modern-template__section">
          <h2 className="modern-template__section-title">Publications</h2>
          <ul className="modern-template__achievements">
            {publications.map((pub, i) => (
              <li key={i}>{pub}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ModernTemplate;
