"""
Minimal FastAPI stub for the Pyodide build.

main.py imports FastAPI only for routing/validation plumbing; in the browser
the endpoint functions are called directly by bridge.py, so this stub just
lets the module import and keeps route decorators as no-ops.
"""


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str = ""):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"{status_code}: {detail}")


class UploadFile:  # type annotation only — uploads go through bridge.py
    pass


def File(*args, **kwargs):
    return None


def Form(*args, **kwargs):
    return None


class FastAPI:
    def __init__(self, *args, **kwargs):
        pass

    def _route(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    get = _route
    post = _route
    put = _route
    delete = _route

    def add_middleware(self, *args, **kwargs):
        pass

    def mount(self, *args, **kwargs):
        pass
