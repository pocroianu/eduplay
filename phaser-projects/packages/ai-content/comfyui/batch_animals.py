#!/usr/bin/env python3
"""Batch generate educational asset images using Z-Image Turbo via ComfyUI CLI.

Generates ~400 child-friendly illustrations organized by category for use
in early learning educational apps (ages 3-8).
"""

import json
import os
import random
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

# Add the agent-harness to path so imports work from any current directory.
AGENT_HARNESS_PATH = Path(__file__).resolve().parent / "agent-harness"
sys.path.insert(0, str(AGENT_HARNESS_PATH))

from cli_anything.comfyui.core.queue import queue_prompt, get_prompt_history
from cli_anything.comfyui.core.images import download_prompt_images

from postprocess import create_session, postprocess_image

DEFAULT_COMFYUI_URL = "http://localhost:8188"


def resolve_comfyui_server_url() -> str:
    """Return the ComfyUI URL for this batch run."""
    configured_url = os.environ.get("COMFYUI_URL", DEFAULT_COMFYUI_URL).strip()
    return configured_url or DEFAULT_COMFYUI_URL


SERVER = resolve_comfyui_server_url()

# ---------------------------------------------------------------------------
# Educational asset categories
# ---------------------------------------------------------------------------

ASSETS = {
    # --- ANIMALS ---
    "animals-farm": [
        "cow", "pig", "chicken", "rooster", "sheep", "goat", "horse",
        "donkey", "duck", "goose", "turkey", "rabbit", "llama",
    ],
    "animals-pets": [
        "cat", "dog", "hamster", "goldfish", "parrot", "kitten", "puppy",
        "guinea pig", "canary", "turtle",
    ],
    "animals-wild": [
        "lion", "tiger", "elephant", "giraffe", "zebra", "hippo",
        "rhinoceros", "gorilla", "chimpanzee", "leopard", "cheetah",
        "wolf", "fox", "bear", "deer", "moose", "bison", "antelope",
        "gazelle", "hyena",
    ],
    "animals-ocean": [
        "dolphin", "whale", "shark", "octopus", "seahorse", "jellyfish",
        "starfish", "clownfish", "sea turtle", "crab", "lobster",
        "stingray", "seal", "walrus", "orca", "pufferfish",
    ],
    "animals-birds": [
        "eagle", "owl", "penguin", "flamingo", "peacock", "toucan",
        "hummingbird", "pelican", "swan", "woodpecker", "robin",
        "blue jay", "cardinal", "crow", "seagull",
    ],
    "animals-insects": [
        "butterfly", "ladybug", "bee", "caterpillar", "dragonfly",
        "grasshopper", "ant", "firefly", "beetle", "snail",
    ],
    "animals-reptiles": [
        "frog", "chameleon", "gecko", "iguana", "snake",
        "crocodile", "alligator", "salamander", "lizard", "tortoise",
    ],
    "animals-arctic": [
        "polar bear", "arctic fox", "snowy owl", "reindeer",
        "narwhal", "beluga whale", "puffin", "husky dog",
    ],
    "animals-jungle": [
        "panda", "koala", "sloth", "toucan", "tree frog",
        "orangutan", "lemur", "jaguar", "anaconda", "macaw",
    ],
    "animals-dinosaurs": [
        "tyrannosaurus rex", "triceratops", "stegosaurus",
        "brontosaurus", "pterodactyl", "velociraptor",
        "ankylosaurus", "spinosaurus",
    ],

    # --- FRUITS ---
    "fruits": [
        "apple", "banana", "orange", "strawberry", "grape", "watermelon",
        "pineapple", "mango", "peach", "pear", "cherry", "blueberry",
        "raspberry", "kiwi", "lemon", "lime", "coconut", "plum",
        "avocado", "pomegranate",
    ],

    # --- VEGETABLES ---
    "vegetables": [
        "carrot", "broccoli", "tomato", "corn", "potato", "cucumber",
        "bell pepper", "onion", "lettuce", "peas", "pumpkin",
        "mushroom", "eggplant", "cauliflower", "celery", "spinach leaf",
        "radish", "sweet potato", "zucchini", "garlic",
    ],

    # --- FOOD & DRINKS ---
    "food": [
        "pizza slice", "hamburger", "sandwich", "taco", "hot dog",
        "spaghetti", "pancakes", "fried egg", "bread loaf", "croissant",
        "cupcake", "donut", "cookie", "ice cream cone", "lollipop",
        "birthday cake", "cheese wedge", "pretzel", "rice bowl", "sushi",
    ],
    "drinks": [
        "glass of milk", "glass of orange juice", "water bottle",
        "cup of hot chocolate", "smoothie", "coconut drink",
    ],

    # --- VEHICLES & TRANSPORTATION ---
    "vehicles": [
        "car", "bus", "truck", "bicycle", "motorcycle", "train",
        "airplane", "helicopter", "boat", "sailboat", "fire truck",
        "ambulance", "police car", "tractor", "school bus",
        "rocket ship", "hot air balloon", "submarine", "canoe",
        "scooter", "skateboard",
    ],

    # --- NATURE ---
    "nature-plants": [
        "oak tree", "palm tree", "pine tree", "sunflower", "rose",
        "tulip", "daisy", "cactus", "mushroom", "four leaf clover",
        "bamboo", "maple leaf", "fern", "vine", "water lily",
    ],
    "nature-landscape": [
        "mountain", "volcano", "island", "waterfall", "rainbow",
        "cloud", "sun", "crescent moon", "star", "river",
    ],
    "nature-weather": [
        "raindrop", "snowflake", "lightning bolt", "tornado", "umbrella",
    ],

    # --- SPACE ---
    "space": [
        "planet earth", "planet mars", "planet saturn", "rocket",
        "astronaut", "alien", "UFO", "comet", "telescope",
        "space shuttle", "satellite",
    ],

    # --- BODY PARTS ---
    "body": [
        "hand", "foot", "eye", "ear", "nose", "mouth with smile",
        "tooth", "heart organ", "brain", "bone",
    ],

    # --- CLOTHING ---
    "clothing": [
        "t-shirt", "dress", "pants", "shorts", "skirt", "jacket",
        "hat", "baseball cap", "winter beanie", "shoes", "sneakers",
        "boots", "sandals", "socks", "scarf", "mittens", "sunglasses",
        "backpack", "crown",
    ],

    # --- SCHOOL & OFFICE ---
    "school": [
        "pencil", "crayon", "paintbrush", "scissors", "glue bottle",
        "ruler", "eraser", "notebook", "open book", "stack of books",
        "school desk", "chalkboard", "globe", "magnifying glass",
        "backpack", "lunch box", "alphabet block", "abacus",
    ],

    # --- HOUSEHOLD ---
    "household": [
        "house", "door", "window", "key", "lamp", "light bulb",
        "chair", "table", "bed", "sofa", "clock", "mirror",
        "broom", "bucket", "television", "telephone", "bathtub",
        "toothbrush", "soap bar", "towel",
    ],

    # --- KITCHEN ---
    "kitchen": [
        "fork", "spoon", "knife", "plate", "bowl", "cup", "mug",
        "frying pan", "cooking pot", "teapot", "oven", "refrigerator",
        "blender", "rolling pin", "apron",
    ],

    # --- TOYS & PLAY ---
    "toys": [
        "teddy bear", "doll", "toy robot", "toy blocks", "puzzle piece",
        "balloon", "kite", "spinning top", "yo-yo", "rubber duck",
        "toy car", "toy train", "rocking horse", "drum",
        "jump rope", "ball", "frisbee",
    ],

    # --- MUSICAL INSTRUMENTS ---
    "instruments": [
        "piano", "guitar", "violin", "trumpet", "drum set",
        "flute", "tambourine", "xylophone", "harmonica", "maracas",
        "ukulele", "harp",
    ],

    # --- SPORTS ---
    "sports": [
        "soccer ball", "basketball", "baseball", "tennis racket",
        "football", "volleyball", "hockey stick", "golf club",
        "swimming goggles", "ice skate", "medal", "trophy",
    ],

    # --- TOOLS ---
    "tools": [
        "hammer", "screwdriver", "wrench", "saw", "paintbrush",
        "paint roller", "tape measure", "flashlight", "ladder",
        "wheelbarrow",
    ],

    # --- PROFESSIONS ---
    "professions": [
        "doctor", "firefighter", "police officer", "chef", "teacher",
        "astronaut", "pilot", "farmer", "scientist", "artist",
        "dentist", "veterinarian",
    ],

    # --- BUILDINGS & PLACES ---
    "buildings": [
        "school building", "hospital", "fire station", "library",
        "castle", "lighthouse", "windmill", "barn", "church",
        "tent", "igloo", "treehouse",
    ],

    # --- SHAPES ---
    "shapes": [
        "red circle", "blue square", "yellow triangle",
        "green rectangle", "orange star", "purple diamond",
        "pink heart shape", "white oval",
    ],

    # --- NUMBERS ---
    "numbers": [
        "number one", "number two", "number three", "number four",
        "number five", "number six", "number seven", "number eight",
        "number nine", "number zero",
    ],

    # --- LETTERS ---
    "letters": [
        "letter A", "letter B", "letter C", "letter D", "letter E",
        "letter F", "letter G", "letter H", "letter I", "letter J",
        "letter K", "letter L", "letter M", "letter N", "letter O",
        "letter P", "letter Q", "letter R", "letter S", "letter T",
        "letter U", "letter V", "letter W", "letter X", "letter Y",
        "letter Z",
    ],

    # --- EMOTIONS / FACES ---
    "emotions": [
        "happy face", "sad face", "surprised face", "angry face",
        "sleepy face", "laughing face", "crying face", "scared face",
    ],

    # --- SEASONS & HOLIDAYS ---
    "seasonal": [
        "christmas tree", "gift box", "snowman", "jack-o-lantern",
        "easter egg", "candy cane", "wreath", "fireworks",
    ],
}

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

