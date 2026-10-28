# Labelling guidelines: SatQuery routing decisions

Schema version **1.0**. The machine-checkable version of this document is
[`ml/router_ft/schema.py`](../../ml/router_ft/schema.py). If the two disagree, the code
is the bug report: fix whichever is wrong, bump the version and log it in
[LOG.md](LOG.md).

Labels come from **this document only**. Never look at what the regex
`AgentRouter` outputs while labelling. If you do, the model learns to copy the
baseline, and the comparison becomes meaningless.

The example tables below are generated from
[`data/router_ft/guideline_examples.jsonl`](../../data/router_ft/guideline_examples.jsonl)
by `ml/router_ft/render_guidelines.py`. Edit the JSONL, not the tables.

---

## 1. The task

**Input:** one user query (free text, any spelling, English or Hinglish) plus two
boolean context hints from the UI.

**Output:** one JSON object, the routing decision:

```json
{
  "intent": "bitemporal_change",
  "secondary_intents": ["visual_grounding"],
  "entities": ["runway"],
  "temporal": "Pre-Event -> Post-Event",
  "cloud_piercing_required": false
}
```

Exactly these five keys, nothing else.

### What the backend actually uses today

`EvidenceBuilder` reads only `intent` (and `modality`) from the router's plan.
`entities`, `temporal`, `cloud_piercing_required` and the secondary intents are
computed by `AgentRouter.plan_execution()` and then discarded. They never reach
the API response. So:

- **`intent` is the field that changes system behaviour.** It is the headline
  metric.
- The other four fields measure plan quality. We label them because they are
  the router's contract and a later change could surface them, but no
  write-up should claim that improving them improves the product today.

## 2. Fields

| Field | Type | Allowed values | Rule |
|---|---|---|---|
| `intent` | string | `bitemporal_change`, `crossmodal_fusion`, `sar_vqa`, `visual_grounding`, `scene_captioning`, `optical_vqa` | Exactly one. See §3 and §4. |
| `secondary_intents` | list | subset of `crossmodal_fusion`, `visual_grounding`, `scene_captioning` | Other outputs the query also asks for. Never repeats `intent`. Empty list if none. |
| `entities` | list | subset of `runway`, `launchpad`, `building`, `maritime`, `flood`, `excavation`, `vegetation` | Categories of physical features mentioned. See §7. |
| `temporal` | string or `null` | `"<endpoint> -> <endpoint>"` | See §8. |
| `cloud_piercing_required` | bool | `true` / `false` | See §5. |

Lists are stored in the canonical order shown in the "Allowed values" column. Order
never affects scoring, because lists are scored as sets.

**Why secondaries are limited to three values:** those are the only three that
`plan_execution()` can consume as secondaries. A label it cannot act on would
be noise.

## 3. Intents

Ask: **what output does the user want, and what data does producing it need?**

| Intent | The user wants | Needs |
|---|---|---|
| `bitemporal_change` | A comparison of the same place at two times: change, growth, new construction, demolition, clearing, "more/fewer than before". | Two optical images (T1, T2). |
| `crossmodal_fusion` | To see through clouds, haze, smoke or fog, or an explicit optical+SAR fusion. | Optical + SAR. |
| `sar_vqa` | An answer about radar data or radar properties: backscatter, polarisation, roughness, radar targets. | SAR. |
| `visual_grounding` | Specific things located on the image: highlight, outline, box, mark, "show me where". | One optical image + localisation. |
| `scene_captioning` | A description or summary of the **whole** scene, or a land-cover breakdown. | One optical image. |
| `optical_vqa` | A specific question about one optical image: count, presence, yes/no, an attribute. **The default.** | One optical image. |

Rules of thumb:

- A word is not an intent. "Change the colour scheme" is not change detection,
  "draw conclusions" is not grounding, and "cloud storage" is not weather.
- **Change needs two times.** "New", "damaged" or "has burst" on their own describe
  one image. "Than usual" compares with a norm, not with a second image. Neither
  is `bitemporal_change`.
- **Describe the scene vs describe a thing.** A description of the whole scene is
  `scene_captioning`. Describing one object's condition is `optical_vqa`.
