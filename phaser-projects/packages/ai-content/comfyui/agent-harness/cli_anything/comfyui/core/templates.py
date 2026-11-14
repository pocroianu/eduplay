"""Workflow templates — pre-built factories for common generation tasks.

Each function returns a workflow dict ready for ComfyUI's POST /prompt API.
"""

from cli_anything.comfyui.core.builder import WorkflowBuilder


def txt2img(
    prompt: str,
    checkpoint: str,
    negative: str = "blurry, low quality, distorted",
    width: int = 512,
    height: int = 512,
    steps: int = 20,
    cfg: float = 7.0,
    sampler_name: str = "euler",
    scheduler: str = "normal",
    seed: int = -1,
    filename_prefix: str = "ComfyUI",
) -> dict:
    """Build a text-to-image workflow."""
    b = WorkflowBuilder()
    ckpt = b.add_checkpoint(checkpoint)
    pos = b.add_positive_prompt(prompt, clip=ckpt.output(1))
    neg = b.add_negative_prompt(negative, clip=ckpt.output(1))
    latent = b.add_empty_latent(width, height)
    sampler = b.add_ksampler(
        model=ckpt.output(0), positive=pos.output(0),
        negative=neg.output(0), latent_image=latent.output(0),
        seed=seed, steps=steps, cfg=cfg,
        sampler_name=sampler_name, scheduler=scheduler,
    )
    decoded = b.add_vae_decode(samples=sampler.output(0), vae=ckpt.output(2))
    b.add_save_image(images=decoded.output(0), filename_prefix=filename_prefix)
    return b.build()


def img2img(
    prompt: str,
    checkpoint: str,
    input_image: str,
    negative: str = "blurry, low quality, distorted",
    denoise: float = 0.75,
    steps: int = 20,
    cfg: float = 7.0,
    sampler_name: str = "euler",
    scheduler: str = "normal",
    seed: int = -1,
    filename_prefix: str = "ComfyUI",
) -> dict:
    """Build an image-to-image workflow."""
    b = WorkflowBuilder()
    ckpt = b.add_checkpoint(checkpoint)
    pos = b.add_positive_prompt(prompt, clip=ckpt.output(1))
    neg = b.add_negative_prompt(negative, clip=ckpt.output(1))
    img = b.add_load_image(input_image)
    encoded = b.add_vae_encode(pixels=img.output(0), vae=ckpt.output(2))
    sampler = b.add_ksampler(
        model=ckpt.output(0), positive=pos.output(0),
        negative=neg.output(0), latent_image=encoded.output(0),
        seed=seed, steps=steps, cfg=cfg,
        sampler_name=sampler_name, scheduler=scheduler,
        denoise=denoise,
    )
    decoded = b.add_vae_decode(samples=sampler.output(0), vae=ckpt.output(2))
    b.add_save_image(images=decoded.output(0), filename_prefix=filename_prefix)
    return b.build()


def upscale(
    input_image: str,
    upscale_model: str = "RealESRGAN_x4plus.pth",
    filename_prefix: str = "ComfyUI_upscaled",
) -> dict:
    """Build an image upscale workflow."""
    b = WorkflowBuilder()
    img = b.add_load_image(input_image)
    model = b.add_upscale_model(upscale_model)
    upscaled = b.add_image_upscale(upscale_model=model.output(0), image=img.output(0))
    b.add_save_image(images=upscaled.output(0), filename_prefix=filename_prefix)
    return b.build()