# Categories that get the ANIMAL CHARACTER prompt (cute mascot animals with faces)
ANIMAL_CATEGORIES = {
    "animals-farm", "animals-pets", "animals-wild", "animals-ocean",
    "animals-birds", "animals-insects", "animals-reptiles", "animals-arctic",
    "animals-jungle", "animals-dinosaurs",
    "emotions",
}

# Categories that get the CREATURE prompt (realistic but simplified, no mascot)
CREATURE_CATEGORIES: set[str] = set()

# Categories that get the PERSON prompt (recognizable human characters)
PERSON_CATEGORIES = {
    "professions",
}

ANIMAL_TEMPLATE = """\
A cute, child-friendly digital illustration of a {object}, designed for an early learning educational app. The character is centered and fully visible, shown as a single subject on a solid bright green background, chroma key green background. The pose is simple, readable, and appealing for young children.

The design uses soft rounded shapes, smooth curves, simplified anatomy, and slightly exaggerated proportions to make the character friendly and approachable. The art style is clean vector-cartoon with subtle shading, soft gradients, and polished modern digital illustration quality. Colors are bright, playful, and slightly pastel, with a harmonious palette. Outlines are soft or minimal, avoiding harsh black strokes.

The character has a cheerful, gentle facial expression with big expressive eyes and a small friendly smile. Details are simplified and stylized, suitable for preschool and kindergarten educational content. Lighting is soft and even, with minimal shadows. The overall feeling is playful, safe, friendly, and consistent with a cohesive educational animal illustration set.

uniform style, consistent proportions, cohesive mascot set, children's educational app illustration, polished vector-cartoon look, minimal background clutter, clean silhouette, easy to recognize, age-appropriate design

same visual language as a cohesive preschool animal icon set, consistent mascot proportions, same rendering style across all animals\
"""