- **"Show me" is not grounding** unless it asks *where* (locate, mark, outline,
  highlight, box).
- If a request is unsupported (for example, "make a 3D model"), label the closest
  supported thing it asks for. If nothing fits, use `optical_vqa` and note it.

### bitemporal_change

<!-- BEGIN examples:bitemporal_change -->
| Kind | Query | Hints | Label | Why |
|---|---|---|---|---|
| clear | Show me what changed at the port between January 2023 and March 2024 | default | `{"intent": "bitemporal_change", "secondary_intents": [], "entities": ["maritime"], "temporal": "January 2023 -> March 2024", "cloud_piercing_required": false}` | Explicit comparison of two named times at one place. |
| clear | Has any forest been cleared near the reservoir since 2020? | default | `{"intent": "bitemporal_change", "secondary_intents": [], "entities": ["flood", "vegetation"], "temporal": "2020 -> Now", "cloud_piercing_required": false}` | 'Cleared ... since 2020' asks about change over time; reservoir is a mentioned water feature. |
| clear | Compare the before and after images of the runway extension | default | `{"intent": "bitemporal_change", "secondary_intents": [], "entities": ["runway"], "temporal": "Pre-Event -> Post-Event", "cloud_piercing_required": false}` | 'Before and after' images are a bitemporal pair. |
| borderline | Is the new hangar visible in this image? | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["runway"], "temporal": null, "cloud_piercing_required": false}` | 'New' describes the hangar, but the question is about one image. No second time is asked for. |
| borderline | Are there more ships docked now than in the previous image? | default | `{"intent": "bitemporal_change", "secondary_intents": [], "entities": ["maritime"], "temporal": "Epoch T1 -> Epoch T2", "cloud_piercing_required": false}` | Compares now with an earlier image: a change question without the word 'change'. |
<!-- END -->

### crossmodal_fusion

<!-- BEGIN examples:crossmodal_fusion -->
| Kind | Query | Hints | Label | Why |
|---|---|---|---|---|
| clear | It's overcast over the coast, use radar to check whether the oil tanker is still at anchor | default | `{"intent": "crossmodal_fusion", "secondary_intents": [], "entities": ["maritime"], "temporal": null, "cloud_piercing_required": true}` | Cloud obstruction is stated and radar is requested to see through it. |
| clear | Fuse the optical and SAR scenes to map the flooded fields | default | `{"intent": "crossmodal_fusion", "secondary_intents": [], "entities": ["flood", "vegetation"], "temporal": null, "cloud_piercing_required": false}` | Explicit fusion request. No obstruction is stated, so cloud piercing is false. |
| clear | Monsoon cloud cover is hiding the launch pad; what can you see beneath it? | default | `{"intent": "crossmodal_fusion", "secondary_intents": [], "entities": ["launchpad"], "temporal": null, "cloud_piercing_required": true}` | Cloud hides the target; seeing beneath it needs SAR. 'Monsoon' here is weather, not a time. |
| borderline | Clear sky this morning. How many buildings are on the campus? | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["building"], "temporal": null, "cloud_piercing_required": false}` | Weather is mentioned only to say it is clear. Nothing needs piercing. |
| borderline | Save this to cloud storage and give me an overview of the scene | default | `{"intent": "scene_captioning", "secondary_intents": [], "entities": [], "temporal": null, "cloud_piercing_required": false}` | 'Cloud' means storage, not weather. The real request is a scene overview. |
<!-- END -->

### sar_vqa

