class JSONResponse:
    def __init__(self, content=None, *args, **kwargs):
        self.content = content


class Response:
    def __init__(self, content=None, media_type=None, *args, **kwargs):
        self.content = content
        self.media_type = media_type