CREATURE_TEMPLATE = """\
A child-friendly digital illustration of a {object}, designed for an early learning educational app. The creature is centered and fully visible, shown as a single subject on a solid bright green background, chroma key green background. The illustration shows the actual real-world appearance of the creature, not a cartoon mascot or anthropomorphic character.

The design is a simplified, stylized depiction of a real {object} with accurate anatomy and natural proportions. The art style is clean vector-illustration with subtle shading, soft gradients, and polished modern digital illustration quality. Colors are bright and true to life but slightly softened and pastel. Outlines are soft or minimal, avoiding harsh black strokes.

Details are simplified but anatomically recognizable, suitable for preschool and kindergarten educational content. The creature looks natural, beautiful, and age-appropriate. Lighting is soft and even, with minimal shadows. No anthropomorphic features, no human-like face, no standing upright like a person.

uniform style, consistent proportions, cohesive educational illustration set, polished vector-illustration look, solid bright green background, chroma key green background, clean silhouette, easy to recognize, scientifically recognizable, age-appropriate design

same visual language as a cohesive preschool nature illustration set, consistent rendering style across all creatures\
"""

PERSON_TEMPLATE = """\
A child-friendly digital illustration of exactly one {object}, designed for an early learning educational app. Only one person in the image. The single character is centered and fully visible on a solid bright green background, chroma key green background. No other people, no duplicates, no variations, no small copies.

The design uses friendly, approachable proportions with a slightly stylized but clearly human appearance. The art style is clean vector-cartoon with subtle shading, soft gradients, and polished modern digital illustration quality. Colors are bright, playful, and slightly pastel, with a harmonious palette. Outlines are soft or minimal, avoiding harsh black strokes.

The character has a warm, friendly facial expression with clear human features, natural skin tone, and appropriate professional attire with recognizable details of their profession. The person looks like a real human, not a blob or animal. Details are simplified and stylized, suitable for preschool and kindergarten educational content. Lighting is soft and even, with minimal shadows.

one single character only, uniform style, consistent proportions, cohesive character set, children's educational app illustration, polished vector-cartoon look, no background clutter, clean silhouette, easy to recognize, age-appropriate design

same visual language as a cohesive preschool people illustration set, consistent rendering style across all characters\
"""

