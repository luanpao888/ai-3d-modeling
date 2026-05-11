# AI Prompts Directory

This directory contains prompt templates used by the AI modeling assistant. You can import these into LangSmith for advanced monitoring and versioning.

## Files

- **dsl_generation.txt** — Primary system prompt for 3D DSL generation
- **intent_classifier.txt** — Classifies user intent (chat/clarify/generate)
- **chat_reply.txt** — Natural language conversation assistant
- **clarify.txt** — Ambiguity resolution prompt
- **plan_steps.txt** — Breaks requests into implementation steps
- **execute_step.txt** — Executes a single step to produce updated DSL
- **engineering_management.txt** — Engineering planning and tracking assistant

## Loading Rule

The backend loads prompts directly by filename:

- key `dsl_generation` → `dsl_generation.txt`
- key `intent_classifier` → `intent_classifier.txt`
- key `chat_reply` → `chat_reply.txt`
- key `clarify` → `clarify.txt`
- key `plan_steps` → `plan_steps.txt`
- key `execute_step` → `execute_step.txt`
- key `engineering_management` → `engineering_management.txt`

## LangSmith Integration

To use these prompts in LangSmith:

1. Copy the content of each `.txt` file
2. Create a prompt in LangSmith with the same key name (e.g., `dsl_generation`)
3. Keep file names aligned with prompt keys used in code
