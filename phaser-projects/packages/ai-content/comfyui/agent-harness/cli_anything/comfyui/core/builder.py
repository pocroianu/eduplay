"""Workflow builder — programmatic ComfyUI node graph construction.

Build workflows with a fluent API instead of writing raw JSON.
"""

_OUTPUT_NODE_TYPES = {"SaveImage", "PreviewImage", "SaveAnimatedWEBP", "SaveAnimatedPNG"}


class NodeRef:
    """Reference to a node in the builder graph."""

    def __init__(self, node_id: str, class_type: str):
        self.node_id = node_id
        self.class_type = class_type

    def output(self, index: int = 0) -> list:
        """Create an output reference: [node_id, index]."""
        return [self.node_id, index]


class WorkflowBuilder:
    """Build ComfyUI workflow graphs programmatically."""

    def __init__(self):
        self._nodes: dict[str, dict] = {}
        self._counter = 0

    def _next_id(self) -> str:
        self._counter += 1
        return str(self._counter)

    def add_node(self, class_type: str, inputs: dict) -> NodeRef:
        """Add a generic node to the workflow."""
        node_id = self._next_id()
        self._nodes[node_id] = {
            "class_type": class_type,
            "inputs": dict(inputs),
        }
        return NodeRef(node_id, class_type)

    def add_checkpoint(self, ckpt_name: str) -> NodeRef:
        """Add CheckpointLoaderSimple. Outputs: [MODEL, CLIP, VAE]."""
        return self.add_node("CheckpointLoaderSimple", {"ckpt_name": ckpt_name})

    def add_positive_prompt(self, text: str, clip=None) -> NodeRef:
        """Add CLIPTextEncode for positive prompt."""
        inputs = {"text": text}
        if clip is not None:
            inputs["clip"] = clip
        return self.add_node("CLIPTextEncode", inputs)

    def add_negative_prompt(self, text: str, clip=None) -> NodeRef:
        """Add CLIPTextEncode for negative prompt."""
        inputs = {"text": text}
        if clip is not None:
            inputs["clip"] = clip
        return self.add_node("CLIPTextEncode", inputs)

    def add_empty_latent(self, width: int = 512, height: int = 512,
                         batch_size: int = 1) -> NodeRef:
        """Add EmptyLatentImage."""
        return self.add_node("EmptyLatentImage", {
            "width": width, "height": height, "batch_size": batch_size,
        })

    def add_ksampler(self, model=None, positive=None, negative=None,
                     latent_image=None, seed: int = -1, steps: int = 20,
                     cfg: float = 7.0, sampler_name: str = "euler",
                     scheduler: str = "normal", denoise: float = 1.0) -> NodeRef:
        """Add KSampler."""
        import random
        if seed == -1:
            seed = random.randint(0, 2**32 - 1)
        inputs = {
            "seed": seed, "steps": steps, "cfg": cfg,
            "sampler_name": sampler_name, "scheduler": scheduler,
            "denoise": denoise,
        }
        if model is not None:
            inputs["model"] = model
        if positive is not None:
            inputs["positive"] = positive
        if negative is not None:
            inputs["negative"] = negative
        if latent_image is not None:
            inputs["latent_image"] = latent_image
        return self.add_node("KSampler", inputs)

    def add_vae_decode(self, samples=None, vae=None) -> NodeRef:
        """Add VAEDecode."""
        inputs = {}
        if samples is not None:
            inputs["samples"] = samples
        if vae is not None:
            inputs["vae"] = vae
        return self.add_node("VAEDecode", inputs)

    def add_vae_encode(self, pixels=None, vae=None) -> NodeRef:
        """Add VAEEncode."""
        inputs = {}
        if pixels is not None:
            inputs["pixels"] = pixels
        if vae is not None:
            inputs["vae"] = vae
        return self.add_node("VAEEncode", inputs)

    def add_load_image(self, image: str) -> NodeRef:
        """Add LoadImage."""
        return self.add_node("LoadImage", {"image": image})

    def add_save_image(self, images=None, filename_prefix: str = "ComfyUI") -> NodeRef:
        """Add SaveImage (output node)."""
        inputs = {"filename_prefix": filename_prefix}
        if images is not None:
            inputs["images"] = images
        return self.add_node("SaveImage", inputs)

    def add_upscale_model(self, model_name: str) -> NodeRef:
        """Add UpscaleModelLoader."""
        return self.add_node("UpscaleModelLoader", {"model_name": model_name})

    def add_image_upscale(self, upscale_model=None, image=None) -> NodeRef:
        """Add ImageUpscaleWithModel."""
        inputs = {}
        if upscale_model is not None:
            inputs["upscale_model"] = upscale_model
        if image is not None:
            inputs["image"] = image
        return self.add_node("ImageUpscaleWithModel", inputs)

    def build(self) -> dict:
        """Build and validate the workflow graph."""
        if not self._nodes:
            raise ValueError("No nodes added to the workflow.")

        has_output = any(
            node["class_type"] in _OUTPUT_NODE_TYPES
            for node in self._nodes.values()
        )
        if not has_output:
            raise ValueError(
                f"Workflow has no output node. "
                f"Add a SaveImage or PreviewImage node. "
                f"Known output types: {_OUTPUT_NODE_TYPES}"
            )

        return dict(self._nodes)
