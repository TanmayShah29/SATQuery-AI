# Official Problem Statement: SIH26167

**Problem Statement ID:** 26167  
**Problem Statement Title:** SatQuery AI - An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries  
**Organization:** Indian Space Research Organisation (ISRO)  
**Department:** Department of Space / Indian Space Research Organisation (ISRO) — Space Applications Centre (SAC)  
**Category:** Software  
**Theme:** Space Technology  
**National Submissions Cap:** 1 / 500  
**Submission Deadline:** 30 September 2026  

---

## 1. Background

Remote-sensing imagery is widely used for agricultural monitoring, disaster management, urban planning, forest monitoring, water-resource assessment, infrastructure mapping, and environmental analysis. However, most existing remote-sensing AI solutions are developed as isolated applications for a single predefined task, such as land-cover classification, object detection, visual question answering, or change detection. These systems often require users to understand satellite-data characteristics, GIS workflows, model selection, and task-specific parameters. Consequently, non-expert users may find it difficult to obtain meaningful information from satellite imagery through simple natural-language queries.

Many operational remote-sensing questions cannot always be answered reliably using a single optical image. Relevant information may be distributed across paired or multiple observations acquired at different times or by different sensors:
* **Optical and Multispectral Imagery:** Provides spectral and contextual information.
* **Synthetic Aperture Radar (SAR):** Provides complementary structural information and supports day-and-night acquisition through cloud cover.
* **Multitemporal Image Pairs:** Required to identify and interpret changes over time.
* **Co-registered Optical–SAR Pairs:** Provide more complete and reliable information than either modality alone.

A general-purpose large language model (LLM) or vision-language model (VLM) cannot be expected to perform these specialised tasks reliably without adaptation to remote-sensing imagery, sensor characteristics, and domain-specific terminology. The proposed solution must therefore include remote-sensing fine-tuning or domain adaptation and may employ multiple specialised models for different tasks.

* **BigEarthNet.txt:** Serves as the primary dataset for adapting image–text representations to multisensor remote-sensing data.
* **VRSBench & RSVQA:** Used to evaluate single-image captioning, grounding, and visual question answering.
* **CDVQA:** Used to evaluate multitemporal change-based visual question answering.

The novelty of SatQuery AI lies in its agentic, query-driven framework. Instead of applying a single generic VLM, the system selects and executes suitable remote-sensing specialist models, validates inputs, combines their outputs, and returns an evidence-grounded response.

---

## 2. Problem Description & Objective

The objective is to develop **SatQuery AI**, a software-based agentic vision-language assistant for analysing single and paired remote-sensing images through natural-language queries. Single-image understanding is a mandatory baseline, while the principal focus is joint reasoning over paired cross-modal and multitemporal imagery.

---

## 3. Defined Input Scope

* **Single Image:** One optical/multispectral or SAR image for captioning, visual question answering (VQA), and text-guided region grounding.
* **Cross-Modal Pair:** Co-registered optical/multispectral and SAR images of the same geographic area for joint information extraction and cross-modal analysis.
* **Bi-Temporal Pair:** Two spatially corresponding images of the same geographic area acquired at different times for change detection, change description, and change-based visual question answering.
* **Supported File Formats:**
  * Primary / Geospatial: **GeoTIFF** or **TIFF**.
  * Benchmark Formats: **PNG** and **JPEG** inputs may be accepted only for the prescribed public benchmark datasets.

---

## 4. Mandatory Functional Scope

1. **Remote-Sensing Adaptation:** At least one visual or vision-language component must be fine-tuned or otherwise adapted using `BigEarthNet.txt` or approved open-source training data.
2. **Single-Image Baseline:** Visual question answering (VQA) is mandatory. Each solution must additionally implement either captioning/scene description or text-guided region grounding.
3. **Multi-Image Change Analysis:** Change description or change-based visual question answering from a bi-temporal image pair is mandatory. A spatial change map may also be generated where reference masks are available.
4. **Cross-Modal Pair Analysis:** The system must extract complementary information from a co-registered optical/multispectral and SAR image pair.
5. **Agentic Orchestration:** The system must automatically select, sequence, and execute the appropriate specialist models or tools according to the query and input configuration.

---

## 5. Representative Benchmark Queries

* *"Describe the land-cover and major objects visible in this image."*
* *"Highlight the water body referred to in the query."*
* *"What changed between these two dates, and where did the change occur?"*
* *"Use the optical and SAR images together to identify built-up and water-covered regions."*
* *"Has the built-up area increased, decreased, or remained unchanged?"*

---

## 6. Agentic Model and Tool Orchestration Requirements

The system may use multiple specialised components, such as a remote-sensing VQA or captioning model, a grounding model, a change-understanding or change-VQA model, and an optical–SAR fusion or information-extraction model.

### Controller Capabilities:
* Interpret the natural-language query and classify the requested task.
* Check the number, modality, format, metadata, and compatibility of the input images.
* Select one or more models or tools from a predefined registry.
* Configure only permitted task parameters and execute the selected workflow.
* Combine textual and spatial outputs, estimate confidence, and return visual evidence.
* Provide an **auditable execution summary** containing the selected task, model/tool names, and key parameters.

> **Evaluation Rule:** The controller may perform internal task planning; however, only the observable execution trace, including the selected task, models or tools, permitted parameters, and outputs will be evaluated. Internal reasoning text is neither required nor evaluated.

---

## 7. Expected Solution & Deliverables

* **Interactive GUI / Web Application:** With an agentic remote-sensing AI backend that accepts supported image inputs and natural-language queries, selects the appropriate specialist workflow, and returns evidence-grounded textual and visual results.
* **Component Architecture:**
  1. Input upload and compatibility checking engine (GeoTIFF / TIFF metadata validator).
  2. Remote-sensing-adapted vision-language component.
  3. Specialist tools for VQA, captioning/grounding, change understanding, and optical–SAR analysis.
  4. Agentic controller for task routing, tool execution, and output integration.
  5. Visual evidence display, confidence scores, execution summaries, and downloadable reports.
* **Deliverables:** Interactive GUI/Web application, complete source code, trained/adapted model weights, test suite, and live demonstration script.
* **Strict Disqualification Rule:** A generic LLM or VLM without remote-sensing adaptation will not satisfy the requirements.

---

## 8. Prescribed Datasets & Evaluation Criteria

### Training & Fine-Tuning Datasets
* **BigEarthNet.txt:** Primary dataset for remote-sensing adaptation using co-registered Sentinel-1 SAR, Sentinel-2 multispectral imagery, and diverse text annotations.  
  * Reference Link: [https://arxiv.org/abs/2603.29630](https://arxiv.org/abs/2603.29630)
  * All datasets are available online open-source.

### Public Evaluation Benchmarks
* **VRSBench:** High-resolution remote-sensing dataset for visual question answering, captioning, and text-guided visual grounding.
* **RSVQA:** Benchmark dataset for visual question answering on remote-sensing optical imagery.
* **CDVQA:** Multitemporal change-based visual question answering dataset.

### ISRO / SAC Evaluation Set (Held-Out Final Round)
* The final evaluation will use prescribed public benchmark test subsets and an **ISRO/SAC evaluation dataset**.
* The ISRO/SAC evaluation set contains pre-georeferenced and co-registered **Cartosat-2S optical** and **RISAT SAR** image pairs, with task-specific reference answers, labels, bounding boxes, or masks.
* Scores will be normalised across tasks before combining metrics.
