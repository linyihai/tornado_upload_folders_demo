#!/usr/bin/python
# -*- coding: utf-8 -*-


import os
import sys

from log import Logger
from dbutil import DBUtil
from common_func import *

logger = Logger('db_fileupload')


class UploadFileData(object):

    def save_file_info(self, file_name, file_path, file_md5):

        file_id = ComFun().get_guid()
        logger.debug("file_md5:" + file_md5)
        logger.debug("file_path:" + file_path)
        str_sql = "insert into FileInfo (FileID,FileName,FilePath,FileMD5) \
                   values ('%s', '%s', '%s', '%s')" \
            % (file_id, file_name, file_path, file_md5)

        logger.debug("Add FileInfo SQL:" + str_sql)
        try:
            DBUtil().exec_sql(str_sql)
        finally:
            DBUtil().close_db()

    def delete_file_info(self, file_id):

        str_sql = "delete from FileInfo where FileID = ('%s')" % (file_id)
        logger.debug("Delete FileInfo SQL:" + str_sql)

        try:
            DBUtil().exec_sql(str_sql)
        finally:
            DBUtil().close_db()

    def get_file_info(self, **kw):

        if "file_id" in kw:
            file_id = kw["file_id"]
            str_sql = "select * from FileInfo where FileID = '%s'" % (file_id)
        elif "file_md5" in kw:
            file_md5 = kw["file_md5"]
            str_sql = "select * from FileInfo where FileMD5 = '%s'" % (file_md5)
        elif "file_path" in kw:
            file_path = kw["file_path"]
            str_sql = "select * from FileInfo where FilePath = '%s'" % (file_path)
        
        logger.debug("Get FileInfo  :" + str_sql)

        try:
            data = DBUtil().get_data(str_sql)
        finally:
            DBUtil().close_db()

        return data

    def get_file_by_file_path(self, file_path):
        """支持大小写根据文件路径查找文件

        """
        str_sql = "select * from FileInfo where BINARY FilePath = '%s'" % (file_path)
        logger.debug("Get FileInfo by file_path :" + str_sql)
        try:
            data = DBUtil().get_data(str_sql)
        finally:
            DBUtil().close_db()
        return data

if __name__ == "__main__":
    uploadfiledata = UploadFileData()
    uploadfiledata.save_file_info('dddd','eeee','fffff')

