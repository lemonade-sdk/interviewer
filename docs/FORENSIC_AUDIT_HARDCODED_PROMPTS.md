# Forensic Audit of Hardcoded Prompts

**Role: Senior AI Architect**

I have conducted a forensic audit of your codebase to identify every instance of a "Hardcoded Prompt." These are the string literals that define the intelligence, behavior, and output format of your application.

Here is the exact location and critical analysis of every prompt in your system.

---

### 1. `src/services/InterviewService.ts`
This file contains the core logic for the interview loop and feedback generation.

**A. The "Identity Anchor" (Fallback)**
*   **Location:** `buildSystemPrompt` (Line 432)
*   **Trigger:** When no specific Persona is generated (or available).
*   **Content:**
    ```text
    You are an experienced interviewer conducting a ${interviewType} interview for the position of ${position} at ${company}.
    Your interview style is ${interviewStyle}.
    ...
    Guidelines:
    1. Be professional...
    2. Ask relevant questions...
    ```
*   **Critical Analysis:** This is the baseline identity. It forces the model to adopt the persona of an interviewer. It is "hardcoded" but parameterized with user settings.

**B. The "Feedback Generator"**
*   **Location:** `endInterview` (Line 142)
*   **Trigger:** User clicks "End Interview".
*   **Content:**
    ```text
    Based on the interview conversation, provide comprehensive feedback on the candidate's performance. Include:
    1. Overall score (0-100)
    ...
    Format your response as JSON with the following structure:
    { "overallScore": number, ... }
    ```
*   **Critical Analysis:** This is a **Task-Specific Prompt**. It switches the model from "Interviewer" mode to "Evaluator" mode. It strictly enforces a JSON schema to ensure the UI can parse the result.

**C. The "Granular Grader"**
*   **Location:** `generateDetailedFeedback` (Line 226)
*   **Trigger:** During detailed report generation (grading Q/A pairs).
*   **Content:**
    ```text
    You are an expert interview evaluator. Grade the following interview question and the candidate's answer.
    QUESTION: ${question}
    CANDIDATE'S ANSWER: ${answer}
    Provide your evaluation as JSON...
    ```
*   **Critical Analysis:** This prompt runs in a loop (once per question). It isolates a single exchange and demands a specific JSON structure (`score`, `rating`, `strengths`).

---

### 2. `src/services/PersonaGeneratorService.ts`
This file is responsible for "Meta-Prompting"—using the AI to write prompts for the AI.

**A. The "Meta-Prompt" (Persona Creator)**
*   **Location:** `buildPersonaGenerationPrompt` (Line 67)
*   **Trigger:** "Generate Persona" button.
*   **Content:**
    ```text
    You are an expert interview preparation system. Analyze the job description and resume below, then generate a tailored interviewer persona as a JSON object.
    <JOB_DESCRIPTION>...
    <RESUME>...
    Respond with ONLY a valid JSON object...
    ```
*   **Critical Analysis:** This is the most complex prompt. It takes raw text (JD/Resume) and asks the LLM to synthesize a *new* System Prompt (the `systemPrompt` field in the JSON output).

**B. The "JSON Enforcer" (System Message)**
*   **Location:** `generatePersona` (Line 105)
*   **Trigger:** Sent as the `system` message alongside the Meta-Prompt.
*   **Content:**
    ```text
    You are a JSON generation assistant. You ONLY output valid JSON objects. No markdown, no code fences, no explanations.
    ```
*   **Critical Analysis:** This is a "Guardrail Prompt." It exists solely to prevent the model from adding conversational filler ("Here is your JSON:") which would break the `JSON.parse()` logic.

**C. The "Generator Fallback"**
*   **Location:** `buildFallbackSystemPrompt` (Line 225)
*   **Trigger:** If the LLM fails to generate a valid JSON persona.
*   **Content:** Almost identical to `InterviewService` fallback, but injects the raw Resume/JD text directly into the prompt context.

---

### 3. `src/electron_app/main.ts`
This file contains utility prompts for document processing.

**A. The "Job Extractor"**
*   **Location:** `document:extractJobDetails` handler (Line 951)
*   **Trigger:** Uploading a Job Description PDF.
*   **Content:**
    ```text
    /no_think
    Analyze the following job posting and extract the key details. Return ONLY a valid JSON object...
    ```
*   **Critical Analysis:**
    *   **`/no_think`:** This is a specific instruction (likely for models like DeepSeek R1) to suppress "Chain of Thought" output, saving tokens and parsing headaches.
    *   **Purpose:** Converts unstructured PDF text into structured data (`title`, `company`, `position`) to auto-fill the UI forms.

---

### Summary of Hardcoded Intelligence

Your application's intelligence is defined by these **6 specific string literals**:

1.  **Identity Anchor:** "You are an experienced interviewer..."
2.  **Feedback Task:** "Provide comprehensive feedback... as JSON"
3.  **Grading Task:** "Grade the following... as JSON"
4.  **Meta-Creation:** "Analyze JD/Resume... generate persona as JSON"
5.  **Guardrail:** "You are a JSON generation assistant..."
6.  **Extraction:** "Extract key details... as JSON"

Every single feature of your app relies on one of these six strings being interpreted correctly by the LLM.
