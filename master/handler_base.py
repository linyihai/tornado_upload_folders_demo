#!/usr/bin/python
# -*- coding: utf-8 -*-

import tornado.web
import os
from log import Logger
from common_func import singleton
logger = Logger('hanlder_base')


class RequestHandler(tornado.web.RequestHandler):
    url_pattern = None


def route(url_pattern):
    """
    路由装饰器, 只能装饰 RequestHandler 子类
    """
    def handler_wapper(cls):
        assert(issubclass(cls, RequestHandler))
        cls.url_pattern = url_pattern
        return cls
    return handler_wapper


def singleton(cls, *args, **kw):
    """
    单例类装饰器
    """
    instances = {}

    def _singleton():
        if cls not in instances:
            instances[cls] = cls(*args, **kw)
        return instances[cls]
    return _singleton
