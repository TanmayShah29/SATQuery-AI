# SIH 2026: Official PPT & Idea Submission Playbook

This document mirrors the exact structure and mandates extracted directly from the official template [SIH2026-IDEA-Presentation-Format.pptx](file:///Users/tanmay/SIH-2026/sih-info/SIH2026-IDEA-Presentation-Format.pptx).

National screening evaluators review hundreds of decks per problem statement. The average evaluation window per deck is 90 to 180 seconds. You must maintain the official headers and pointers verbatim, while maximizing visual impact.

---

## 1. Official Mandatory Submission Rules (from Slide 7)

1. **Strict Slide Limit**: Exactly **six (6) slides maximum**, including the Title Page.
2. **Format Requirement**: Export to **PDF** before portal upload. `.pptx`, Word docs, or any other file formats will be rejected.
3. **Template Integrity**: You must use the official template and **retain the exact section pointers**. Do not rename the mandatory headers.
4. **No Paragraph Walls**: Use bullet points, architecture diagrams, infographics, screenshots, and visual tables. Avoid dense blocks of text.
5. **Delete Instruction Slide**: Slide 7 (Important Pointers) must be deleted prior to PDF export.
6. **Footer Tagging**: Maintain `@SIH Idea submission- Template | [Your Team Name] | Slide X` on slides 2 through 6.

---

## 2. Slide-by-Slide Official Structure & Content Architecture

### Slide 1: TITLE PAGE
- **Header**: `SMART INDIA HACKATHON 2026`
- **Fields to Complete**:
  - `Problem Statement ID`: Exact code from the portal (e.g., `SIH26001`).
  - `Problem Statement Title`: Verbatim title from the problem statement page.
  - `Theme`: (e.g., Disaster Management, Healthcare, Agriculture, Transportation).
  - `PS Category`: Specify `Software` or `Hardware`.
  - `Team ID`: Generated upon portal registration by college SPOC.
  - `Team Name`: Official team name registered on the portal (no college name in team name).
- **Recommended Additions**: Institute Name, Institute Logo, Team Member Roster with roles (Team Lead, Backend/Systems, Frontend/UI, ML/AI, Testing/DevOps, Documentation/Pitch).

---

### Slide 2: IDEA TITLE & PROPOSED SOLUTION
- **Official Header**: `IDEA TITLE`
- **Official Mandatory Pointers**:
  - `Proposed Solution (Describe your Idea/Solution/Prototype)`
  - `Detailed explanation of the proposed solution`
  - `How it addresses the problem`
  - `Innovation and uniqueness of the solution`
- **Winning Strategy**:
  - Provide a 2-sentence executive summary defining the core technical mechanism.
  - Include a comparative table: *Current Ground Reality / Existing Flaw* vs. *Our Proposed Solution*.
  - Explicitly call out the **Novelty Factor**: state exactly what differentiates this approach from existing commercial or open-source solutions (e.g., edge compute, zero-cloud dependency, multi-modal fusion).

---

### Slide 3: TECHNICAL APPROACH
- **Official Header**: `TECHNICAL APPROACH`
- **Official Mandatory Pointers**:
  - `Technologies to be used (e.g. programming languages, frameworks, hardware)`
  - `Methodology and process for implementation (Flow Charts/Images/ working prototype)`
- **Winning Strategy**:
  - Dedicate 70% of the slide area to an **End-to-End System Architecture Diagram**:
    - Data Ingestion Layer (IoT, mobile client, satellite, web portal).
    - Processing & Core Logic Engine (APIs, ML pipeline, business logic).
    - Storage & Security Layer (Database, cache, encryption, access control).
    - Presentation Layer (Officer dashboard, citizen portal, alert dispatcher).
  - Include a compact **Tech Stack Grid**: Languages, Frameworks, Database, Cloud/Hosting.

---

### Slide 4: FEASIBILITY AND VIABILITY
- **Official Header**: `FEASIBILITY AND VIABILITY`
- **Official Mandatory Pointers**:
  - `Analysis of the feasibility of the idea`
  - `Potential challenges and risks`
  - `Strategies for overcoming these challenges`
- **Winning Strategy**:
  - Present a concrete **Risk vs. Mitigation Matrix**:
    - *Risk 1 (e.g. Low/intermittent internet in target regions)* -> *Mitigation: Local SQLite cache with background sync*.
    - *Risk 2 (e.g. Data privacy & regulatory compliance)* -> *Mitigation: Role-based access control, cryptographic verification*.
    - *Risk 3 (e.g. User adoption among non-technical personnel)* -> *Mitigation: Multi-lingual voice UI, simplified 2-step workflows*.
  - Include a clickable prototype / Figma link or wireframe thumbnail.

---

### Slide 5: IMPACT AND BENEFITS
- **Official Header**: `IMPACT AND BENEFITS`
- **Official Mandatory Pointers**:
  - `Potential impact on the target audience`
  - `Benefits of the solution (social, economic, environmental, etc.)`
- **Winning Strategy**:
  - Quantify the impact metrics where possible (e.g., "Cuts reporting delay from 48 hours to real-time", "Reduces operational costs by 60%").
  - Categorize benefits clearly:
    - *Government / Ministry Beneficiaries*: Improved monitoring, fraud prevention, auditability.
    - *Citizen / End-User Beneficiaries*: Accessibility, speed, transparency.
    - *Economic & Social*: Scalability, low maintenance footprint.

---

### Slide 6: RESEARCH AND REFERENCES
- **Official Header**: `RESEARCH AND REFERENCES`
- **Official Mandatory Pointers**:
  - `Details / Links of the reference and research work`
- **Winning Strategy**:
  - Cite relevant IEEE papers, government reports, or open datasets that validate your problem understanding.
  - Link official ministry documentation or existing policy frameworks your project aligns with (e.g., NDHM, DigiLocker APIs, Bhashini, OpenMaps).
  - Include GitHub repository link or pre-built open-source foundation references.

---

## 3. National Screening Evaluation Rubric (100 Points)

| Evaluation Parameter | Weight | Evaluator Focus |
|---|---|---|
| **Novelty & Uniqueness** | 25 pts | Genuine innovation vs. standard CRUD wrapper. |
| **Technical Feasibility** | 25 pts | Soundness of architecture, realistic for 36-hour sprint. |
| **Impact & Relevance** | 20 pts | Direct addressal of sponsoring ministry's core friction. |
| **User Experience & Workflow** | 15 pts | Usability for ground officials and non-tech citizens. |
| **Template Adherence & Quality** | 15 pts | Exact 6-slide count, diagrams used, clean PDF formatting. |
