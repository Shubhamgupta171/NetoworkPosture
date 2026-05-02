import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from nps_scanner.safety import assert_targets_allowed  # noqa: E402


def test_private_targets_allowed_without_flag() -> None:
    assert_targets_allowed(["10.0.0.1", "192.168.1.0/24", "127.0.0.1"], allow_public=False)


def test_public_target_blocked() -> None:
    with pytest.raises(SystemExit):
        assert_targets_allowed(["8.8.8.8"], allow_public=False)
