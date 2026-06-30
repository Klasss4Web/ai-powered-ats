import "./ClassicTemplate.css";

const ClassicTemplate = ({ profileData }) => {
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
    <div className="classic-template">
      <div className="classic-template__header">
        <h1 className="classic-template__name">{contact.full_name || "Your Name"}</h1>
        {job_title && <div className="classic-template__job-title">{job_title}</div>}
        {(contact.email || contact.phone || contact.location) && (
          <div className="classic-template__contact">
            {contact.email && (
              <span className="classic-template__contact-item">
                <a href={`mailto:${contact.email}`} className="classic-template__link">
                  {contact.email}
                </a>
              </span>
            )}
            {contact.phone && (
              <span className="classic-template__contact-item">{contact.phone}</span>
            )}
            {contact.location && (
              <span className="classic-template__contact-item">{contact.location}</span>
            )}
            {contact.linkedin && (
              <span className="classic-template__contact-item">
                <a
                  href={isValidUrl(contact.linkedin) ? contact.linkedin : `https://${contact.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="classic-template__link"
                >
                  LinkedIn
                </a>
              </span>
            )}
            {contact.portfolio && (
              <span className="classic-template__contact-item">
                <a
                  href={isValidUrl(contact.portfolio) ? contact.portfolio : `https://${contact.portfolio}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="classic-template__link"
                >
                  Portfolio
                </a>
              </span>
            )}
          </div>
        )}
      </div>

      {summary && (
        <div className="classic-template__section">
          <h2 className="classic-template__section-title">Professional Summary</h2>
          <p className="classic-template__summary">{summary}</p>
        </div>
      )}

      {experience.length > 0 && (
        <div className="classic-template__section">
          <h2 className="classic-template__section-title">Experience</h2>
          {experience.map((job, i) => (
            <div key={i} className="classic-template__experience-item">
              <div className="classic-template__job-header">
                <span className="classic-template__job-title-text">{job.title}</span>
                <span className="classic-template__job-meta">{job.duration}</span>
              </div>
              <div>
                <span className="classic-template__job-company">{job.company}</span>
                {job.location && (
                  <span className="classic-template__job-meta"> — {job.location}</span>
                )}
              </div>
              {job.achievements && job.achievements.some((a) => a && a.trim()) && (
                <ul className="classic-template__achievements">
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
        <div className="classic-template__section">
          <h2 className="classic-template__section-title">Education</h2>
          {education.map((edu, i) => (
            <div key={i} className="classic-template__education-item">
              <div className="classic-template__degree">
                {edu.degree}
                {edu.year && <span className="classic-template__job-meta"> ({edu.year})</span>}
              </div>
              <div className="classic-template__school">{edu.institution}</div>
              {(edu.gpa || edu.details) && (
                <div className="classic-template__edu-details">
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
        <div className="classic-template__section">
          <h2 className="classic-template__section-title">Skills</h2>
          <div className="classic-template__skills-layout">
            {skills.technical && skills.technical.length > 0 && (
              <div className="classic-template__skills-left">
                <div className="classic-template__skill-label">Technical</div>
                <div className="classic-template__chip-list">
                  {skills.technical.map((skill, i) => (
                    <span key={i} className="classic-template__chip">{skill}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="classic-template__skills-right">
              {skills.tools && skills.tools.length > 0 && (
                <div className="classic-template__skill-category classic-template__skill-category--top">
                  <div className="classic-template__skill-label">Tools</div>
                  <div className="classic-template__chip-list">
                    {skills.tools.map((skill, i) => (
                      <span key={i} className="classic-template__chip">{skill}</span>
                    ))}
                  </div>
                </div>
              )}
              {skills.soft && skills.soft.length > 0 && (
                <div className="classic-template__skill-category classic-template__skill-category--bottom">
                  <div className="classic-template__skill-label">Soft Skills</div>
                  <div className="classic-template__chip-list">
                    {skills.soft.map((skill, i) => (
                      <span key={i} className="classic-template__chip">{skill}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {certifications.length > 0 && (
        <div className="classic-template__section">
          <h2 className="classic-template__section-title">Certifications</h2>
          <div className="classic-template__tag-list">
            {certifications.map((cert, i) => (
              <span key={i} className="classic-template__tag">{cert}</span>
            ))}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="classic-template__section">
          <h2 className="classic-template__section-title">Projects</h2>
          {projects.map((proj, i) => (
            <div key={i} className="classic-template__project-item">
              <div className="classic-template__project-name">{proj.name}</div>
              {proj.description && (
                <div className="classic-template__project-desc">{proj.description}</div>
              )}
              {proj.technologies && proj.technologies.length > 0 && (
                <div className="classic-template__project-tech">
                  Technologies: {proj.technologies.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {awards.length > 0 && (
        <div className="classic-template__section">
          <h2 className="classic-template__section-title">Awards</h2>
          <ul className="classic-template__achievements">
            {awards.map((award, i) => (
              <li key={i}>{award}</li>
            ))}
          </ul>
        </div>
      )}

      {publications.length > 0 && (
        <div className="classic-template__section">
          <h2 className="classic-template__section-title">Publications</h2>
          <ul className="classic-template__achievements">
            {publications.map((pub, i) => (
              <li key={i}>{pub}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ClassicTemplate;
