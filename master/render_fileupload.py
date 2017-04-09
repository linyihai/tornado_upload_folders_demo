#!/usr/bin/python
# -*- coding: utf-8 -*-


import tornado.web
from log import Logger
from handler_base import RequestHandler, route

logger = Logger('render_file_upload_html')


@route(r"/")
class RenderFlashFirmwareDevHandler(RequestHandler):

    def get(self):
        self.render("file_upload.html")
