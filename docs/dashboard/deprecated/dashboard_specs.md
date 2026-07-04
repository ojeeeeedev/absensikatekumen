# This file will list all the specs for a new dashboard page for my webapp.

For the concrete Google Sheets tab/header contract used by the current dashboard implementation, see `docs/dashboard/sheet-contract.md`.

1. Adhere to the design guides/CSS files so that the webapp design language stays the same
2. This will be a new page under the route: ./dashboard
3. The dashboard page will be optimized for desktop as it contains multiple data visualization and charts
4. All the data is served from a Google Sheet

Your goal is to create a data-rich interactive dashboard for existing classes. Refer to the /screenshots folder for how the data is served to the frontend.

# Dashboard Specification Blueprint: [Dashboard Title]

**Target Entity/Context:** [Context Scope / Target Group Name]
**System Subtext:** [Secondary Title / Organization Context]
**Temporal Filters:** [Active Year / Cohort / Batch Identifiers]
**System Timestamp:** [Last Updated Dynamic Field]

---

## 1. Document Overview

This technical specification document defines the visual layout, components, and expected metric logic for the Dashboard. It serves as an architectural guide for implementing frontend layouts, data pipes, and validation scripts.

---

## 2. Global Theme & UI Standards

- **Layout Grid:** Asymmetric block structure divided into structural entity metadata (left), high-level calculated health status metrics (center), and transactional log streams/alerts (right).
- **Color System:** Mapped contextually to status metrics (e.g., Safe/Warning/Critical alerts).

---

## 3. Structural Component Breakdowns

### Component A: Master Header & Context Badge

- **Visual Type:** Full-width top viewport row.
- **Logic Placeholders:**
  - `{{MAIN_TITLE}}`: Main structural application title.
  - `{{SUB_TITLE}}`: Organizational or structural sub-context.
  - `{{TIMESTAMP}}`: Dynamic system date/time text representing the last data refresh.
  - `{{CONTEXT_BADGE_LINES}}`: Key-value collection for core parameter scoping (e.g., operational years, cycle names, specific sub-group filters).

### Component B: Entity Demographic Summary Table

- **Visual Type:** Vertical data table split by key baseline operational tags.
- **Logic Placeholders:**
  - `{{TOTAL_COUNT}}`: Total unique active primary keys/entities registered.
  - `{{GENDER_SPLIT_1}}` / `{{GENDER_SPLIT_2}}`: Categorical count splits (e.g., Male/Female counts or relevant identity partitions).
  - `{{DEMOGRAPHIC_ROW_TEMPLATE}}`: Loop for core categorical traits.
    - Columns: `[Category Name]` | `[Count / Integer Value]` | `[Percentage of Total]`
    - _Validation Constraint:_ $\sum \text{Row Counts} == {{TOTAL_COUNT}}$

### Component C: Demographic Distribution Visualization

- **Visual Type:** Donut / Pie Chart matching Component B.
- **Logic Placeholders:**
  - `{{CHART_DATA_ARRAY}}`: Key-value pair array consisting of `[Category String, Float Percentage Value]`. Mapped directly to the database categories defined in Component B.

### Component D: Transactional Status Matrix

- **Visual Type:** Low-priority secondary trait tracking grid.
- **Logic Placeholders:**
  - `{{STATUS_ROW_TEMPLATE}}`: Loop for tracking secondary states (e.g., civil status, operational readiness states).
    - Columns: `[State Name]` | `[Count]` | `[Percentage of Total]`

### Component E: Operational Health Status & Visualization

- **Visual Type:** Balanced multi-row grid accompanied by an integrated donut summary chart.
- **Logic Placeholders:**
  - `{{HEALTH_STATUS_LOOP}}`: Mapped array of system health states, color-coded by operational urgency tiers.
    - Columns: `[Status Tier Identifier]` | `[Entity Count]` | `[Percentage Allocation]`
  - `{{HEALTH_CHART_ARRAY}}`: Data series binding the visual chart sectors to the calculated status tier array values.

### Component F: System Logic Rules Legend

- **Visual Type:** Static or dynamic configuration reference mapping business rules to the metric engine.
- **Logic Placeholders:**
  - `{{RULE_DEFINITION_LOOP}}`: Boundary rules evaluated to group entities into the status tiers shown in Component E.
    - Structure: `[Tier Identifier Badge]` $\rightarrow$ `[Mathematical Evaluation Condition (e.g., Threshold % Boundaries)]`

