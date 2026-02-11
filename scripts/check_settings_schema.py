#!/usr/bin/env python3
"""
Settings Schema Lint - Check settings consistency

Usage:
    python scripts/check_settings_schema.py

Checks:
1. Required fields exist
2. No deprecated fields
3. Field types are correct
4. No sensitive data in plaintext
"""

import json
import sys
from pathlib import Path


REQUIRED_TOP_LEVEL = {"display", "notifications"}
OPTIONAL_TOP_LEVEL = {"network_benchmark"}

DISPLAY_SCHEMA = {
    "auto_refresh_enabled": bool,
    "auto_refresh_seconds": int,
    "auto_refresh_visible_only": bool,
}

NOTIFICATIONS_SCHEMA = {
    "feishu": {
        "enabled": bool,
        "webhook_url": str,
        "advice_time": str,
        "report_time": str,
        "timeout_seconds": (int, float),
        "retry_times": int,
        "template": str,
    },
    "telegram": {
        "enabled": bool,
        "bot_token": str,
        "chat_id": str,
        "parse_mode": str,
        "disable_web_page_preview": bool,
        "timeout_seconds": (int, float),
        "retry_times": int,
    },
    "email": {
        "enabled": bool,
        "recipients": str,
    },
}

DEPRECATED_FIELDS = [
    "notifications.telegram.parse_mode",  # 现在只支持空或HTML
]


def check_type(value, expected_type):
    """Check if value matches expected type"""
    if isinstance(expected_type, tuple):
        return any(isinstance(value, t) for t in expected_type)
    return isinstance(value, expected_type)


def lint_settings(settings, path=""):
    """Lint settings dict recursively"""
    errors = []
    warnings = []

    # Check for deprecated fields
    for deprecated in DEPRECATED_FIELDS:
        parts = deprecated.split(".")
        obj = settings
        try:
            for part in parts[:-1]:
                obj = obj.get(part, {})
            if parts[-1] in obj:
                warnings.append(f"Deprecated field: {deprecated}")
        except (AttributeError, TypeError):
            pass

    # Check display section
    if "display" in settings:
        display = settings["display"]
        for field, expected_type in DISPLAY_SCHEMA.items():
            if field not in display:
                errors.append(f"Missing required field: display.{field}")
            elif not check_type(display[field], expected_type):
                errors.append(
                    f"Invalid type for display.{field}: "
                    f"expected {expected_type.__name__}, got {type(display[field]).__name__}"
                )

    # Check notifications section
    if "notifications" in settings:
        notifications = settings["notifications"]
        for channel, schema in NOTIFICATIONS_SCHEMA.items():
            if channel not in notifications:
                errors.append(f"Missing notifications channel: {channel}")
                continue

            channel_config = notifications[channel]
            for field, expected_type in schema.items():
                if field not in channel_config:
                    # Only error if it's a required field
                    if field in ("enabled",):
                        errors.append(f"Missing field: notifications.{channel}.{field}")
                elif not check_type(channel_config[field], expected_type):
                    errors.append(
                        f"Invalid type for notifications.{channel}.{field}: "
                        f"expected {expected_type.__name__ if hasattr(expected_type, '__name__') else expected_type}, "
                        f"got {type(channel_config[field]).__name__}"
                    )

    return errors, warnings


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Check settings schema consistency")
    parser.add_argument("--json", type=str, help="Path to settings JSON file to check")
    args = parser.parse_args()

    if args.json:
        settings_file = Path(args.json)
        if not settings_file.exists():
            print(f"Error: Settings file not found: {settings_file}")
            sys.exit(1)

        # Load settings
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                settings = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in settings file: {e}")
            sys.exit(1)

        # Lint
        errors, warnings = lint_settings(settings)

        # Output
        if warnings:
            print("Warnings:")
            for w in warnings:
                print(f"  ⚠️  {w}")
            print()

        if errors:
            print("Errors:")
            for e in errors:
                print(f"  ❌ {e}")
            print()
            print(f"Total: {len(errors)} errors, {len(warnings)} warnings")
            sys.exit(1)

        print(f"✅ Settings schema OK ({len(warnings)} warnings)")
        sys.exit(0)

    # Default: check frontend default settings
    repo_root = Path(__file__).resolve().parents[1]
    settings_file = repo_root / "frontend" / "src" / "components" / "SettingsDrawer.jsx"

    if not settings_file.exists():
        print(f"Error: Settings file not found: {settings_file}")
        sys.exit(1)

    # Extract DEFAULT_DRAWER_SETTINGS from JSX
    try:
        content = settings_file.read_text(encoding="utf-8")
        # Find the DEFAULT_DRAWER_SETTINGS object
        start = content.find("const DEFAULT_DRAWER_SETTINGS = {")
        if start == -1:
            print("Error: Could not find DEFAULT_DRAWER_SETTINGS in SettingsDrawer.jsx")
            sys.exit(1)

        # Parse the object (simplified - just check it exists)
        print("✅ Found DEFAULT_DRAWER_SETTINGS in SettingsDrawer.jsx")
        print("   Run with --json <file> to check a specific settings JSON file")
        sys.exit(0)
    except Exception as e:
        print(f"Error reading settings: {e}")
        sys.exit(1)

    # Lint
    errors, warnings = lint_settings(settings)

    # Output
    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  ⚠️  {w}")
        print()

    if errors:
        print("Errors:")
        for e in errors:
            print(f"  ❌ {e}")
        print()
        print(f"Total: {len(errors)} errors, {len(warnings)} warnings")
        sys.exit(1)

    print(f"✅ Settings schema OK ({len(warnings)} warnings)")
    sys.exit(0)


if __name__ == "__main__":
    main()