OBJECT_TEMPLATE = """\
A child-friendly digital illustration of a {object}, designed for an early learning educational app. The object is centered and fully visible, shown as a single subject on a solid bright green background, chroma key green background. The composition is simple, clear, and easy for young children to recognize.

The design uses soft rounded shapes, smooth curves, and slightly simplified proportions. The art style is clean vector-cartoon with subtle shading, soft gradients, and polished modern digital illustration quality. Colors are bright, playful, and slightly pastel, with a harmonious palette. Outlines are soft or minimal, avoiding harsh black strokes.

Details are simplified and stylized, suitable for preschool and kindergarten educational content. Lighting is soft and even, with minimal shadows. The object looks clean, appealing, and age-appropriate. No face or anthropomorphic features on the object.

uniform style, consistent proportions, cohesive icon set, children's educational app illustration, polished vector-cartoon look, minimal background clutter, clean silhouette, easy to recognize, age-appropriate design

same visual language as a cohesive preschool educational icon set, consistent rendering style across all objects\
"""

NEGATIVE_PROMPT = """\
photorealistic, realistic fur, realistic feathers, realistic skin texture, horror, scary, creepy, aggressive, sharp teeth emphasis, dark mood, dramatic lighting, harsh shadows, high contrast, cluttered background, scenery, environment, extra objects, text, watermark, logo, messy composition, sketch, pencil drawing, painterly, low quality, blurry, noise, grain, distorted anatomy, cropped body, multiple animals, multiple characters, multiple people, group, crowd, duplicates, variations, overly detailed, glossy, shiny, reflective surface, plastic look, wet look, specular highlights, metallic, 3d render, CGI, high gloss, white background, green tint on subject, green color bleed\
"""


# ---------------------------------------------------------------------------
# Workflow builder
# ---------------------------------------------------------------------------

def build_z_image_turbo_workflow(
    positive_prompt: str,
    negative_prompt: str,
    prefix: str = "asset",
) -> dict:
    """Build a Z-Image Turbo workflow with positive + negative prompts."""
    seed = random.randint(0, 2**32 - 1)
    return {
        "28": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "z_image_turbo_bf16.safetensors",
                "weight_dtype": "default",
            },
        },
        "30": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen_3_4b.safetensors",
                "type": "lumina2",
            },
        },
        "29": {
            "class_type": "VAELoader",
            "inputs": {
                "vae_name": "ae.safetensors",
            },
        },
        "11": {
            "class_type": "ModelSamplingAuraFlow",
            "inputs": {
                "model": ["28", 0],
                "shift": 3.0,
            },
        },
        "27": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": ["30", 0],
                "text": positive_prompt,
            },
        },
        "34": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": ["30", 0],
                "text": negative_prompt,
            },
        },
        "13": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1,
            },
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["11", 0],
                "positive": ["27", 0],
                "negative": ["34", 0],
                "latent_image": ["13", 0],
                "seed": seed,
                "steps": 8,
                "cfg": 1.0,
                "sampler_name": "res_multistep",
                "scheduler": "simple",
                "denoise": 1.0,
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["29", 0],
            },
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["8", 0],
                "filename_prefix": prefix,
            },
        },
    }


