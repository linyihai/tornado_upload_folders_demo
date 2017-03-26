#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import tornado.web
import tornado.ioloop
import tornado.options
import tornado.httpserver
import ConfigParser
import signal
import globalvar

from log import Logger
from tornado.options import define, options
from handler_fileupload import *
from render_fileupload import *

logger = Logger('main')
define("port", default=8089, help="run port", type=int)

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
STATIC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


class Application(tornado.web.Application):

    def __init__(self):
        handlers = [
            (r"/", RenderFlashFirmwareDevHandler),
            (r"/files_upload", StreamHandler),
            (r"/check_file_md5", CheckFileMd5Handler)
        ]

        settings = dict(
            template_path=TEMPLATE_PATH,
            static_path=STATIC_PATH,
            cookie_secret="bZJc2sWbQLKos6GkHn/VB9oXwQt8S0R0kRvJ5/xJ89E=",
            xsrf_cookies=False,
            debug=True
        )

        tornado.web.Application.__init__(self, handlers, **settings)


def sigint_handler(signum, frame):
    globalvar.IS_SIGINT_UP = True
    logger.info("Stopping Http Server On Keyboard Ctrl C")
    tornado.ioloop.IOLoop.instance().stop()


def main():
    tornado.options.parse_command_line()
    max_buffer_size = 4 * 1024 ** 3  # 4GB
    app = tornado.httpserver.HTTPServer(Application(), max_buffer_size=max_buffer_size)
    app.listen(options.port)
    logger.info('--===****Tornado Web Server Start Running****===--')
    tornado.ioloop.IOLoop.instance().start()
    logger.info('--===****Tornado Web Server Stop Running****===--')

if __name__ == "__main__":
    signal.signal(signal.SIGINT, sigint_handler)
    signal.signal(signal.SIGTERM, sigint_handler)
    globalvar.IS_SIGINT_UP = False
    main()
