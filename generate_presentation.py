import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def build_presentation():
    input_file = "SIH2026-IDEA-Presentation-Format.pptx"
    output_file = "Divya-Drishti-SIH26167-Presentation-Final.pptx"
    
    prs = Presentation(input_file)
    print(f"Loaded {input_file}, slides: {len(prs.slides)}")
    
    # Professional Palette
    DARK_BLUE = RGBColor(14, 28, 54)        # Deep Navy Header
    CYAN_ACCENT = RGBColor(0, 140, 180)      # Tech Cyan
    ORANGE_ACCENT = RGBColor(225, 90, 30)    # SIH Brand Orange
    TEXT_DARK = RGBColor(30, 41, 59)         # Charcoal text
    TEXT_MUTED = RGBColor(100, 116, 139)     # Slate text
    CARD_BG = RGBColor(248, 250, 253)        # Clean off-white
    BORDER_COLOR = RGBColor(203, 213, 225)   # Light border
    HIGHLIGHT_GREEN = RGBColor(22, 101, 52)  # Dark Forest Green for mitigations
    
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
    print("Formatting Slide 1...")
    s1 = prs.slides[0]
    
    # Remove redundant Subtitle 3 ('TITLE PAGE')
    for shp in list(s1.shapes):
        if shp.has_text_frame and "TITLE PAGE" in shp.text_frame.text:
            sp = shp._element
            sp.getparent().remove(sp)

    # Format Title 7
    for shp in s1.shapes:
        if shp.has_text_frame and "SMART INDIA HACKATHON 2026" in shp.text_frame.text:
            shp.text_frame.clear()
            p = shp.text_frame.paragraphs[0]
            p.text = "SMART INDIA HACKATHON 2026"
            p.font.name = FONT_NAME
            p.font.size = Pt(30)
            p.font.bold = True
            p.font.color.rgb = DARK_BLUE

    # Format metadata box (TextBox 9)
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
    print("Formatting Slide 2...")
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

    # Left content box
    box2 = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.35), Inches(6.4), Inches(5.35))
    box2.fill.solid()
    box2.fill.fore_color.rgb = CARD_BG
    box2.line.color.rgb = BORDER_COLOR
    box2.line.width = Pt(1)
    
    tf2 = box2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = Inches(0.2)
    tf2.margin_right = Inches(0.2)
    tf2.margin_top = Inches(0.15)
    tf2.margin_bottom = Inches(0.15)

    p2_0 = tf2.paragraphs[0]
    p2_0.text = "1. Problem Addressed & Operational Reality"
    p2_0.font.bold = True
    p2_0.font.size = Pt(11.5)
    p2_0.font.color.rgb = DARK_BLUE
    p2_0.space_after = Pt(2)

    add_bullet(tf2, "Isolated Workflows", "Current satellite analysis requires specialized GIS desktop tools & manual parameter tuning.")
    add_bullet(tf2, "Cloud-Cover Blindness", "Optical satellites cannot penetrate monsoon clouds; radar (SAR) is all-weather but hard to interpret.")
    add_bullet(tf2, "Generic VLM Failure", "Generic LLM chat wrappers hallucinate coordinates and lack multi-band remote-sensing adaptation.")

    add_section_header(tf2, "2. Proposed Solution: SatQuery AI Studio", DARK_BLUE, 11.5)
    add_bullet(tf2, "Interactive Geospatial Studio", "Query-driven web workbench that accepts natural text queries and delivers verifiable visual evidence.")
    add_bullet(tf2, "Agentic Controller Architecture", "Interprets queries and orchestrates a registry of 4 specialist models (VQA, Grounding, Change, SAR).")
    add_bullet(tf2, "Native GeoTIFF Ingestion", "Directly ingests uncompressed rasters preserving geographic CRS, GSD, and calibrated radiometry.")

    add_section_header(tf2, "3. Innovation & Uniqueness (Anti-AI Wrapper)", DARK_BLUE, 11.5)
    add_bullet(tf2, "Hardware-Accelerated WebGL Canvas", "MapLibre GL split-screen curtain slider (t1 vs t2 / Optical vs SAR) with synchronized camera panning.")
    add_bullet(tf2, "Auditable Execution Trace", "Real-time inspectable telemetry drawer showing selected model, tensor dimensions, latency & confidence.")
    add_bullet(tf2, "Zero Proprietary Token Cost", "Runs 100% self-hosted on local/edge workstations without reliance on expensive commercial APIs.")

    # Right Image: Landing-page.png
    if os.path.exists("Landing-page.png"):
        s2.shapes.add_picture("Landing-page.png", Inches(7.2), Inches(1.35), width=Inches(5.5))
        c2 = s2.shapes.add_textbox(Inches(7.2), Inches(5.75), Inches(5.5), Inches(0.8))
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
    # SLIDE 3: TECHNICAL APPROACH
    # =========================================================================
    print("Formatting Slide 3...")
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

    # Left content box
    box3 = s3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.35), Inches(6.4), Inches(5.35))
    box3.fill.solid()
    box3.fill.fore_color.rgb = CARD_BG
    box3.line.color.rgb = BORDER_COLOR
    box3.line.width = Pt(1)
    
    tf3 = box3.text_frame
    tf3.word_wrap = True
    tf3.margin_left = Inches(0.2)
    tf3.margin_right = Inches(0.2)
    tf3.margin_top = Inches(0.15)
    tf3.margin_bottom = Inches(0.15)

    p3_0 = tf3.paragraphs[0]
    p3_0.text = "1. Four Specialist AI Engines (Pre-Trained & Adapted)"
    p3_0.font.bold = True
    p3_0.font.size = Pt(11.5)
    p3_0.font.color.rgb = DARK_BLUE
    p3_0.space_after = Pt(2)

    add_bullet(tf3, "Single-Image VQA & Captioning", "RemoteCLIP (ViT-B/32) adapted on BigEarthNet.txt & RSVQA for land-use and facility analysis.")
    add_bullet(tf3, "Text-Guided Region Grounder", "MobileSAM prompted by RemoteCLIP text embeddings for <50ms zero-shot instance segmentation.")
    add_bullet(tf3, "Bi-Temporal Change Detector", "ChangeFormer-v2 hierarchical Siamese transformer extracting structural differences between t1 & t2.")
    add_bullet(tf3, "Cross-Modal SAR + Optical Fusion", "Dual-branch cross-attention fusing Sentinel-2 (RGB/NIR) with Sentinel-1 SAR (VV/VH backscatter).")

    add_section_header(tf3, "2. End-to-End Pipeline & Process Workflow", DARK_BLUE, 11.5)
    add_bullet(tf3, "Step 1 (Ingest & Validate)", "FastAPI engine validates CRS, GSD, spatial co-registration & radiometric bounds of GeoTIFFs.")
    add_bullet(tf3, "Step 2 (Task Routing DAG)", "Agent controller classifies query intent, selects specialist models, and configures task parameters.")
    add_bullet(tf3, "Step 3 (Evidence Synthesis)", "Generates pixel masks, GeoJSON bounding polygons, and calibrated confidence estimates.")
    add_bullet(tf3, "Step 4 (Client Presentation)", "MapLibre GL renders dynamic vector layers, heatmaps, and downloadable intelligence briefs.")

    add_section_header(tf3, "3. Production Technology Stack", DARK_BLUE, 11.5)
    add_bullet(tf3, "Frontend Interface", "Next.js 15, Tailwind CSS, MapLibre GL JS, MapLibre Compare (Swipe Curtain), Zustand.")
    add_bullet(tf3, "Backend & Inference", "Python 3.12, FastAPI, rasterio, GDAL, pyproj, shapely, geopandas, ONNX Runtime.")

    # Right Image: Dashboard.png
    if os.path.exists("Dashboard.png"):
        s3.shapes.add_picture("Dashboard.png", Inches(7.2), Inches(1.35), width=Inches(5.5))
        c3 = s3.shapes.add_textbox(Inches(7.2), Inches(5.75), Inches(5.5), Inches(0.8))
        tf_c3 = c3.text_frame
        tf_c3.word_wrap = True
        p_c3 = tf_c3.paragraphs[0]
        p_c3.alignment = PP_ALIGN.CENTER
        run_c3 = p_c3.add_run()
        run_c3.text = "Operational Studio Canvas: Multi-Sensor Layers, Swipe Comparison & Natural Language Bar"
        run_c3.font.size = Pt(9.5)
        run_c3.font.bold = True
        run_c3.font.color.rgb = CYAN_ACCENT

    # =========================================================================
    # SLIDE 4: FEASIBILITY AND VIABILITY
    # =========================================================================
    print("Formatting Slide 4...")
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

    # Left content box
    box4 = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(1.35), Inches(6.6), Inches(5.35))
    box4.fill.solid()
    box4.fill.fore_color.rgb = CARD_BG
    box4.line.color.rgb = BORDER_COLOR
    box4.line.width = Pt(1)
    
    tf4 = box4.text_frame
    tf4.word_wrap = True
    tf4.margin_left = Inches(0.2)
    tf4.margin_right = Inches(0.2)
    tf4.margin_top = Inches(0.15)
    tf4.margin_bottom = Inches(0.15)

    p4_0 = tf4.paragraphs[0]
    p4_0.text = "1. Technical Feasibility & Execution Soundness"
    p4_0.font.bold = True
    p4_0.font.size = Pt(11.5)
    p4_0.font.color.rgb = DARK_BLUE
    p4_0.space_after = Pt(2)

    add_bullet(tf4, "Open Foundation Models", "Built on validated open backbones (RemoteCLIP, MobileSAM, ChangeFormer) avoiding costly training from scratch.")
    add_bullet(tf4, "Edge & Laptop Optimized", "4-bit quantization and ONNX/MPS acceleration enable sub-100ms inference on consumer laptops.")
    add_bullet(tf4, "Offline Hackathon Mode", "Local pre-cached benchmark scenes (GIFT City, Assam Floods, Mumbai Port) run with zero latency without Wi-Fi.")

    add_section_header(tf4, "2. Potential Challenges, Risks & Mitigation Strategies", DARK_BLUE, 11.5)
    add_bullet(tf4, "Risk 1 (Monsoon Cloud Cover)", "Mitigation: Sentinel-1 C-SAR radar channel penetrates cloud cover 24/7 for guaranteed all-weather vision.", HIGHLIGHT_GREEN)
    add_bullet(tf4, "Risk 2 (Optical/SAR Misalignment)", "Mitigation: Automated phase-correlation sub-pixel co-registration verification before model execution.", HIGHLIGHT_GREEN)
    add_bullet(tf4, "Risk 3 (AI Hallucinations)", "Mitigation: Mandatory confidence calibration engine + auditable execution telemetry logging.", HIGHLIGHT_GREEN)
    add_bullet(tf4, "Risk 4 (Gigabyte GeoTIFF OOM)", "Mitigation: Windowed rasterio block reads stream large rasters with strictly bounded memory footprint.", HIGHLIGHT_GREEN)

    add_section_header(tf4, "3. Operational Viability & Zero Cost Barrier", DARK_BLUE, 11.5)
    add_bullet(tf4, "$0 Recurring Cloud Bills", "Self-hosted pipeline requires no OpenAI/Claude tokens or costly third-party API subscriptions.")
    add_bullet(tf4, "Interoperable Geospatial Standards", "Directly exports standard GeoJSON & COGs loadable into QGIS, ArcGIS & ISRO Bhuvan.")

    # Right Image: breafing-download.png
    if os.path.exists("breafing-download.png"):
        s4.shapes.add_picture("breafing-download.png", Inches(7.4), Inches(1.35), width=Inches(5.3))
        c4 = s4.shapes.add_textbox(Inches(7.4), Inches(5.75), Inches(5.3), Inches(0.8))
        tf_c4 = c4.text_frame
        tf_c4.word_wrap = True
        p_c4 = tf_c4.paragraphs[0]
        p_c4.alignment = PP_ALIGN.CENTER
        run_c4 = p_c4.add_run()
        run_c4.text = "Verifiable Intelligence: Tactical Mission Briefing, 96.8% Confidence, & One-Click PDF/GeoJSON Export"
        run_c4.font.size = Pt(9.5)
        run_c4.font.bold = True
        run_c4.font.color.rgb = CYAN_ACCENT

    # =========================================================================
    # SLIDE 5: IMPACT AND BENEFITS
    # =========================================================================
    print("Formatting Slide 5...")
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

    # 3 Pillar Cards
    cards_data = [
        ("🛰️ ISRO / SAC Stakeholders", 
         "Direct Conversational Exploitation", 
         ["Enables non-GIS scientists to query sovereign Cartosat & RISAT satellite catalogs in natural English.",
          "Eliminates hours of manual GIS preprocessing & parameter tuning.",
          "Standardized auditable execution traces for mission-critical validation."]),
        ("🌊 Disaster Response (NDRF/SDMA)", 
         "Rapid Flood & Cyclone Inundation", 
         ["Penetrates 100% cloud cover using Sentinel-1 / RISAT SAR microwave radar.",
          "Delivers instant submersion boundaries & road obstruction masks during active cyclones.",
          "Cuts response briefing time from 24-48 hours down to under 5 seconds."]),
        ("🏛️ Governance & Forestry", 
         "Urban Planning & Deforestation", 
         ["Automated bi-temporal change detection highlights unauthorized constructions.",
          "Quantified delta analysis (e.g. +14.2% built-up growth, -3.8 km² forest canopy loss).",
          "Seamless export to state GIS portals & QGIS/ArcGIS environments."])
    ]
    
    col_w = Inches(3.8)
    gap = Inches(0.3)
    start_x = Inches(0.6)
    card_y = Inches(1.35)
    card_h = Inches(3.1)
    
    for i, (title, subtitle, bullets) in enumerate(cards_data):
        x = start_x + i * (col_w + gap)
        card = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, card_y, col_w, card_h)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        card.line.width = Pt(1.5)
        
        tfc = card.text_frame
        tfc.word_wrap = True
        tfc.margin_left = Inches(0.15)
        tfc.margin_right = Inches(0.15)
        tfc.margin_top = Inches(0.15)
        
        p_t = tfc.paragraphs[0]
        p_t.text = title
        p_t.font.bold = True
        p_t.font.size = Pt(12)
        p_t.font.color.rgb = DARK_BLUE
        
        p_sub = tfc.add_paragraph()
        p_sub.text = subtitle
        p_sub.font.bold = True
        p_sub.font.size = Pt(10)
        p_sub.font.color.rgb = CYAN_ACCENT
        p_sub.space_after = Pt(6)
        
        for b in bullets:
            pb = tfc.add_paragraph()
            pb.text = f"• {b}"
            pb.font.size = Pt(9.5)
            pb.font.color.rgb = TEXT_DARK
            pb.space_after = Pt(3)

    # Bottom Banner
    banner = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(4.7), Inches(12.0), Inches(1.9))
    banner.fill.solid()
    banner.fill.fore_color.rgb = DARK_BLUE
    banner.line.color.rgb = CYAN_ACCENT
    banner.line.width = Pt(1.5)
    
    tfb = banner.text_frame
    tfb.word_wrap = True
    tfb.margin_left = Inches(0.25)
    tfb.margin_right = Inches(0.25)
    tfb.margin_top = Inches(0.15)
    
    p_bt = tfb.paragraphs[0]
    p_bt.text = "KEY QUANTITATIVE IMPACT & NATIONAL ALIGNMENT"
    p_bt.font.bold = True
    p_bt.font.size = Pt(11.5)
    p_bt.font.color.rgb = CYAN_ACCENT
    p_bt.space_after = Pt(4)
    
    metrics = [
        ("⚡ 90% Faster Turnaround: ", "Reduces manual GIS query workflows from hours to <5 seconds through conversational vision routing."),
        ("🌧️ 100% All-Weather Coverage: ", "Completely overcomes cloud-cover blackouts by fusing SAR radar with optical multispectral data."),
        ("🎯 Zero Hallucinations: ", "Delivers auditable, evidence-grounded answers with calibrated confidence & GeoJSON coordinates."),
        ("🇮🇳 National Alignment: ", "Directly supports IN-SPACe deregulation & National Geospatial Policy 2022 democratizing EO data.")
    ]
    for label, desc in metrics:
        p_m = tfb.add_paragraph()
        p_m.space_after = Pt(2.5)
        r1 = p_m.add_run()
        r1.text = label
        r1.font.bold = True
        r1.font.size = Pt(10)
        r1.font.color.rgb = RGBColor(255, 215, 0)
        r2 = p_m.add_run()
        r2.text = desc
        r2.font.bold = False
        r2.font.size = Pt(10)
        r2.font.color.rgb = RGBColor(240, 245, 255)

    # =========================================================================
    # SLIDE 6: RESEARCH AND REFERENCES
    # =========================================================================
    print("Formatting Slide 6...")
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

    # Left Box
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

    # Right Box
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
    print("Deleting Slide 7...")
    rId = prs.slides._sldIdLst[6].rId
    prs.part.drop_rel(rId)
    del prs.slides._sldIdLst[6]
    
    prs.save(output_file)
    print(f"SUCCESS: Generated {output_file} with {len(prs.slides)} slides!")

if __name__ == "__main__":
    build_presentation()