<!-- BEGIN examples:sar_vqa -->
| Kind | Query | Hints | Label | Why |
|---|---|---|---|---|
| clear | What does the VH backscatter tell us about the paddy fields? | default | `{"intent": "sar_vqa", "secondary_intents": [], "entities": ["vegetation"], "temporal": null, "cloud_piercing_required": false}` | A question about a radar property (VH backscatter). |
| clear | How many bright point targets in the radar image could be vessels? | default | `{"intent": "sar_vqa", "secondary_intents": [], "entities": ["maritime"], "temporal": null, "cloud_piercing_required": false}` | Asks about targets in the radar image specifically. |
| clear | Is the ground around the trench rough or smooth in the SAR data? | default | `{"intent": "sar_vqa", "secondary_intents": [], "entities": ["excavation"], "temporal": null, "cloud_piercing_required": false}` | Surface roughness from SAR is a radar property. |
| borderline | Using radar, outline the flooded villages | default | `{"intent": "sar_vqa", "secondary_intents": ["visual_grounding"], "entities": ["building", "flood"], "temporal": null, "cloud_piercing_required": false}` | Radar question plus a localisation request: sar_vqa outranks visual_grounding as primary. |
| borderline | Radar or optical, which is better for spotting the trenches through this haze? | default | `{"intent": "crossmodal_fusion", "secondary_intents": [], "entities": ["excavation"], "temporal": null, "cloud_piercing_required": true}` | Asks about seeing through haze, so the answer needs fusion; cloud piercing is true. |
<!-- END -->

### visual_grounding

<!-- BEGIN examples:visual_grounding -->
| Kind | Query | Hints | Label | Why |
|---|---|---|---|---|
| clear | Draw bounding boxes around every aircraft on the apron | default | `{"intent": "visual_grounding", "secondary_intents": [], "entities": ["runway"], "temporal": null, "cloud_piercing_required": false}` | Bounding boxes are a localisation output. Aircraft and apron fall under the runway category. |
| clear | Highlight the propellant tanks next to the second launch pad | default | `{"intent": "visual_grounding", "secondary_intents": [], "entities": ["launchpad"], "temporal": null, "cloud_piercing_required": false}` | 'Highlight' asks to mark specific objects on the image. |
| clear | Where exactly is the spoil pile? Mark it on the map | default | `{"intent": "visual_grounding", "secondary_intents": [], "entities": ["excavation"], "temporal": null, "cloud_piercing_required": false}` | 'Mark it on the map' is a localisation request. |
| borderline | Draw conclusions about how healthy the vegetation in this field is | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["vegetation"], "temporal": null, "cloud_piercing_required": false}` | 'Draw conclusions' is not drawing on the image. It is a question about one image. |
| borderline | Find where the river has burst its banks | default | `{"intent": "visual_grounding", "secondary_intents": [], "entities": ["flood"], "temporal": null, "cloud_piercing_required": false}` | Past-tense event, but no second time is requested. The ask is to locate it. |
<!-- END -->

### scene_captioning

<!-- BEGIN examples:scene_captioning -->
| Kind | Query | Hints | Label | Why |
|---|---|---|---|---|
| clear | Give me a short description of this scene | default | `{"intent": "scene_captioning", "secondary_intents": [], "entities": [], "temporal": null, "cloud_piercing_required": false}` | Asks for a description of the whole scene. |
| clear | Summarise the land-cover breakdown of the area around the reservoir | default | `{"intent": "scene_captioning", "secondary_intents": [], "entities": ["flood"], "temporal": null, "cloud_piercing_required": false}` | Land-cover breakdown is a scene-level summary. |
| clear | What's in this image? I just want a general overview | default | `{"intent": "scene_captioning", "secondary_intents": [], "entities": [], "temporal": null, "cloud_piercing_required": false}` | General overview with no specific question. |
| borderline | Describe the condition of the runway surface | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["runway"], "temporal": null, "cloud_piercing_required": false}` | Describes one object's attribute, not the whole scene, so it is a question (optical_vqa). |
| borderline | Describe the scene and highlight any construction work | default | `{"intent": "visual_grounding", "secondary_intents": ["scene_captioning"], "entities": ["building"], "temporal": null, "cloud_piercing_required": false}` | Two outputs: grounding outranks captioning, so captioning becomes the secondary. |
<!-- END -->

### optical_vqa

