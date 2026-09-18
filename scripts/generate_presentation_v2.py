import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def build_presentation():
    input_file = "SIH2026-IDEA-Presentation-Format.pptx"
    output_file = "Divya-Drishti-SIH26167-Presentation-Final.pptx"
    
    prs = Presentation(input_file)
    print(f"Loaded {input_file}, slides: {len(prs.slides)}")
    
    # Palette
    DARK_BLUE = RGBColor(14, 28, 54)
    CYAN_ACCENT = RGBColor(0, 140, 180)
    ORANGE_ACCENT = RGBColor(225, 90, 30)
    TEXT_DARK = RGBColor(30, 41, 59)
    TEXT_MUTED = RGBColor(100, 116, 139)
    BORDER_COLOR = RGBColor(203, 213, 225)
    CARD_BG = RGBColor(248, 250, 253)
    
    FONT_NAME = "Calibri"

    def update_oval_team(slide, team_name="Divya Drishti"):
        for shp in slide.shapes:
            if "Oval" in shp.name or (shp.has_text_frame and "Your Team Name" in shp.text_frame.text):
                shp.text_frame.clear()
                p = shp.text_frame.paragraphs[0]
                p.text = team_name
                p.alignment = PP_ALIGN.CENTER
                p.font.name = FONT_NAME
                p.font.size = Pt(11)
                p.font.bold = True
                p.font.color.rgb = RGBColor(255, 255, 255)
                shp.fill.solid()
                shp.fill.fore_color.rgb = CYAN_ACCENT

    def update_footer(slide, slide_num):
        for shp in slide.shapes:
            if shp.has_text_frame and "@SIH Idea submission" in shp.text_frame.text:
                shp.text_frame.clear()
                p = shp.text_frame.paragraphs[0]
                p.text = f"@SIH Idea submission- Template | Divya Drishti | Slide {slide_num}"
                p.font.name = FONT_NAME
                p.font.size = Pt(9.5)
                p.font.color.rgb = TEXT_MUTED

    def remove_textbox_8(slide):
        to_remove = []
        for shp in slide.shapes:
            if shp.name == "TextBox 8" or (shp.has_text_frame and any(ph in shp.text_frame.text for ph in [
                "Proposed Solution (Describe your Idea",
                "Technologies to be used (e.g.",
                "Analysis of the feasibility",
                "Potential impact on the target audience",
                "Details / Links of the reference"
            ])):
                to_remove.append(shp)
        for shp in to_remove:
            sp = shp._element
            sp.getparent().remove(sp)

    def add_bullet(tf, title, desc, title_color=DARK_BLUE, font_size=9.5, space_after=2.5):
        p = tf.add_paragraph()
        p.space_after = Pt(space_after)
        p.space_before = Pt(1)
        run_t = p.add_run()
        run_t.text = f"• {title}: "
        run_t.font.bold = True
        run_t.font.size = Pt(font_size)
        run_t.font.name = FONT_NAME
        run_t.font.color.rgb = title_color
        run_d = p.add_run()
        run_d.text = desc
        run_d.font.bold = False
        run_d.font.size = Pt(font_size)
        run_d.font.name = FONT_NAME
        run_d.font.color.rgb = TEXT_DARK
        return p

    def add_section_header(tf, text, color=DARK_BLUE, font_size=11):
        p = tf.add_paragraph()
        p.space_before = Pt(5)
        p.space_after = Pt(2)
        run = p.add_run()
        run.text = text
        run.font.bold = True
        run.font.size = Pt(font_size)
        run.font.name = FONT_NAME
        run.font.color.rgb = color
        return p

    # =========================================================================
    # SLIDE 1: TITLE PAGE
    # =========================================================================
    print("Formatting Slide 1 (Title Page)...")
    s1 = prs.slides[0]
    
    # Remove redundant Subtitle 3 ('TITLE PAGE')
    for shp in list(s1.shapes):
        if shp.has_text_frame and "TITLE PAGE" in shp.text_frame.text:
            sp = shp._element
            sp.getparent().remove(sp)

    for shp in s1.shapes:
        if shp.has_text_frame and "SMART INDIA HACKATHON 2026" in shp.text_frame.text:
            shp.text_frame.clear()
            p = shp.text_frame.paragraphs[0]
            p.text = "SMART INDIA HACKATHON 2026"
            p.font.name = FONT_NAME
            p.font.size = Pt(30)
            p.font.bold = True
            p.font.color.rgb = DARK_BLUE

    for shp in s1.shapes:
        if shp.name == "TextBox 9" or (shp.has_text_frame and "Problem Statement ID" in shp.text_frame.text):
            tf = shp.text_frame
            tf.word_wrap = True
            tf.clear()
            
            lines = [
                ("Problem Statement ID: ", "SIH26167", ORANGE_ACCENT, True),
                ("Problem Statement Title: ", "SatQuery AI - Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries", DARK_BLUE, True),
                ("Theme & Category: ", "Space Technology | Category: Software", DARK_BLUE, False),
                ("Target Organization: ", "Indian Space Research Organisation (ISRO) — Space Applications Centre (SAC)", DARK_BLUE, True),
                ("Team Name: ", "Divya Drishti (दिव्य दृष्टि)", CYAN_ACCENT, True),
                ("Institute Name: ", "L.D. College of Engineering, Ahmedabad, Gujarat", DARK_BLUE, False),
                ("Team Leader: ", "Tanmay Shah (Enrollment: 230020107079)", DARK_BLUE, True),
                ("Team Members: ", "Vadodaria Dhrumil (230020107088), Karan Vaghela (230020107090), Pushti Doshi (240023107030), Kunj Vachharajani (230020107087), Krish Shah (230020107077)", TEXT_DARK, False)
            ]
            
            for idx, (label, val, col, highlight) in enumerate(lines):
                p = tf.add_paragraph() if idx > 0 else tf.paragraphs[0]
                p.space_after = Pt(4)
                r1 = p.add_run()
                r1.text = label
                r1.font.bold = True
                r1.font.size = Pt(11)
                r1.font.name = FONT_NAME
                r1.font.color.rgb = DARK_BLUE
                
                r2 = p.add_run()
                r2.text = val
                r2.font.bold = highlight
                r2.font.size = Pt(11)
                r2.font.name = FONT_NAME
                r2.font.color.rgb = col

    # =========================================================================
    # SLIDE 2: IDEA TITLE & PROPOSED SOLUTION
    # =========================================================================
    print("Formatting Slide 2 (Idea Title & Comparison Diagram)...")
    s2 = prs.slides[1]
    update_oval_team(s2)
    update_footer(s2, 2)
    remove_textbox_8(s2)

    for shp in s2.shapes:
        if shp.name == "Title 1" or (shp.has_text_frame and "IDEA TITLE" in shp.text_frame.text):
            shp.text_frame.clear()
            p = shp.text_frame.paragraphs[0]
            p.text = "IDEA TITLE: SatQuery AI — Agentic Multimodal Remote Sensing Studio"
            p.font.name = FONT_NAME
            p.font.size = Pt(19)
            p.font.bold = True
            p.font.color.rgb = DARK_BLUE

    # Left Side: diagram_problem_solution.png
    diag2_path = "generated_diagrams/diagram_problem_solution.png"
    if os.path.exists(diag2_path):
        s2.shapes.add_picture(diag2_path, Inches(0.6), Inches(1.35), width=Inches(6.6))

    # Right Side: Landing-page.png (Live Prototype Hero)
    if os.path.exists("Landing-page.png"):
        s2.shapes.add_picture("Landing-page.png", Inches(7.4), Inches(1.35), width=Inches(5.3))
        c2 = s2.shapes.add_textbox(Inches(7.4), Inches(5.65), Inches(5.3), Inches(0.9))
        tf_c2 = c2.text_frame
        tf_c2.word_wrap = True
        p_c2 = tf_c2.paragraphs[0]
        p_c2.alignment = PP_ALIGN.CENTER
        run_c = p_c2.add_run()
        run_c.text = "Live Working Prototype: SatQuery AI 3D Earth Mission Console & ISRO SAC HUD"
        run_c.font.size = Pt(9.5)
        run_c.font.bold = True
        run_c.font.color.rgb = CYAN_ACCENT

    # =========================================================================
    # SLIDE 3: TECHNICAL APPROACH (Architecture Flowchart + Live Dashboard)
    # =========================================================================
    print("Formatting Slide 3 (Technical Approach & Architecture Diagram)...")
    s3 = prs.slides[2]
    update_oval_team(s3)
    update_footer(s3, 3)
    remove_textbox_8(s3)

    for shp in s3.shapes:
        if shp.name == "Title 1" or (shp.has_text_frame and "TECHNICAL APPROACH" in shp.text_frame.text):
            shp.text_frame.clear()
            p = shp.text_frame.paragraphs[0]
            p.text = "TECHNICAL APPROACH & SYSTEM ARCHITECTURE"
            p.font.name = FONT_NAME
            p.font.size = Pt(19)
            p.font.bold = True
            p.font.color.rgb = DARK_BLUE

    # Top: Full-Width 5-Stage Architecture Diagram
    diag3_path = "generated_diagrams/diagram_architecture.png"
    if os.path.exists(diag3_path):
        s3.shapes.add_picture(diag3_path, Inches(0.6), Inches(1.35), width=Inches(7.2))

    # Right: Dashboard.png (Interactive Map Studio)
    if os.path.exists("Dashboard.png"):
        s3.shapes.add_picture("Dashboard.png", Inches(8.0), Inches(1.35), width=Inches(4.7))
        c3 = s3.shapes.add_textbox(Inches(8.0), Inches(4.3), Inches(4.7), Inches(0.7))
        tf_c3 = c3.text_frame
        tf_c3.word_wrap = True
        p_c3 = tf_c3.paragraphs[0]
        p_c3.alignment = PP_ALIGN.CENTER
        run_c3 = p_c3.add_run()
        run_c3.text = "Operational Studio: MapLibre GL WebGL Engine, Swipe Slider & Multi-Sensor Layers"
        run_c3.font.size = Pt(9)
        run_c3.font.bold = True
        run_c3.font.color.rgb = CYAN_ACCENT

    # Bottom Right: Tech Stack Card
    box_tech = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.0), Inches(4.95), Inches(4.7), Inches(1.75))
    box_tech.fill.solid()
    box_tech.fill.fore_color.rgb = CARD_BG
    box_tech.line.color.rgb = BORDER_COLOR
    box_tech.line.width = Pt(1)
    tf_tech = box_tech.text_frame
    tf_tech.word_wrap = True
    tf_tech.margin_left = Inches(0.15)
    tf_tech.margin_right = Inches(0.15)
    tf_tech.margin_top = Inches(0.1)
    
    p_th = tf_tech.paragraphs[0]
    p_th.text = "PRODUCTION TECH STACK & FOUNDATION"
    p_th.font.bold = True
    p_th.font.size = Pt(10.5)
    p_th.font.color.rgb = DARK_BLUE
    
    add_bullet(tf_tech, "Frontend", "Next.js 15, MapLibre GL JS, MapLibre Compare, Tailwind CSS, Zustand.", DARK_BLUE, 9, 2)
    add_bullet(tf_tech, "Backend / GIS", "Python 3.12, FastAPI, rasterio (windowed reads), GDAL, pyproj, shapely.", DARK_BLUE, 9, 2)
    add_bullet(tf_tech, "AI / Inference", "RemoteCLIP (ViT-B/32), MobileSAM, ChangeFormer-v2, ONNX Runtime.", DARK_BLUE, 9, 2)

    # =========================================================================
    # SLIDE 4: FEASIBILITY AND VIABILITY (Risk Flowchart + Briefing Modal)
    # =========================================================================
    print("Formatting Slide 4 (Feasibility & Risk Matrix Diagram)...")
    s4 = prs.slides[3]
    update_oval_team(s4)
    update_footer(s4, 4)
    remove_textbox_8(s4)

    for shp in s4.shapes:
        if shp.name == "Title 1" or (shp.has_text_frame and "FEASIBILITY AND VIABILITY" in shp.text_frame.text):
            shp.text_frame.clear()
            p = shp.text_frame.paragraphs[0]
            p.text = "FEASIBILITY AND VIABILITY ANALYSIS"
            p.font.name = FONT_NAME
            p.font.size = Pt(19)
            p.font.bold = True
            p.font.color.rgb = DARK_BLUE

    # Left: diagram_risk_mitigation.png
    diag4_path = "generated_diagrams/diagram_risk_mitigation.png"
    if os.path.exists(diag4_path):
        s4.shapes.add_picture(diag4_path, Inches(0.6), Inches(1.35), width=Inches(6.8))

    # Right: breafing-download.png (Verified Mission Briefing)
    if os.path.exists("breafing-download.png"):
        s4.shapes.add_picture("breafing-download.png", Inches(7.6), Inches(1.35), width=Inches(5.1))
        c4 = s4.shapes.add_textbox(Inches(7.6), Inches(5.65), Inches(5.1), Inches(0.9))
        tf_c4 = c4.text_frame
        tf_c4.word_wrap = True
        p_c4 = tf_c4.paragraphs[0]
        p_c4.alignment = PP_ALIGN.CENTER
        run_c4 = p_c4.add_run()
        run_c4.text = "Verifiable Intelligence: Tactical Mission Briefing, 96.8% Calibrated Confidence, & One-Click PDF/GeoJSON Export"
        run_c4.font.size = Pt(9.5)
        run_c4.font.bold = True
        run_c4.font.color.rgb = CYAN_ACCENT

    # =========================================================================
    # SLIDE 5: IMPACT AND BENEFITS (Full-Width Infographic Matrix)
    # =========================================================================
    print("Formatting Slide 5 (Strategic Impact Matrix Diagram)...")
    s5 = prs.slides[4]
    update_oval_team(s5)
    update_footer(s5, 5)
    remove_textbox_8(s5)

    for shp in s5.shapes:
        if shp.name == "Title 1" or (shp.has_text_frame and "IMPACT AND BENEFITS" in shp.text_frame.text):
            shp.text_frame.clear()
            p = shp.text_frame.paragraphs[0]
            p.text = "IMPACT AND BENEFITS — STRATEGIC VALUE"
            p.font.name = FONT_NAME
            p.font.size = Pt(19)
            p.font.bold = True
            p.font.color.rgb = DARK_BLUE

    # Full-Width Hero: diagram_impact_matrix.png
    diag5_path = "generated_diagrams/diagram_impact_matrix.png"
    if os.path.exists(diag5_path):
        s5.shapes.add_picture(diag5_path, Inches(0.6), Inches(1.35), width=Inches(12.1))

    # =========================================================================
    # SLIDE 6: RESEARCH AND REFERENCES
    # =========================================================================
    print("Formatting Slide 6 (Research & References)...")
    s6 = prs.slides[5]
    update_oval_team(s6)
    update_footer(s6, 6)
    remove_textbox_8(s6)

    for shp in s6.shapes:
        if shp.name == "Title 1" or (shp.has_text_frame and "RESEARCH" in shp.text_frame.text):
            shp.text_frame.clear()
            p = shp.text_frame.paragraphs[0]
            p.text = "RESEARCH, DATASETS AND REFERENCES"
            p.font.name = FONT_NAME
            p.font.size = Pt(19)
            p.font.bold = True
            p.font.color.rgb = DARK_BLUE

    # Left Box: Prescribed Datasets
    box6_l = s6.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.35), Inches(5.9), Inches(5.35))
    box6_l.fill.solid()
    box6_l.fill.fore_color.rgb = CARD_BG
    box6_l.line.color.rgb = BORDER_COLOR
    box6_l.line.width = Pt(1)
    
    tf6_l = box6_l.text_frame
    tf6_l.word_wrap = True
    tf6_l.margin_left = Inches(0.2)
    tf6_l.margin_right = Inches(0.2)
    tf6_l.margin_top = Inches(0.15)
    
    p6_l0 = tf6_l.paragraphs[0]
    p6_l0.text = "1. Prescribed Benchmark Datasets & Pretraining Corpus"
    p6_l0.font.bold = True
    p6_l0.font.size = Pt(11.5)
    p6_l0.font.color.rgb = DARK_BLUE
    p6_l0.space_after = Pt(2)

    add_bullet(tf6_l, "BigEarthNet.txt (arXiv:2603.29630)", "Primary adaptation corpus: 590k co-registered Sentinel-1 SAR & Sentinel-2 optical image-text pairs.")
    add_bullet(tf6_l, "VRSBench (Yang et al., 2024)", "High-resolution remote sensing dataset for VQA, visual grounding & detailed scene captioning.")
    add_bullet(tf6_l, "RSVQA (Lobry et al., IEEE TGRS 2020)", "Benchmark visual question answering dataset on high and low resolution satellite imagery.")
    add_bullet(tf6_l, "CDVQA (Yuan et al., 2023)", "Multitemporal change-based remote-sensing visual question answering dataset.")
    add_bullet(tf6_l, "ISRO / SAC Evaluation Set", "Pre-georeferenced & co-registered Cartosat-2S optical + RISAT-1A SAR pairs for final evaluation.")

    add_section_header(tf6_l, "2. Earth Observation Platforms Supported", DARK_BLUE, 11.5)
    add_bullet(tf6_l, "ISRO Cartosat-2S / 3", "Sub-meter optical panchromatic & multispectral sensors for tactical infrastructure mapping.")
    add_bullet(tf6_l, "ISRO RISAT-1A / EOS-04", "C-band active SAR radar for all-weather day-and-night surface backscatter analysis.")
    add_bullet(tf6_l, "ESA Copernicus Sentinel-1 & 2", "Open global Sentinel-1 (C-SAR) and Sentinel-2 (MSI 12-band Level-2A) constellations.")

    # Right Box: Literature & Deliverables
    box6_r = s6.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(6.8), Inches(1.35), Inches(5.8), Inches(5.35))
    box6_r.fill.solid()
    box6_r.fill.fore_color.rgb = CARD_BG
    box6_r.line.color.rgb = BORDER_COLOR
    box6_r.line.width = Pt(1)
    
    tf6_r = box6_r.text_frame
    tf6_r.word_wrap = True
    tf6_r.margin_left = Inches(0.2)
    tf6_r.margin_right = Inches(0.2)
    tf6_r.margin_top = Inches(0.15)
    
    p6_r0 = tf6_r.paragraphs[0]
    p6_r0.text = "3. Foundational Research Literature"
    p6_r0.font.bold = True
    p6_r0.font.size = Pt(11.5)
    p6_r0.font.color.rgb = DARK_BLUE
    p6_r0.space_after = Pt(2)

    add_bullet(tf6_r, "RemoteCLIP (IEEE TGRS 2024)", "Liu et al., 'RemoteCLIP: A Vision-Language Foundation Model for Remote Sensing'.")
    add_bullet(tf6_r, "ChangeFormer (IEEE JSTARS 2022)", "Bandara et al., 'ChangeFormer: A Transformer-Based Architecture for Remote Sensing Change Detection'.")
    add_bullet(tf6_r, "MobileSAM (arXiv:2306.14289)", "Zhang et al., 'Faster Segment Anything: Towards Lightweight SAM for Real-Time Applications'.")
    add_bullet(tf6_r, "BigEarthNet-S2 (IEEE IGARSS)", "Sumbul et al., 'BigEarthNet: A Large-Scale Benchmark Archive for Remote Sensing Image Understanding'.")

    add_section_header(tf6_r, "4. System Repository & Deliverables", DARK_BLUE, 11.5)
    add_bullet(tf6_r, "GitHub Repository", "https://github.com/TanmayShah29/SATQuery-AI")
    add_bullet(tf6_r, "Prototype Deployment", "Interactive GUI / Web Application running locally with full offline scenario caching.")
    add_bullet(tf6_r, "Compliant Deliverables", "Complete source code, adapted model weights, test suite & auditable demonstration script.")

    # =========================================================================
    # DELETE SLIDE 7
    # =========================================================================
    print("Deleting Slide 7 (Instructions slide)...")
    rId = prs.slides._sldIdLst[6].rId
    prs.part.drop_rel(rId)
    del prs.slides._sldIdLst[6]
    
    prs.save(output_file)
    print(f"SUCCESS: Generated {output_file} with {len(prs.slides)} slides!")

if __name__ == "__main__":
    build_presentation()
