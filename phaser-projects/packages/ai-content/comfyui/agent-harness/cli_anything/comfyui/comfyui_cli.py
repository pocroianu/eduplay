#!/usr/bin/env python3
"""ComfyUI CLI — AI image generation from the command line.

Usage:
    cli-anything-comfyui                          # Enter REPL
    cli-anything-comfyui generate txt2img ...      # One-shot generation
    cli-anything-comfyui --json queue status        # JSON output for agents
"""

import sys
import os
import json
import shlex
import click

from cli_anything.comfyui.core import workflows as workflow_mod
from cli_anything.comfyui.core import queue as queue_mod
from cli_anything.comfyui.core import models as models_mod
from cli_anything.comfyui.core import images as images_mod
from cli_anything.comfyui.core import templates as templates_mod
from cli_anything.comfyui.core.session import Session
from cli_anything.comfyui.utils.comfyui_backend import (
    api_get, api_post, DEFAULT_BASE_URL,
)

# Global state
_json_output = False
_base_url = DEFAULT_BASE_URL
_session: Session | None = None


def _get_session() -> Session:
    global _session
    if _session is None:
        _session = Session(server_url=_base_url)
    return _session


def output(data, message: str = ""):
    """Print output in JSON or human-readable format."""
    if _json_output:
        click.echo(json.dumps(data, indent=2, default=str))
    else:
        if message:
            click.echo(message)
        if isinstance(data, dict):
            _print_dict(data)
        elif isinstance(data, list):
            _print_list(data)
        else:
            click.echo(str(data))


def _print_dict(d: dict, indent: int = 0):
    prefix = "  " * indent
    for k, v in d.items():
        if isinstance(v, dict):
            click.echo(f"{prefix}{k}:")
            _print_dict(v, indent + 1)
        elif isinstance(v, list):
            click.echo(f"{prefix}{k}:")
            _print_list(v, indent + 1)
        else:
            click.echo(f"{prefix}{k}: {v}")


def _print_list(items: list, indent: int = 0):
    prefix = "  " * indent
    for i, item in enumerate(items):
        if isinstance(item, dict):
            click.echo(f"{prefix}[{i}]")
            _print_dict(item, indent + 1)
        else:
            click.echo(f"{prefix}- {item}")


