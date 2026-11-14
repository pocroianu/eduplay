# COMFYUI.md — Software-Specific SOP

## Software Overview

**ComfyUI** is a node-based GUI for Stable Diffusion image generation. It runs a
Python backend (aiohttp) exposing REST API + WebSocket on port 8188.

## Backend

- **Engine:** aiohttp Python server
- **API:** REST (JSON) + WebSocket for real-time progress
- **Default URL:** http://localhost:8188
- **Data model:** Directed acyclic graph (DAG) of nodes. Each node has class_type + inputs.
- **File format:** JSON workflow files (API format)

## CLI Architecture

The CLI wraps ComfyUI's HTTP API. It does NOT reimplement image generation.
All rendering is done by the ComfyUI server.

**Pipeline:** Build workflow JSON -> POST /prompt -> WebSocket progress -> GET /view (download)

## Command Groups

| Group | Maps To |
|-------|---------|
| workflow | Local JSON file operations |
| queue | POST /prompt, GET /queue, POST /interrupt |
| models | GET /object_info |
| images | GET /view, GET /history |
| generate | Templates + queue + WebSocket + download |
| system | GET /system_stats, POST /free |

## Required Software

ComfyUI desktop app or standalone server. At least one Stable Diffusion
checkpoint model installed.
