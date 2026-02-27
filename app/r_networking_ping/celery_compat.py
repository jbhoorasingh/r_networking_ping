import sys


def _patch_entry_points_api():
    """Make entry_points() backward-compatible for Celery 5.2 on Python 3.12."""
    try:
        import importlib.metadata as importlib_metadata
    except ImportError:  # pragma: no cover
        return

    original_entry_points = importlib_metadata.entry_points

    def entry_points_compat(*args, **kwargs):
        points = original_entry_points(*args, **kwargs)
        if hasattr(points, "get"):
            return points

        class EntryPointsCompat:
            def __init__(self, wrapped_points):
                self._wrapped_points = wrapped_points

            def get(self, group, default=None):
                selected = list(self._wrapped_points.select(group=group))
                if selected:
                    return selected
                return [] if default is None else default

            def __iter__(self):
                return iter(self._wrapped_points)

            def __len__(self):
                return len(self._wrapped_points)

            def __getitem__(self, index):
                return self._wrapped_points[index]

            def __getattr__(self, name):
                return getattr(self._wrapped_points, name)

        return EntryPointsCompat(points)

    importlib_metadata.entry_points = entry_points_compat

    # Patch the backport module too, if present.
    try:
        import importlib_metadata as backport_metadata  # type: ignore
    except ImportError:
        return
    backport_metadata.entry_points = entry_points_compat


def main():
    _patch_entry_points_api()

    from celery.bin.celery import main as celery_main

    # Celery CLI consumes sys.argv itself.
    sys.exit(celery_main())


if __name__ == "__main__":
    main()