def handle_error(func):
    """Decorator for consistent error handling."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            if _json_output:
                click.echo(json.dumps({"error": str(e), "type": type(e).__name__}))
            else:
                click.echo(f"Error: {e}", err=True)
            sys.exit(1)
    wrapper.__name__ = func.__name__
    wrapper.__doc__ = func.__doc__
    return wrapper


# ── Main CLI Group ──────────────────────────────────────────────

@click.group(invoke_without_command=True)
@click.option("--json", "use_json", is_flag=True, help="Output as JSON")
@click.option("--server", default=DEFAULT_BASE_URL, show_default=True,
              help="ComfyUI server URL")
@click.pass_context
def cli(ctx, use_json, server):
    """ComfyUI CLI — AI image generation from the command line.

    Run without a subcommand to enter interactive REPL mode.
    """
    global _json_output, _base_url
    _json_output = use_json
    _base_url = server

    if ctx.invoked_subcommand is None:
        ctx.invoke(repl)


# ── Workflow Commands ───────────────────────────────────────────

@cli.group()
def workflow():
    """Workflow file management."""
    pass


@workflow.command("list")
@click.argument("directory", default=".", type=click.Path())
@handle_error
def workflow_list(directory):
    """List workflow JSON files in a directory."""
    result = workflow_mod.list_workflows(directory)
    output(result, f"Workflows in {directory}:")


@workflow.command("load")
@click.argument("path", type=click.Path(exists=True))
@handle_error
def workflow_load(path):
    """Load and display a workflow JSON file."""
    result = workflow_mod.load_workflow(path)
    output(result, f"Workflow: {path}")


@workflow.command("validate")
@click.argument("path", type=click.Path(exists=True))
@handle_error
def workflow_validate(path):
    """Validate the structure of a workflow JSON file."""
    wf = workflow_mod.load_workflow(path)
    result = workflow_mod.validate_workflow(wf)
    output(result, f"Validation: {path}")


@workflow.command("save")
@click.argument("path", type=click.Path())
@click.option("--template", type=click.Choice(["txt2img", "img2img", "upscale"]),
              required=True, help="Template to save")
@click.option("--prompt", "text_prompt", default="a beautiful landscape")
@click.option("--checkpoint", default="model.safetensors")
@handle_error
def workflow_save(path, template, text_prompt, checkpoint):
    """Save a template workflow to a JSON file."""
    if template == "txt2img":
        wf = templates_mod.txt2img(prompt=text_prompt, checkpoint=checkpoint)
    elif template == "img2img":
        wf = templates_mod.img2img(prompt=text_prompt, checkpoint=checkpoint, input_image="input.png")
    elif template == "upscale":
        wf = templates_mod.upscale(input_image="input.png")
    workflow_mod.save_workflow(wf, path)
    output({"path": path, "template": template}, f"Saved {template} workflow to {path}")


# ── Queue Commands ──────────────────────────────────────────────

@cli.group()
def queue():
    """Prompt queue management."""
    pass


@queue.command("prompt")
@click.option("--workflow", "-w", required=True, type=click.Path(exists=True),
              help="Path to workflow JSON file")
@click.option("--client-id", default=None, help="Client ID for tracking")
@handle_error
def queue_prompt(workflow, client_id):
    """Queue a workflow for generation."""
    wf = workflow_mod.load_workflow(workflow)
    session = _get_session()
    if client_id is None:
        client_id = session.client_id
    result = queue_mod.queue_prompt(_base_url, wf, client_id=client_id)
    session.record_prompt(result["prompt_id"], "queue_prompt", {"workflow": workflow})
    output(result, f"Queued prompt: {result.get('prompt_id', '')}")


@queue.command("status")
@handle_error
def queue_status():
    """Show current queue status."""
    result = queue_mod.get_queue_status(_base_url)
    output(result, "Queue status:")


@queue.command("clear")
@click.option("--confirm", is_flag=True, help="Skip confirmation")
@handle_error
def queue_clear(confirm):
    """Clear all pending items from the queue."""
    if not confirm and not _json_output:
        click.confirm("Clear the queue?", abort=True)
    result = queue_mod.clear_queue(_base_url)
    output(result, "Queue cleared.")


@queue.command("history")
@click.option("--max-items", type=int, default=None, help="Maximum entries")
@handle_error
def queue_history(max_items):
    """Show completed prompt history."""
    result = queue_mod.get_history(_base_url, max_items=max_items)
    output(result, f"History ({result.get('total', 0)} entries):")


@queue.command("interrupt")
@handle_error
def queue_interrupt():
    """Stop the currently running generation."""
    result = queue_mod.interrupt(_base_url)
    output(result, "Generation interrupted.")


@queue.command("watch")
@click.argument("prompt_id")
@click.option("--timeout", type=int, default=300, help="Timeout in seconds")
@handle_error
def queue_watch(prompt_id, timeout):
    """Watch real-time progress of a generation via WebSocket."""
    from cli_anything.comfyui.utils.ws_client import ProgressWatcher
    session = _get_session()
    watcher = ProgressWatcher(_base_url, session.client_id, json_mode=_json_output)
    try:
        watcher.start()
        if not _json_output:
            click.echo(f"Watching prompt {prompt_id}...")
        result = watcher.wait_for_completion(prompt_id, timeout=timeout)
        if not _json_output:
            click.echo(f"\n  Done.")
        output({"status": "success", "prompt_id": prompt_id})
    finally:
        watcher.stop()


# ── Models Commands ─────────────────────────────────────────────

@cli.group()
def models():
    """Model discovery commands."""
    pass


@models.command("checkpoints")
@handle_error
def models_checkpoints():
    """List available checkpoint models."""
    result = models_mod.list_checkpoints(_base_url)
    output(result, f"Checkpoints ({len(result)}):")


@models.command("loras")
@handle_error
def models_loras():
    """List available LoRA models."""
    result = models_mod.list_loras(_base_url)
    output(result, f"LoRAs ({len(result)}):")


@models.command("vaes")
@handle_error
def models_vaes():
    """List available VAE models."""
    result = models_mod.list_vaes(_base_url)
    output(result, f"VAEs ({len(result)}):")


@models.command("controlnets")
@handle_error
def models_controlnets():
    """List available ControlNet models."""
    result = models_mod.list_controlnets(_base_url)
    output(result, f"ControlNets ({len(result)}):")


@models.command("node-info")
@click.argument("node_class")
@handle_error
def models_node_info(node_class):
    """Get input/output schema for a node class."""
    result = models_mod.get_node_info(_base_url, node_class)
    output(result)


@models.command("list-nodes")
@handle_error
def models_list_nodes():
    """List all available node class names."""
    result = models_mod.list_all_node_classes(_base_url)
    output(result, f"Node classes ({len(result)}):")


# ── Images Commands ─────────────────────────────────────────────

@cli.group()
def images():
    """Image output management."""
    pass


@images.command("list")
@click.option("--prompt-id", default=None, help="Prompt ID (default: last)")
@handle_error
def images_list(prompt_id):
    """List output images for a completed prompt."""
    if prompt_id is None:
        prompt_id = _get_session().last_prompt_id
        if prompt_id is None:
            raise RuntimeError("No prompt ID specified and no previous prompt in session.")
    result = images_mod.list_output_images(_base_url, prompt_id)
    output(result, f"Output images for {prompt_id}:")


@images.command("download")
@click.option("--filename", required=True, help="Image filename")
@click.option("--output", "output_path", required=True, type=click.Path())
@click.option("--subfolder", default="")
@click.option("--type", "image_type", default="output",
              type=click.Choice(["output", "input", "temp"]))
@click.option("--overwrite", is_flag=True)
@handle_error
def images_download(filename, output_path, subfolder, image_type, overwrite):
    """Download a single output image."""
    result = images_mod.download_image(
        base_url=_base_url, filename=filename, output_path=output_path,
        subfolder=subfolder, image_type=image_type, overwrite=overwrite,
    )
    output(result, f"Downloaded: {output_path}")


@images.command("download-all")
@click.option("--prompt-id", default=None, help="Prompt ID (default: last)")
@click.option("--output-dir", "-o", required=True, type=click.Path())
@click.option("--overwrite", is_flag=True)
@handle_error
def images_download_all(prompt_id, output_dir, overwrite):
    """Download all output images for a prompt."""
    if prompt_id is None:
        prompt_id = _get_session().last_prompt_id
        if prompt_id is None:
            raise RuntimeError("No prompt ID specified and no previous prompt in session.")
    result = images_mod.download_prompt_images(
        base_url=_base_url, prompt_id=prompt_id,
        output_dir=output_dir, overwrite=overwrite,
    )
    output(result, f"Downloaded {len(result)} image(s) to {output_dir}")


# ── Generate Commands ───────────────────────────────────────────

@cli.group()
def generate():
    """High-level generation commands (build + queue + watch + download)."""
    pass


def _run_generation(workflow: dict, output_dir: str, action: str, params: dict,
                    timeout: int = 300):
    """Shared logic: queue workflow, watch progress, download results."""
    session = _get_session()

    result = queue_mod.queue_prompt(_base_url, workflow, client_id=session.client_id)
    prompt_id = result["prompt_id"]
    session.record_prompt(prompt_id, action, params)

    if not _json_output:
        click.echo(f"Queued prompt {prompt_id}")

    try:
        from cli_anything.comfyui.utils.ws_client import ProgressWatcher
        watcher = ProgressWatcher(_base_url, session.client_id, json_mode=_json_output)
        watcher.start()
        watcher.wait_for_completion(prompt_id, timeout=timeout)
        watcher.stop()
        if not _json_output:
            click.echo()
    except Exception as e:
        if not _json_output:
            click.echo(f"\n  Warning: WebSocket unavailable ({e}), polling...", err=True)
        import time
        for _ in range(timeout // 2):
            time.sleep(2)
            try:
                hist = queue_mod.get_prompt_history(_base_url, prompt_id)
                if hist.get("completed"):
                    break
            except RuntimeError:
                pass
        else:
            raise RuntimeError(f"Timeout waiting for prompt {prompt_id}")

    os.makedirs(output_dir, exist_ok=True)
    downloaded = images_mod.download_prompt_images(
        base_url=_base_url, prompt_id=prompt_id,
        output_dir=output_dir, overwrite=True,
    )

    result_data = {
        "prompt_id": prompt_id,
        "images": downloaded,
        "output_dir": output_dir,
        "count": len(downloaded),
    }

    if not _json_output:
        click.echo(f"  Downloaded {len(downloaded)} image(s) to {output_dir}")
        for img in downloaded:
            size = img.get("file_size", 0)
            click.echo(f"    {img.get('path', img.get('filename', '?'))} ({size:,} bytes)")
    else:
        click.echo(json.dumps(result_data, indent=2, default=str))


@generate.command("txt2img")
@click.option("--prompt", "-p", required=True, help="Positive prompt text")
@click.option("--negative", "-n", default="blurry, low quality, distorted")
@click.option("--checkpoint", "-c", required=True, help="Checkpoint model name")
@click.option("--steps", type=int, default=20)
@click.option("--cfg", type=float, default=7.0)
@click.option("--width", type=int, default=512)
@click.option("--height", type=int, default=512)
@click.option("--seed", type=int, default=-1)
@click.option("--output-dir", "-o", default="./output", type=click.Path())
@click.option("--timeout", type=int, default=300)
@handle_error
def generate_txt2img(prompt, negative, checkpoint, steps, cfg, width, height,
                     seed, output_dir, timeout):
    """Generate image from text prompt."""
    wf = templates_mod.txt2img(
        prompt=prompt, negative=negative, checkpoint=checkpoint,
        steps=steps, cfg=cfg, width=width, height=height, seed=seed,
    )
    _run_generation(wf, output_dir, "generate_txt2img", {
        "prompt": prompt, "checkpoint": checkpoint, "steps": steps,
    }, timeout=timeout)


@generate.command("img2img")
@click.option("--prompt", "-p", required=True, help="Positive prompt text")
@click.option("--negative", "-n", default="blurry, low quality, distorted")
@click.option("--checkpoint", "-c", required=True, help="Checkpoint model name")
@click.option("--input-image", "-i", required=True, help="Input image filename")
@click.option("--denoise", type=float, default=0.75)
@click.option("--steps", type=int, default=20)
@click.option("--cfg", type=float, default=7.0)
@click.option("--seed", type=int, default=-1)
@click.option("--output-dir", "-o", default="./output", type=click.Path())
@click.option("--timeout", type=int, default=300)
@handle_error
def generate_img2img(prompt, negative, checkpoint, input_image, denoise,
                     steps, cfg, seed, output_dir, timeout):
    """Generate image from input image + text prompt."""
    wf = templates_mod.img2img(
        prompt=prompt, negative=negative, checkpoint=checkpoint,
        input_image=input_image, denoise=denoise, steps=steps,
        cfg=cfg, seed=seed,
    )
    _run_generation(wf, output_dir, "generate_img2img", {
        "prompt": prompt, "input_image": input_image, "denoise": denoise,
    }, timeout=timeout)


@generate.command("upscale")
@click.option("--input-image", "-i", required=True, help="Input image filename")
@click.option("--upscale-model", default="RealESRGAN_x4plus.pth")
@click.option("--output-dir", "-o", default="./output", type=click.Path())
@click.option("--timeout", type=int, default=300)
@handle_error
def generate_upscale(input_image, upscale_model, output_dir, timeout):
    """Upscale an image using an upscale model."""
    wf = templates_mod.upscale(input_image=input_image, upscale_model=upscale_model)
    _run_generation(wf, output_dir, "generate_upscale", {
        "input_image": input_image, "upscale_model": upscale_model,
    }, timeout=timeout)


# ── System Commands ─────────────────────────────────────────────

@cli.group()
def system():
    """System information commands."""
    pass


@system.command("stats")
@handle_error
def system_stats():
    """Show GPU/memory system stats."""
    result = api_get(_base_url, "/system_stats")
    output(result, "System stats:")


@system.command("info")
@handle_error
def system_info():
    """Show server info and session state."""
    session = _get_session()
    result = {
        "server_url": _base_url,
        "session": session.to_dict(),
    }
    try:
        stats = api_get(_base_url, "/system_stats")
        result["system"] = stats.get("system", {})
        result["connected"] = True
    except RuntimeError:
        result["connected"] = False
    output(result, "Server info:")


@system.command("free")
@handle_error
def system_free():
    """Unload models and free VRAM."""
    result = api_post(_base_url, "/free", {"unload_models": True, "free_memory": True})
    output(result, "Models unloaded, VRAM freed.")


# ── REPL ─────────────────────────────────────────────────────────

@cli.command()
@handle_error
def repl():
    """Start interactive REPL session."""
    from cli_anything.comfyui.utils.repl_skin import ReplSkin
    from cli_anything.comfyui import __version__

    skin = ReplSkin("comfyui", version=__version__)
    skin.print_banner()

    try:
        api_get(_base_url, "/system_stats")
        skin.success(f"Connected to {_base_url}")
    except Exception as e:
        skin.warning(f"Could not connect to ComfyUI: {e}")

    pt_session = skin.create_prompt_session()

    while True:
        try:
            line = skin.get_input(pt_session)
            if not line:
                continue
            if line.lower() in ("quit", "exit", "q"):
                skin.print_goodbye()
                break
            if line.lower() == "help":
                skin.help({
                    "workflow":  "list | load | validate | save",
                    "queue":     "prompt | status | clear | history | interrupt | watch",
                    "models":    "checkpoints | loras | vaes | controlnets | node-info | list-nodes",
                    "images":    "list | download | download-all",
                    "generate":  "txt2img | img2img | upscale",
                    "system":    "stats | info | free",
                    "help":      "Show this help",
                    "quit":      "Exit REPL",
                })
                continue

            try:
                args = shlex.split(line)
            except ValueError:
                args = line.split()
            try:
                cli.main(args, standalone_mode=False)
            except SystemExit:
                pass
            except click.exceptions.UsageError as e:
                skin.error(f"Usage: {e}")
            except Exception as e:
                skin.error(str(e))

        except (EOFError, KeyboardInterrupt):
            skin.print_goodbye()
            break


# ── Entry Point ──────────────────────────────────────────────────

def main():
    cli()


if __name__ == "__main__":
    main()