### Component G: Chronological Event / Transaction Log

- **Visual Type:** Historical tabular ledger showing recent workflow executions, courses, or events.
- **Logic Placeholders:**
  - `{{RECENT_EVENTS_LIMIT_5}}`: Array collection containing the most recent 5 event timestamps or session keys.
    - Columns: `[Event/Topic ID]` | `[Type Classification]` | `[Success/Attendance Ratio (Numerator/Denominator)]` | `[Calculated Rate %]`

### Component H: Exception Filter Log (Targets for Attention)

- **Visual Type:** Automated conditional tracking view displaying records that breach performance safety baselines.
- **Logic Placeholders:**
  - `{{EXCEPTION_FILTER_QUERY}}`: SQL/ORM filtered dataset picking up records where `[Calculated Rate %]` $\le$ `{{ATTENTION_THRESHOLD_LIMIT}}`. Sorted by most critical performance deficit first.
    - Columns: `[Event/Topic ID]` | `[Type Classification]` | `[Success/Attendance Ratio]` | `[Calculated Rate %]`

### Component I: Critical Entity Risk Escalation Roster

- **Visual Type:** Exception table targeting specific items or individuals matching critical status alerts.
- **Logic Placeholders:**
  - `{{RISK_ESCALATION_QUERY}}`: Filter query targeting entities caught in worst-performing status categories (e.g., Red or Black alerts from Component E).
    - Columns: `[Entity Identifier Name/ID]` | `[Assigned Subgroup Lead]` | `[Current Assigned Health Zone]` | `[Historical Performance Metric %]`
  - _Error Handling Catch:_ Wrap in try/catch to ensure database connection or lookup failures handle empty sets gracefully without outputting `#N/A` template calculation faults.

---

## 4. UI Layout Specifications & Structural Matrix

| Ref ID | Element Block Name  | Component Type        | Width Weight      | Target Logic Binding                                    |
| :----- | :------------------ | :-------------------- | :---------------- | :------------------------------------------------------ |
| **A**  | Header Banner       | Metadata Row          | 100% Full Width   | Global parameters, dates, and title strings             |
| **B**  | Entity Summary      | Data Grid Table       | 25% Column Left   | Master entity summary counts and raw categorical data   |
| **C**  | Demographic Chart   | Donut Chart           | 25% Column Left   | Graphical array bindings for visual sector sizing       |
| **D**  | Status Matrix       | Status Table          | 25% Column Left   | Secondary metadata property coverage metrics            |
| **E**  | Health Status Block | Metrics Block + Chart | 40% Column Center | Core health metric segmentation calculations            |
| **F**  | Rule Definitions    | Business Legend       | 40% Column Center | Code definitions and boundary values ($\%$)             |
| **G**  | Chronological Log   | Historical Table      | 35% Column Right  | Recent pipeline execution/session history tracking      |
| **H**  | Exception Filter    | Target Alert Table    | 35% Column Right  | Sub-optimal performance target data queries             |
| **I**  | Risk Escalation     | Roster Grid Table     | 35% Column Right  | Specific high-risk entity profiles needing intervention |

---

## 5. Required System Assertions & Data Integrity Validations

To prevent rendering discrepancies, your data pipelines must satisfy these three logical unit tests before updating the view layer:

1. **Headcount Check:** Validate that sub-category segmentation aggregates match the total record count exactly:
   $$\sum ({{GENDER_SPLIT_1}} + {{GENDER_SPLIT_2}}) == {{TOTAL_COUNT}}$$
2. **Precision Syncing:** Ensure floating-point values generated for chart series scripts are formatted or rounded identically to the text outputs in related data tables.
3. **Null Pointer Prevention:** Database queries for conditional tables (Component I) must return an empty state placeholder row rather than crashing frontend compilation with an unhandled runtime error index.
   Here are the description for the dashboard datas:

All the datas served in the frontend will be logically configured by me and your job is to ask questions for every component and what kind of data/where the data originates from.

# User Interaction:

1. I want user to be able to pick between multiple classes dashboards (same as the current active class list)
2. I want user to input the sheet URL in the future to automatically load the data and visualize it in the dashboard
3. I want user to be able to change data in the dashboard directly. Make the Google Sheet work as a backend.

# Build Rules:

1. Ask before continuing
2. Keep track of every changes so that we can trace back
3. Plan before executing
