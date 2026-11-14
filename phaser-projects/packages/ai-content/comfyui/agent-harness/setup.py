#!/usr/bin/env python3
from setuptools import setup, find_namespace_packages

setup(
    name="cli-anything-comfyui",
    version="1.0.0",
    description="CLI harness for ComfyUI — AI image generation from the command line",
    long_description=open("cli_anything/comfyui/README.md", "r", encoding="utf-8").read()
    if __import__("os").path.exists("cli_anything/comfyui/README.md")
    else "",
    long_description_content_type="text/markdown",
    packages=find_namespace_packages(include=["cli_anything.*"]),
    python_requires=">=3.10",
    install_requires=[
        "click>=8.0.0",
        "requests>=2.28.0",
        "websocket-client>=1.6.0",
        "prompt_toolkit>=3.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "cli-anything-comfyui=cli_anything.comfyui.comfyui_cli:main",
        ],
    },
    package_data={
        "cli_anything.comfyui": ["skills/*.md"],
    },
    include_package_data=True,
    zip_safe=False,
)
