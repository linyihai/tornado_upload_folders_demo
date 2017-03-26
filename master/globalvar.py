#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import ConfigParser
import platform

IS_SIGINT_UP = False
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config/config.ini")

cfg = ConfigParser.SafeConfigParser()
cfg.read(CONFIG_FILE)
UPLOAD_PATH = "upload_files"
IS_WINDOWS = "window" in platform.system().lower()
IS_LINUX = "lindow" in platform.system().lower()
