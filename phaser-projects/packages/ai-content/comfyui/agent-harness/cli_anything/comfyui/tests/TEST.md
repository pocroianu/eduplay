# TEST.md — ComfyUI CLI Test Plan and Results

## Test Inventory

- `test_core.py`: ~56 unit tests
- `test_full_e2e.py`: ~10 E2E + ~5 subprocess tests

## Unit Test Plan (test_core.py)

| Module | Tests | Covers |
|--------|-------|--------|
| session.py | 8 | Create, save/load, round-trip, history, caps, corruption |
| ws_client.py | 10 | Event parsing (progress, executing, success, error, binary, unknown), progress formatting |
| builder.py | 8 | Empty build, add node, auto IDs, wiring, fluent API, defaults, validation |
| templates.py | 6 | txt2img, img2img, upscale — structure, params, defaults |
| comfyui_cli.py | 8 | Help for all groups, JSON validate, models, system free |
| workflows.py | 7 | Load valid/missing/non-json, validate valid/empty/missing-class, save round-trip |
| queue.py | 4 | Submit success, empty workflow, status, history |
| models.py | 1 | List checkpoints |
| images.py | 2 | Download, no-overwrite |
| backend.py | 2 | GET success, connection error |

## E2E Test Plan (test_full_e2e.py)

### Tier 1: Intermediate Files (no ComfyUI)

| Test | Workflow |
|------|----------|
| Builder round-trip | Build -> save -> load -> validate |
| txt2img template | Generate -> save -> validate (7 nodes) |
| img2img template | Validate structure (LoadImage + VAEEncode) |
| upscale template | Validate structure (UpscaleModelLoader) |
| Session lifecycle | Create -> record 2 prompts -> reload -> verify |

### Tier 2: True Backend (requires ComfyUI)

| Test | Verifies |
|------|----------|
| system_stats | Server reachable, returns GPU info |
| list_checkpoints | At least one model found |
| queue_status | Returns running/pending counts |
| txt2img_generation | Full pipeline: build -> queue -> WebSocket -> download -> PNG magic bytes |

### Tier 3: CLI Subprocess

| Test | Command |
|------|---------|
| --help | Exits 0, shows "ComfyUI CLI" |
| workflow --help | Exits 0 |
| generate --help | Shows txt2img |
| workflow validate (JSON) | Returns {"valid": true} |
| system stats (JSON) | Returns system info or connection error |

## Test Results

### Unit Tests (test_core.py)

