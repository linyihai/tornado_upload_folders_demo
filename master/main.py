#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import tornado.ioloop
import tornado.options
import tornado.httpserver
import signal
import globalvar

from log import Logger
from tornado.options import define, options
from app import base_app


logger = Logger('main')
define("port", default=8089, help="run port", type=int)


def sigint_handler(signum, frame):
    globalvar.IS_SIGINT_UP = True
    logger.info("Stopping Http Server On Keyboard Ctrl C")
    tornado.ioloop.IOLoop.instance().stop()


def main():
    tornado.options.parse_command_line()
    max_buffer_size = 4 * 1024 ** 3  # 4GB
    app = tornado.httpserver.HTTPServer(base_app, max_buffer_size=max_buffer_size)
    app.listen(options.port)
    logger.info('--===****Tornado Web Server Start Running****===--')
    tornado.ioloop.IOLoop.instance().start()
    logger.info('--===****Tornado Web Server Stop Running****===--')

if __name__ == "__main__":
    signal.signal(signal.SIGINT, sigint_handler)
    signal.signal(signal.SIGTERM, sigint_handler)
    globalvar.IS_SIGINT_UP = False
    main()
