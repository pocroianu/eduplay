"""Pure-function tests for batch_duolingo.py.

All heavy-dependency stubbing (cli_anything.*) and real-module preloading
(numpy/PIL/rembg/postprocess/audit_green_subjects) happen in conftest.py.

The pipeline now generates flat white-background PNGs with no rembg,
no alpha, and no chroma-key cleanup. Tests reflect that.
"""
import pytest

import batch_animals as ba
import batch_duolingo as bd


class TestRenderPrompt:
    def test_animal_category_uses_animal_template(self):
        prompt = bd.render_prompt("animals-wild", "lion")
        assert "lion" in prompt
        assert "friendly character" in prompt  # animal-template marker

    def test_person_category_uses_person_template(self):
        prompt = bd.render_prompt("professions", "doctor")
        assert "doctor" in prompt
        assert "one person only" in prompt  # person-template marker

    def test_object_category_uses_object_template(self):
        prompt = bd.render_prompt("fruits", "apple")
        assert "apple" in prompt
        assert "no face, no eyes" in prompt  # object-template marker

    def test_object_template_forbids_silhouette(self):
        prompt = bd.render_prompt("fruits", "apple")
        assert "not a silhouette" in prompt
        assert "recognizable details and features" in prompt

    def test_unknown_category_falls_back_to_object_template(self):
        prompt = bd.render_prompt("does-not-exist", "widget")
        assert "widget" in prompt
        assert "no face, no eyes" in prompt


class TestWhiteBackground:
    """Every template must request a pure white background — the
    magenta-chroma-key strategy has been abandoned."""

    @pytest.mark.parametrize("category,item", [
        ("animals-wild", "lion"),
        ("animals-insects", "butterfly"),
        ("professions", "doctor"),
        ("fruits", "apple"),
        ("numbers", "number five"),
    ])
    def test_prompt_requests_white_background(self, category, item):
        prompt = bd.render_prompt(category, item)
        assert "pure solid white background" in prompt
        assert "clean white background" in prompt

    @pytest.mark.parametrize("category,item", [
        ("animals-wild", "lion"),
        ("fruits", "apple"),
        ("numbers", "number five"),
    ])
    def test_prompt_has_no_magenta_or_chroma_references(self, category, item):
        prompt = bd.render_prompt(category, item)
        assert "magenta" not in prompt.lower()
        assert "chroma" not in prompt.lower()
        assert "pink" not in prompt.lower()

    @pytest.mark.parametrize("category,item", [
        ("animals-wild", "lion"),
        ("fruits", "apple"),
    ])
    def test_prompt_has_no_green_references(self, category, item):
        prompt = bd.render_prompt(category, item)
        assert "green background" not in prompt
        assert "chroma key green" not in prompt


class TestComfyUIServerConfig:
    def test_duolingo_default_server_matches_current_comfyui_port(self, monkeypatch):
        monkeypatch.delenv("COMFYUI_URL", raising=False)
        assert bd.resolve_comfyui_server_url() == "http://localhost:8188"

    def test_duolingo_server_can_be_overridden_by_env(self, monkeypatch):
        monkeypatch.setenv("COMFYUI_URL", "http://127.0.0.1:9999")
        assert bd.resolve_comfyui_server_url() == "http://127.0.0.1:9999"

    def test_animals_default_server_matches_current_comfyui_port(self, monkeypatch):
        monkeypatch.delenv("COMFYUI_URL", raising=False)
        assert ba.resolve_comfyui_server_url() == "http://localhost:8188"

    def test_animals_server_can_be_overridden_by_env(self, monkeypatch):
        monkeypatch.setenv("COMFYUI_URL", "http://127.0.0.1:9999")
        assert ba.resolve_comfyui_server_url() == "http://127.0.0.1:9999"


class TestNegativePrompt:
    def test_negative_prompt_forbids_colored_backgrounds(self):
        np = bd.DUOLINGO_NEGATIVE_PROMPT
        # The positive prompt asks for white; negative prompt should reject
        # anything but white.
        assert "dark background" in np
        assert "colored background" in np
        assert "patterned background" in np

    def test_negative_prompt_does_not_forbid_white_background(self):
        """We now WANT a white background — the old negative prompt
        forbade it as part of the chroma-key strategy."""
        np = bd.DUOLINGO_NEGATIVE_PROMPT
        assert "white background" not in np

    def test_negative_prompt_forbids_silhouette(self):
        np = bd.DUOLINGO_NEGATIVE_PROMPT
        assert "silhouette" in np
        assert "monochrome" in np

    def test_negative_prompt_no_longer_mentions_magenta(self):
        np = bd.DUOLINGO_NEGATIVE_PROMPT
        assert "magenta" not in np.lower()
        assert "pink" not in np.lower()

    def test_negative_prompt_no_longer_mentions_green(self):
        np = bd.DUOLINGO_NEGATIVE_PROMPT
        assert "green tint" not in np
        assert "green color bleed" not in np


class TestNoChromaKeyConstants:
    """The module should no longer export chroma-key helpers."""

    def test_magenta_hue_range_removed(self):
        assert not hasattr(bd, "MAGENTA_HUE_RANGE"), (
            "MAGENTA_HUE_RANGE is a chroma-key artifact and should be gone"
        )

    def test_subject_color_guard_removed(self):
        assert not hasattr(bd, "_SUBJECT_COLOR_GUARD")


class TestWorkflowBuilder:
    def test_returns_workflow_and_seed(self):
        result = bd.build_qwen_image_workflow(
            positive_prompt="test",
            negative_prompt="bad",
            prefix="t",
        )
        assert isinstance(result, tuple)
        assert len(result) == 2
        workflow, seed = result
        assert isinstance(workflow, dict)
        assert isinstance(seed, int)
        assert 0 <= seed < 2**32

    def test_honors_explicit_seed(self):
        workflow, seed = bd.build_qwen_image_workflow(
            positive_prompt="test",
            negative_prompt="bad",
            prefix="t",
            seed=12345,
        )
        assert seed == 12345
        assert workflow["3"]["inputs"]["seed"] == 12345

    def test_generates_random_seed_when_none(self):
        _, s1 = bd.build_qwen_image_workflow("p", "n", "t")
        _, s2 = bd.build_qwen_image_workflow("p", "n", "t")
        # 32-bit space; probability of collision across 2 calls is ~0
        assert s1 != s2


class TestFilterJobs:
    def test_keeps_only_matching_prefixes(self):
        jobs = [
            ("numbers", "number five"),
            ("numbers", "number seven"),
            ("fruits", "apple"),
            ("fruits", "pear"),
        ]
        targets = ["numbers_number-seven", "fruits_pear"]
        filtered = bd.filter_jobs(jobs, targets)
        assert filtered == [
            ("numbers", "number seven"),
            ("fruits", "pear"),
        ]

    def test_normalises_slug_like_the_generation_loop(self):
        jobs = [
            ("professions", "Firefighter"),
            ("shapes", "red circle"),
            ("animals/other", "Weird/Name"),
        ]
        targets = [
            "professions_firefighter",
            "shapes_red-circle",
            "animals/other_weird-name",
        ]
        filtered = bd.filter_jobs(jobs, targets)
        assert filtered == jobs

    def test_empty_targets_returns_empty(self):
        assert bd.filter_jobs([("a", "b")], []) == []

    def test_no_matches_returns_empty(self):
        assert bd.filter_jobs([("a", "b")], ["x_y"]) == []