<!-- BEGIN examples:optical_vqa -->
| Kind | Query | Hints | Label | Why |
|---|---|---|---|---|
| clear | How many tankers are moored at the jetty? | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["maritime"], "temporal": null, "cloud_piercing_required": false}` | Counting objects in one optical image. |
| clear | Is the perimeter fence intact on the north side? | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["excavation"], "temporal": null, "cloud_piercing_required": false}` | Yes/no question about one object in one image. |
| clear | What crop is growing in the fields east of the campus? | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["building", "vegetation"], "temporal": null, "cloud_piercing_required": false}` | Attribute question in one image. Fields go to vegetation; campus goes to building. |
| borderline | Is the water level in the reservoir lower than usual? | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["flood"], "temporal": null, "cloud_piercing_required": false}` | 'Than usual' compares with a norm, not with a second image, so it is not change. |
| borderline | kya is image mein koi ship dikh raha hai? | default | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["maritime"], "temporal": null, "cloud_piercing_required": false}` | Hinglish: 'is there any ship visible in this image?'. |
<!-- END -->

"Hints = default" means `has_bitemporal_pair=false, has_sar_pair=true`. That is
what the API sends when the UI is in its default mode (see §6).

## 4. Compound queries

When a query asks for more than one output:

1. **Primary intent:** take the first match in this precedence order:

   `bitemporal_change` > `crossmodal_fusion` > `sar_vqa` > `visual_grounding` > `scene_captioning` > `optical_vqa`

   The order puts the most data-hungry analysis first, because the primary
   decides which inputs the pipeline loads.
2. **Secondaries:** every other *requested* output that is one of
   `crossmodal_fusion`, `visual_grounding` or `scene_captioning`.
3. Anything else the query asks for (a second `optical_vqa` question, a
   `sar_vqa` side question) cannot be represented and is dropped. This is a
   known limitation of the router's contract, not a labelling choice.

**This differs from the regex on purpose.** The regex checks cross-modal before
change, so "what changed under the clouds?" becomes `crossmodal_fusion`. Under
these guidelines, change is the question and the clouds are the obstacle, so the
label is `bitemporal_change` + secondary `crossmodal_fusion` + cloud piercing.

<!-- BEGIN examples:compound -->
| Kind | Query | Hints | Label | Why |
|---|---|---|---|---|
| clear | What changed under the clouds at the airfield since last year? | default | `{"intent": "bitemporal_change", "secondary_intents": ["crossmodal_fusion"], "entities": ["runway"], "temporal": "1 Year Ago -> Now", "cloud_piercing_required": true}` | Change is the question; clouds are the obstacle. Fusion is secondary and cloud piercing is true. |
| clear | Outline the new buildings that went up between 2019 and 2023 | default | `{"intent": "bitemporal_change", "secondary_intents": ["visual_grounding"], "entities": ["building"], "temporal": "2019 -> 2023", "cloud_piercing_required": false}` | Change is primary; 'outline' adds visual_grounding as a secondary. |
| clear | Smoke from the refinery fire is drifting over the jetty; outline any vessels you can find | default | `{"intent": "crossmodal_fusion", "secondary_intents": ["visual_grounding"], "entities": ["maritime"], "temporal": null, "cloud_piercing_required": true}` | Smoke obstructs the view (fusion is primary); 'outline' adds grounding. |
| clear | Count the ships and give me an overview of the harbour | default | `{"intent": "scene_captioning", "secondary_intents": [], "entities": ["maritime"], "temporal": null, "cloud_piercing_required": false}` | Captioning outranks optical_vqa. The counting part cannot be a secondary and is dropped (known limitation). |
<!-- END -->

## 5. `cloud_piercing_required`

`true` only when the query says, or clearly implies, that the optical view of the
target **is or will be blocked by the atmosphere** (cloud, haze, smoke, fog,
monsoon cover) and asks for an answer anyway.

- Negated or cleared weather is `false`: "no clouds today", "clear sky".
- A non-weather sense of "cloud" is `false`: cloud storage, point cloud, "upload to the cloud".
- An explicit fusion request with no obstruction is `crossmodal_fusion` with
  `false`. The flag is about obstruction, not about which sensor is used.
- **Coupling rule:** if the flag is `true` and the primary is not
  `crossmodal_fusion`, then `crossmodal_fusion` must be in `secondary_intents`.
  `schema.validate` enforces this.

(The regex sets the flag whenever any weather word or "fusion" appears. That is
one of the behaviours this project measures.)

## 6. Context hints

Hints come from the UI's modality selector (`routes_query.py`, `query_service.py`):

| UI modality | `has_bitemporal_pair` | `has_sar_pair` |
|---|---|---|
| `bitemporal` | true | false |
| `cross_modal` (**the API and frontend default**) | false | true |
| `single_image` | false | false |

Rules:

- **`has_bitemporal_pair = true` ⇒ `intent = bitemporal_change`.** The user has
  chosen the change mode and the backend will run the change pipeline. Whatever
  else the text asks for becomes secondaries under §4. Entities, temporal and
  cloud are still labelled from the text. This keeps the existing contract.
- **`has_sar_pair` never changes the label.** It is true for most real
  traffic simply because `cross_modal` is the default mode. Treating it as
  "the user wants SAR" would route almost every query to fusion. In
  `classify_intent` today it has no effect either.
- Both true: `has_bitemporal_pair` wins.

Because `has_sar_pair=true` is the production default, the dataset should use it
for most rows. Otherwise the model sees a hint distribution it will never meet
in production.

<!-- BEGIN examples:hints -->
| Kind | Query | Hints | Label | Why |
|---|---|---|---|---|
| clear | Give me a short description of the scene | has_bitemporal_pair=true, has_sar_pair=false | `{"intent": "bitemporal_change", "secondary_intents": ["scene_captioning"], "entities": [], "temporal": null, "cloud_piercing_required": false}` | Bitemporal pair loaded: primary is change; the text's request becomes the secondary. |
| clear | How many ships are at anchor? | has_bitemporal_pair=true, has_sar_pair=false | `{"intent": "bitemporal_change", "secondary_intents": [], "entities": ["maritime"], "temporal": null, "cloud_piercing_required": false}` | Bitemporal pair loaded: primary is change even for a counting question. |
| clear | What is the backscatter like over the fields? | has_bitemporal_pair=true, has_sar_pair=false | `{"intent": "bitemporal_change", "secondary_intents": [], "entities": ["vegetation"], "temporal": null, "cloud_piercing_required": false}` | Bitemporal pair loaded: the hint overrides a radar question too. |
| clear | How many ships are at anchor? | has_bitemporal_pair=false, has_sar_pair=false | `{"intent": "optical_vqa", "secondary_intents": [], "entities": ["maritime"], "temporal": null, "cloud_piercing_required": false}` | No SAR pair: the label is the same as with one. has_sar_pair never changes the label. |
| clear | Outline the flooded area | has_bitemporal_pair=true, has_sar_pair=true | `{"intent": "bitemporal_change", "secondary_intents": ["visual_grounding"], "entities": ["flood"], "temporal": null, "cloud_piercing_required": false}` | Both hints: has_bitemporal_pair wins. |
<!-- END -->

## 7. `entities`

List every category whose physical features are **mentioned as being in the
scene**, whether as the target or as a landmark ("the forest near the
reservoir" gives `flood` and `vegetation`). Do not list a category the query
excludes ("ignore the ships") or uses only in a non-physical sense.

The mention rule is used instead of "is it the target?" because two people
agree on it more often.

| Category | Covers (the `ENTITY_MAP` terms plus obvious synonyms) |
|---|---|
| `runway` | runway, tarmac, airstrip, taxiway, hangar, apron, airfield, airport, aircraft |
| `launchpad` | launch pad, launch complex, FLP/SLP, propellant tank, umbilical tower, rocket |
| `building` | building(s), facility, structures, footprint, infrastructure, campus, houses, villages, construction |
| `maritime` | vessel, ship, tanker, boat, convoy, port, harbour, jetty, anchorage |
| `flood` | flood/flooding, inundation, and **any inland water**: river, lake, reservoir, canal, water body, riverbank |
| `excavation` | excavation, trench, shaft, spoil pile, perimeter fence, earthworks |
| `vegetation` | vegetation, canopy, forest, trees, agriculture, crops, paddy, fields, clearing |

Generic references ("everything", "all objects", "the area") give `[]`. The
category name `flood` is inherited from `ENTITY_MAP`. It really means water.

## 8. `temporal`

`null`, or exactly `"<start> -> <end>"` (spaces around the arrow). Each endpoint is
one of:

| Endpoint form | Examples |
|---|---|
| Named | `Pre-Event`, `Post-Event`, `Epoch T1`, `Epoch T2`, `Now`, `Monsoon` |
| Year | `2024` |
| Month, optional year | `March`, `March 2024` (full month name, capitalised) |
| Full date | `2024-03-15` |
| Relative | `1 Day Ago`, `2 Weeks Ago`, `6 Months Ago`, `1 Year Ago` (singular only for 1) |

Normalisation table:

| Query says | `temporal` |
|---|---|
| between March and June | `March -> June` |
| from 2019 to 2023 | `2019 -> 2023` |
| since March / since 2020 | `March -> Now` / `2020 -> Now` |
| over the last six months / in the past year | `6 Months Ago -> Now` / `1 Year Ago -> Now` |
| last year vs now; since last year | `1 Year Ago -> Now` |
| Mar '24 to 15 Jan 2025 | `March 2024 -> 2025-01-15` |
| before and after (the cyclone, the event, …) | `Pre-Event -> Post-Event` |
| T1 vs T2; the previous image vs this one | `Epoch T1 -> Epoch T2` |
| since the monsoon | `Monsoon -> Now` |
| pre-monsoon vs post-monsoon | `Pre-Event -> Post-Event` |

Rules:

- `temporal` describes a **period or comparison** stated in the text. A single
  point with no comparison ("the image from June") is `null`. So is a change
  question with no stated time ("has the runway got longer?").
- Label it from the text even when the intent is not `bitemporal_change`.
- A hint never creates a temporal value.
- "Monsoon" as weather ("monsoon clouds hide the pad") is not a time.

When scoring, the eval mechanically maps the regex router's own formats
("Between March And June" becomes "March -> June") before comparing, so the
baseline is judged on understanding, not formatting. That mapping is in the
regex adapter, not in this grammar.

## 9. Slice tags

Every labelled row carries one or more slice tags, so results can be broken down
by difficulty. A row may have several tags (`compound` + `typo_hinglish`).

| Tag | Meaning |
|---|---|
| `clean` | Plain English that uses the obvious keywords. |
| `paraphrase` | The right intent without its usual keywords ("did the airstrip get longer"). |
| `negation` | Negates or excludes a feature or condition ("no clouds", "ignore the ships"). |
| `typo_hinglish` | Spelling mistakes, shorthand, or Hindi/English code-mixing. |
| `compound` | Asks for more than one output. |
| `hint_driven` | The hint changes the label from what the text alone gives. |
| `keyword_trap` | Contains a routing keyword in the wrong sense ("change the colours", "cloud storage", "draw conclusions"). |

`keyword_trap` is an addition to the original six slices. Keyword traps are the
regex's most predictable failure, and without their own tag they would be
spread thinly across the other slices.

## 10. Row format and workflow

Every dataset file (`train.jsonl`, `val.jsonl`, `test.jsonl`) has one JSON object
per line:

```json
{"id": "test-0001", "query": "...", "hints": {"has_bitemporal_pair": false, "has_sar_pair": true},
 "label": { ...five fields... }, "slices": ["paraphrase"], "notes": ""}
```

- Use `notes` to record why a hard case got its label. It feeds error analysis.
- If you are unsure, decide by these rules, write `"notes": "unsure: <reason>"`,
  and keep going. A pile of "unsure" notes on the same issue means the
  guidelines need fixing, not more guessing.
- **Do not reuse or lightly paraphrase** the examples in this document, or the
  probe queries in [PROBES.md](PROBES.md), in the test set. Both are seen by
  the generator and in prompt design. The leakage check in Phase 2 compares
  test against them too.

## 11. Open questions

- The `has_bitemporal_pair` override follows the existing contract, but it can
  produce odd labels (a radar question in change mode becomes
  `bitemporal_change`). Revisit if the pipeline gains a better behaviour.
- Requests the schema cannot represent (§4.3) are dropped. If they turn out to
  be common in the test set, report the rate; that is a finding about the
  router's contract.