```
============================= test session starts =============================
platform win32 -- Python 3.12.6, pytest-9.0.2, pluggy-1.6.0
collected 56 items

test_core.py::TestSessionCreate::test_creates_default_session PASSED [  1%]
test_core.py::TestSessionCreate::test_persistent_client_id PASSED [  3%]
test_core.py::TestSessionCreate::test_custom_server_url PASSED [  5%]
test_core.py::TestSessionSaveLoad::test_round_trip PASSED [  7%]
test_core.py::TestSessionSaveLoad::test_corrupted_file_resets PASSED [  8%]
test_core.py::TestSessionHistory::test_record_action PASSED [ 10%]
test_core.py::TestSessionHistory::test_last_prompt_id PASSED [ 12%]
test_core.py::TestSessionHistory::test_history_max_entries PASSED [ 14%]
test_core.py::TestWsEventParsing::test_parse_progress_event PASSED [ 16%]
test_core.py::TestWsEventParsing::test_parse_executing_event PASSED [ 17%]
test_core.py::TestWsEventParsing::test_parse_execution_success PASSED [ 19%]
test_core.py::TestWsEventParsing::test_parse_execution_error PASSED [ 21%]
test_core.py::TestWsEventParsing::test_parse_status_event PASSED [ 23%]
test_core.py::TestWsEventParsing::test_parse_binary_message_returns_preview PASSED [ 25%]
test_core.py::TestWsEventParsing::test_parse_invalid_json_returns_unknown PASSED [ 26%]
test_core.py::TestWsProgressFormatter::test_format_progress_bar PASSED [ 28%]
test_core.py::TestWsProgressFormatter::test_format_progress_zero PASSED [ 30%]
test_core.py::TestWsProgressFormatter::test_format_progress_complete PASSED [ 32%]
test_core.py::TestBuilderBasic::test_empty_builder_raises PASSED [ 33%]
test_core.py::TestBuilderBasic::test_add_single_node PASSED [ 35%]
test_core.py::TestBuilderBasic::test_node_auto_ids PASSED [ 37%]
test_core.py::TestBuilderWiring::test_output_reference PASSED [ 39%]
test_core.py::TestBuilderWiring::test_connect_nodes PASSED [ 41%]
test_core.py::TestBuilderFluentAPI::test_txt2img_fluent PASSED [ 42%]
test_core.py::TestBuilderFluentAPI::test_defaults_for_ksampler PASSED [ 44%]
test_core.py::TestBuilderValidation::test_no_output_node_raises PASSED [ 46%]
test_core.py::TestTxt2ImgTemplate::test_basic_txt2img PASSED [ 48%]
test_core.py::TestTxt2ImgTemplate::test_txt2img_custom_params PASSED [ 50%]
test_core.py::TestTxt2ImgTemplate::test_txt2img_default_negative PASSED [ 51%]
test_core.py::TestImg2ImgTemplate::test_basic_img2img PASSED [ 53%]
test_core.py::TestImg2ImgTemplate::test_img2img_denoise PASSED [ 55%]
test_core.py::TestUpscaleTemplate::test_basic_upscale PASSED [ 57%]
test_core.py::TestCLIHelp::test_main_help PASSED [ 58%]
test_core.py::TestCLIHelp::test_workflow_help PASSED [ 60%]
test_core.py::TestCLIHelp::test_queue_help PASSED [ 62%]
test_core.py::TestCLIHelp::test_generate_help PASSED [ 64%]
test_core.py::TestCLIHelp::test_system_help PASSED [ 66%]
test_core.py::TestCLIWorkflow::test_workflow_validate_json PASSED [ 67%]
test_core.py::TestCLIWorkflow::test_workflow_list PASSED [ 69%]
test_core.py::TestCLIModels::test_checkpoints_json PASSED [ 71%]
test_core.py::TestWorkflowLoad::test_load_valid PASSED [ 73%]
test_core.py::TestWorkflowLoad::test_load_missing_file PASSED [ 75%]
test_core.py::TestWorkflowLoad::test_load_non_json PASSED [ 76%]
test_core.py::TestWorkflowValidate::test_valid_workflow PASSED [ 78%]
test_core.py::TestWorkflowValidate::test_empty_workflow PASSED [ 80%]
test_core.py::TestWorkflowValidate::test_missing_class_type PASSED [ 82%]
test_core.py::TestWorkflowSave::test_save_and_reload PASSED [ 83%]
test_core.py::TestQueuePrompt::test_queue_success PASSED [ 85%]
test_core.py::TestQueuePrompt::test_queue_empty_workflow PASSED [ 87%]
test_core.py::TestQueueStatus::test_status PASSED [ 89%]
test_core.py::TestQueueHistory::test_history PASSED [ 91%]
test_core.py::TestModelsCheckpoints::test_list_checkpoints PASSED [ 92%]
test_core.py::TestImagesDownload::test_download_image PASSED [ 94%]
test_core.py::TestImagesDownload::test_no_overwrite PASSED [ 96%]
test_core.py::TestBackend::test_api_get PASSED [ 98%]
test_core.py::TestBackend::test_connection_error PASSED [100%]

============================= 56 passed in 0.40s ==============================
```

### E2E Tests - Tier 1 (test_full_e2e.py)

```
============================= test session starts =============================
platform win32 -- Python 3.12.6, pytest-9.0.2, pluggy-1.6.0
collected 14 items / 9 deselected / 5 selected

test_full_e2e.py::TestWorkflowRoundTrip::test_builder_save_load PASSED [ 20%]
test_full_e2e.py::TestWorkflowRoundTrip::test_txt2img_template_valid PASSED [ 40%]
test_full_e2e.py::TestWorkflowRoundTrip::test_img2img_template_valid PASSED [ 60%]
test_full_e2e.py::TestWorkflowRoundTrip::test_upscale_template_valid PASSED [ 80%]
test_full_e2e.py::TestSessionRoundTrip::test_full_session_lifecycle PASSED [100%]

======================= 5 passed, 9 deselected in 0.05s =======================
```

### Subprocess Tests (test_full_e2e.py)

```
============================= test session starts =============================
platform win32 -- Python 3.12.6, pytest-9.0.2, pluggy-1.6.0
collected 14 items / 9 deselected / 5 selected

test_full_e2e.py::TestCLISubprocess::test_help PASSED
test_full_e2e.py::TestCLISubprocess::test_workflow_help PASSED
test_full_e2e.py::TestCLISubprocess::test_generate_help PASSED
test_full_e2e.py::TestCLISubprocess::test_workflow_validate_json PASSED
test_full_e2e.py::TestCLISubprocess::test_system_stats_json PASSED

======================= 5 passed, 9 deselected in 4.99s =======================
```

### Summary

- Unit tests: 56 passed
- E2E Tier 1: 5 passed
- Subprocess: 5 passed
- Total: 66 passed