# ---------------------------------------------------------------------------
# Main batch runner
# ---------------------------------------------------------------------------

def main():
    server = resolve_comfyui_server_url()
    client_id = str(uuid.uuid4())
    output_base = Path("edu_assets")
    log_file = output_base / "generation_log.json"

    # Create rembg session once — reused for all images to avoid reloading the model
    print("Loading rembg u2net model...")
    rembg_session = create_session("u2net")
    print("Ready.\n")

    # Build flat list of (category, item)
    jobs = []
    for category, items in ASSETS.items():
        for item in items:
            jobs.append((category, item))

    total = len(jobs)
    print(f"=== Educational Asset Batch Generation ===")
    print(f"Total assets: {total}")
    print(f"Server: {server}")
    print(f"Output: {output_base.resolve()}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}\n")

    # Load existing log to support resume
    log = []
    completed_keys = set()
    if log_file.exists():
        try:
            existing = json.loads(log_file.read_text())
            log = existing
            completed_keys = {
                f"{e['category']}/{e['item']}"
                for e in existing
                if e.get("status") == "ok"
            }
            if completed_keys:
                print(f"Resuming: {len(completed_keys)} already done, "
                      f"{total - len(completed_keys)} remaining\n")
        except Exception:
            pass

    success = len(completed_keys)
    failed = 0
    skipped = 0

    for i, (category, item) in enumerate(jobs, 1):
        key = f"{category}/{item}"

        # Skip already completed
        if key in completed_keys:
            skipped += 1
            continue

        # Sanitize for filename
        safe_name = item.replace(" ", "-").replace("/", "-").lower()
        prefix = f"{category}_{safe_name}"
        output_dir = str(output_base / category)

        if category in ANIMAL_CATEGORIES:
            template = ANIMAL_TEMPLATE
        elif category in CREATURE_CATEGORIES:
            template = CREATURE_TEMPLATE
        elif category in PERSON_CATEGORIES:
            template = PERSON_TEMPLATE
        else:
            template = OBJECT_TEMPLATE
        positive = template.replace("{object}", item)

        print(f"[{i}/{total}] {category} / {item}")

        workflow = build_z_image_turbo_workflow(
            positive, NEGATIVE_PROMPT, prefix=prefix
        )

        entry = {
            "category": category,
            "item": item,
            "prefix": prefix,
            "timestamp": datetime.now().isoformat(),
            "status": "pending",
        }

        try:
            result = queue_prompt(server, workflow, client_id=client_id)
            prompt_id = result.get("prompt_id")
            entry["prompt_id"] = prompt_id

            # Wait for completion
            completed = False
            for attempt in range(120):
                time.sleep(2)
                try:
                    hist = get_prompt_history(server, prompt_id)
                    if hist and hist.get("completed"):
                        images = download_prompt_images(
                            server, prompt_id, output_dir,
                            overwrite=True,
                        )
                        paths = [img["path"] for img in images]

                        # Remove green background -> transparent RGBA
                        bg_errors = []
                        for p in paths:
                            result = postprocess_image(p, p, rembg_session)
                            if not result["ok"]:
                                bg_errors.append(result["error"])

                        entry["status"] = "ok"
                        entry["files"] = paths
                        if bg_errors:
                            entry["bg_removal_errors"] = bg_errors
                            print(f"  OK -> {paths[0] if paths else '?'} "
                                  f"(bg removal: {len(bg_errors)} error(s))")
                        else:
                            print(f"  OK -> {paths[0] if paths else '?'}")
                        success += 1
                        completed = True
                        break
                except RuntimeError:
                    pass

            if not completed:
                entry["status"] = "timeout"
                print(f"  TIMEOUT")
                failed += 1

        except Exception as e:
            entry["status"] = "error"
            entry["error"] = str(e)
            print(f"  ERROR: {e}")
            failed += 1

        log.append(entry)

        # Save log after every item (crash-safe)
        output_base.mkdir(parents=True, exist_ok=True)
        log_file.write_text(json.dumps(log, indent=2))

    print(f"\n{'='*50}")
    print(f"=== COMPLETE ===")
    print(f"Success: {success}")
    print(f"Failed:  {failed}")
    print(f"Skipped: {skipped} (already done)")
    print(f"Total:   {total}")
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Log: {log_file.resolve()}")


if __name__ == "__main__":
    main()
