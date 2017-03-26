#!/usr/bin/python
# -*- coding: utf-8 -*-


import tornado.web
from log import Logger
logger = Logger('render_file_upload_html')


class RenderFlashFirmwareDevHandler(tornado.web.RequestHandler):

    def get(self):
        self.render("file_upload.html")
